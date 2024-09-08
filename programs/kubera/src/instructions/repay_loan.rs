use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::states::Loan;
use crate::models::{LoanStatus, LoanRepaid};
use crate::errors::LoanError;

#[derive(Accounts)]
pub struct RepayLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(
        mut,
        constraint = loan.status == LoanStatus::Active @ LoanError::LoanNotActive,
        constraint = loan.borrower == borrower.key() @ LoanError::UnauthorizedBorrower,
    )]
    pub loan: Account<'info, Loan>,

    #[account(mut, constraint = borrower_token_account.owner == borrower.key())]
    pub borrower_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = lender_token_account.owner == loan.lender)]
    pub lender_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn repay_loan(ctx: Context<RepayLoan>, amount: u64) -> Result<()> {
    let loan = &mut ctx.accounts.loan;
    let clock = &ctx.accounts.clock;

    // Calculate loan expiry time
    let expiry_time = loan.start_time.checked_add(loan.term).unwrap();

    // Check if the loan has expired
    let is_expired = clock.unix_timestamp >= expiry_time;

    // Calculate total repayment amount (principal + interest)
    let total_repayment = loan.amount.checked_add(
        loan.amount.checked_mul(loan.interest_rate).unwrap().checked_div(10000).unwrap()
    ).unwrap();

    // For repayments before expiry, ensure the amount is sufficient
    if !is_expired {
        require!(amount >= total_repayment, LoanError::InsufficientRepayment);
    } else {
        // For expired loans, allow partial repayments
        require!(amount <= total_repayment, LoanError::ExcessiveRepayment);
    }

    // Transfer tokens from borrower to lender
    let cpi_accounts = Transfer {
        from: ctx.accounts.borrower_token_account.to_account_info(),
        to: ctx.accounts.lender_token_account.to_account_info(),
        authority: ctx.accounts.borrower.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update loan status if fully repaid
    if amount == total_repayment {
        loan.status = LoanStatus::Repaid;
    }

    // Emit an event for the repayment
    emit!(LoanRepaid {
        loan_id: loan.loan_id,
        amount_repaid: amount,
    });

    Ok(())
}