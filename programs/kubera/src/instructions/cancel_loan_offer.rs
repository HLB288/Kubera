use anchor_lang::prelude::*;
use crate::states::LoanOffer;
use crate::models::LoanStatus;
use crate::errors::LoanError;

#[derive(Accounts)]
pub struct CancelLoanOffer<'info> {
    #[account(mut)]
    pub lender: Signer<'info>,
    #[account(
        mut,
        seeds = [b"loan_offer", lender.key().as_ref(), &loan_offer.loan_offer_id.to_le_bytes()],
        bump,
        constraint = loan_offer.lender == lender.key(),
        constraint = loan_offer.status == LoanStatus::Proposed @ LoanError::InvalidLoanStatus
    )]
    pub loan_offer: Account<'info, LoanOffer>,
}

pub fn cancel_loan_offer(ctx: Context<CancelLoanOffer>) -> Result<()> {
    let loan_offer = &mut ctx.accounts.loan_offer;
    loan_offer.status = LoanStatus::Cancelled;
    Ok(())
}