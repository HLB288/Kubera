use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Approve};
use crate::states::{LoanOffer, LoanOfferCounter};
use crate::models::{LoanStatus, LoanOfferCreated};
use crate::errors::LoanError;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct CreateLoanOfferArgs {
    pub amount: u64,
    pub interest_rate: u64,
    pub term: i64,
    pub required_collateral: u64,
}

#[derive(Accounts)]
#[instruction(args: CreateLoanOfferArgs)]
pub struct CreateLoanOffer<'info> {
    #[account(mut)]
    pub lender: Signer<'info>,

    #[account(
        init,
        payer = lender,
        space = 8 + std::mem::size_of::<LoanOffer>(),
        seeds = [
            b"loan_offer",
            lender.key().as_ref(),
            &loan_offer_counter.count.to_le_bytes()
        ],
        bump
    )]
    pub loan_offer_account: Account<'info, LoanOffer>,

    #[account(mut)]
    pub lender_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"loan_offer_counter"],
        bump
    )]
    pub loan_offer_counter: Account<'info, LoanOfferCounter>,

    /// CHECK: This is the PDA that will be used as the authority for the transfer
    #[account(
        seeds = [
            b"loan_offer",
            lender.key().as_ref(),
            &loan_offer_counter.count.to_le_bytes()
        ],
        bump
    )]
    pub loan_offer_pda: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn create_loan_offer(ctx: Context<CreateLoanOffer>, args: CreateLoanOfferArgs) -> Result<()> {
    // Validation logic
    require!(args.amount > 0, LoanError::InvalidAmount);
    require!(args.interest_rate > 0, LoanError::InvalidInterestRate);
    require!(args.term > 0, LoanError::InvalidTerm);
    require!(args.required_collateral > 0, LoanError::InvalidCollateralAmount);

    // Update counter
    let loan_offer_counter = &mut ctx.accounts.loan_offer_counter;
    let loan_offer_id = loan_offer_counter.count;
    loan_offer_counter.count = loan_offer_counter.count.checked_add(1).ok_or(LoanError::OverflowError)?;

    // Create loan offer
    let loan_offer = &mut ctx.accounts.loan_offer_account;
    loan_offer.lender = ctx.accounts.lender.key();
    loan_offer.amount = args.amount;
    loan_offer.interest_rate = args.interest_rate;
    loan_offer.term = args.term;
    loan_offer.status = LoanStatus::Proposed;
    loan_offer.required_collateral = args.required_collateral;
    loan_offer.loan_offer_id = loan_offer_id;

    // Delegate authority to the PDA
    let cpi_accounts = Approve {
        to: ctx.accounts.lender_token_account.to_account_info(),
        delegate: ctx.accounts.loan_offer_pda.to_account_info(),
        authority: ctx.accounts.lender.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::approve(cpi_ctx, args.amount)?;

    msg!("Delegated {} tokens to PDA: {:?}", args.amount, ctx.accounts.loan_offer_pda.key());

    // Emit event
    emit!(LoanOfferCreated {
        lender: ctx.accounts.lender.key(),
        amount: args.amount,
        interest_rate: args.interest_rate,
        term: args.term,
        required_collateral: args.required_collateral,
        loan_offer_id,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct TransferToEscrow<'info> {
    #[account(mut)]
    pub lender: Signer<'info>,
    #[account(mut)]
    pub lender_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub loan_token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn transfer_to_escrow(ctx: Context<TransferToEscrow>, amount: u64) -> Result<()> {
    let cpi_accounts = token::Transfer {
        from: ctx.accounts.lender_token_account.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.lender.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token::transfer(cpi_ctx, amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeLoanOfferCounter<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<LoanOfferCounter>(),
        seeds = [b"loan_offer_counter"],
        bump
    )]
    pub loan_offer_counter: Account<'info, LoanOfferCounter>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_loan_offer_counter(ctx: Context<InitializeLoanOfferCounter>) -> Result<()> {
    let loan_offer_counter = &mut ctx.accounts.loan_offer_counter;
    loan_offer_counter.count = 0;
    Ok(())
}