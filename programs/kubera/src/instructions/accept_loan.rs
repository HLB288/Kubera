use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::states::{LoanOffer, Loan, UserCollateral};
use crate::models::LoanStatus;
use crate::errors::LoanError;

#[derive(Accounts)]
#[instruction(loan_offer_id: u64, use_guarantor: bool)]
pub struct AcceptLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,

    /// CHECK: This account is not a signer and should only be used as a reference
    pub lender: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"loan_offer", lender.key().as_ref(), &loan_offer_id.to_le_bytes()],
        bump,
        constraint = loan_offer.status == LoanStatus::Proposed
    )]
    pub loan_offer: Account<'info, LoanOffer>,

    #[account(
        init,
        payer = borrower,
        space = 8 + std::mem::size_of::<Loan>(),
        seeds = [b"loan", loan_offer.key().as_ref(), borrower.key().as_ref()],
        bump
    )]
    pub loan: Account<'info, Loan>,

    #[account(mut)]
    pub borrower_collateral: Account<'info, UserCollateral>,

    #[account(mut)]
    pub borrower_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lender_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"collateral_token_account", borrower.key().as_ref()],
        bump
    )]
    pub collateral_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"loan_offer", lender.key().as_ref(), &loan_offer_id.to_le_bytes()],
        bump
    )]
    /// CHECK: This is the PDA that will be used as the authority for the transfer
    pub loan_offer_pda: AccountInfo<'info>,

    /// CHECK: This account is checked in the instruction handler
    pub guarantor: Option<AccountInfo<'info>>,

    #[account(mut)]
    pub guarantor_collateral: Option<Account<'info, UserCollateral>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn accept_loan(ctx: Context<AcceptLoan>, loan_offer_id: u64, use_guarantor: bool) -> Result<()> {
    let loan_offer = &ctx.accounts.loan_offer;
    let borrower_collateral = &ctx.accounts.borrower_collateral;
    let guarantor_collateral = ctx.accounts.guarantor_collateral.as_ref();

    msg!("Lender: {:?}", ctx.accounts.lender.key());
    msg!("Lender token account: {:?}", ctx.accounts.lender_token_account.key());
    msg!("Lender token account owner: {:?}", ctx.accounts.lender_token_account.owner);
    msg!("Borrower: {:?}", ctx.accounts.borrower.key());
    msg!("Borrower token account: {:?}", ctx.accounts.borrower_token_account.key());
    msg!("Borrower token account owner: {:?}", ctx.accounts.borrower_token_account.owner);
    msg!("Loan offer PDA: {:?}", ctx.accounts.loan_offer_pda.key());

    msg!("Transfer authority (should be PDA): {:?}", ctx.accounts.loan_offer_pda.key());
    msg!("Lender token account delegate: {:?}", ctx.accounts.lender_token_account.delegate);
    msg!("Lender token account delegated amount: {:?}", ctx.accounts.lender_token_account.delegated_amount);


    // Ensure lender token account is owned by the lender
    require!(
        ctx.accounts.lender_token_account.owner == ctx.accounts.lender.key(),
        LoanError::InvalidTokenAccountOwner
    );

    // Ensure borrower token account is owned by the borrower
    require!(
        ctx.accounts.borrower_token_account.owner == ctx.accounts.borrower.key(),
        LoanError::InvalidTokenAccountOwner
    );

    // Calculate total collateral
    let mut total_collateral = borrower_collateral.amount;
    let mut guarantor_contribution = 0;
    if use_guarantor {
        if let Some(guarantor_collateral) = guarantor_collateral {
            let available_guarantor_collateral = guarantor_collateral.amount;
            guarantor_contribution = loan_offer.required_collateral.saturating_sub(total_collateral);
            guarantor_contribution = guarantor_contribution.min(available_guarantor_collateral);
            total_collateral = total_collateral
                .checked_add(guarantor_contribution)
                .ok_or(LoanError::OverflowError)?;
        } else {
            return Err(LoanError::GuarantorNotProvided.into());
        }
    }

    // Check if total collateral is sufficient
    if total_collateral < loan_offer.required_collateral {
        return Err(LoanError::InsufficientCollateral.into());
    }

    // Create a binding for the lender's public key
    let lender_key = ctx.accounts.lender.key();

    // Derive the PDA for the loan offer
    let (pda, bump) = Pubkey::find_program_address(
        &[
            b"loan_offer",
            lender_key.as_ref(),
            &loan_offer_id.to_le_bytes(),
        ],
        ctx.program_id
    );

    // Verify that the derived PDA matches the provided loan_offer_pda
    require!(pda == ctx.accounts.loan_offer_pda.key(), LoanError::InvalidPDA);

    // Create the loan
    let loan = &mut ctx.accounts.loan;
    loan.lender = loan_offer.lender;
    loan.borrower = ctx.accounts.borrower.key();
    loan.amount = loan_offer.amount;
    loan.interest_rate = loan_offer.interest_rate;
    loan.term = loan_offer.term;
    loan.start_time = Clock::get()?.unix_timestamp;
    loan.status = LoanStatus::Active;
    loan.collateral = total_collateral;
    loan.loan_id = loan_offer_id;

    if use_guarantor {
        loan.guarantor = ctx.accounts.guarantor.as_ref().map(|g| g.key());
    }

    // Transfer funds from lender's token account to borrower's token account
    let loan_offer_seeds = &[
        b"loan_offer",
        lender_key.as_ref(),
        &loan_offer_id.to_le_bytes(),
        &[bump],
    ];
    let signer = &[&loan_offer_seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.lender_token_account.to_account_info(),
        to: ctx.accounts.borrower_token_account.to_account_info(),
        authority: ctx.accounts.loan_offer_pda.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, loan_offer.amount)?;

    // Update loan offer status
    let loan_offer = &mut ctx.accounts.loan_offer;
    loan_offer.status = LoanStatus::Active;

    // If using guarantor, update guarantor collateral
    // if use_guarantor {
    //     if let Some(guarantor_collateral) = ctx.accounts.guarantor_collateral.as_mut() {
    //         guarantor_collateral.amount = guarantor_collateral
    //             .amount
    //             .checked_sub(loan_offer.required_collateral)
    //             .ok_or(LoanError::InsufficientCollateral)?;
    //     }
    // }

    // New version
    if use_guarantor {
        if let Some(guarantor_collateral) = guarantor_collateral {
            let available_guarantor_collateral = guarantor_collateral.amount;
            guarantor_contribution = loan_offer.required_collateral.saturating_sub(total_collateral);
            guarantor_contribution = guarantor_contribution.min(available_guarantor_collateral);
            total_collateral = total_collateral
                .checked_add(guarantor_contribution)
                .ok_or(LoanError::OverflowError)?;
        } else {
            return Err(LoanError::GuarantorNotProvided.into());
        }
    }

    // Update borrower collateral
    let borrower_collateral = &mut ctx.accounts.borrower_collateral;
    borrower_collateral.amount = borrower_collateral
        .amount
        .checked_sub(if use_guarantor { 
            total_collateral.checked_sub(loan_offer.required_collateral).unwrap() 
        } else { 
            loan_offer.required_collateral 
        })
        .ok_or(LoanError::InsufficientCollateral)?;


    // If using guarantor, update guarantor collateral
    if use_guarantor && guarantor_contribution > 0 {
        if let Some(guarantor_collateral) = ctx.accounts.guarantor_collateral.as_mut() {
            guarantor_collateral.amount = guarantor_collateral
                .amount
                .checked_sub(guarantor_contribution)
                .ok_or(LoanError::InsufficientCollateral)?;
        }
    }

    Ok(())
}