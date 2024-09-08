use anchor_lang::prelude::*;

pub mod models;
pub mod errors;
pub mod states;
pub mod instructions;

use instructions::withdraw_collateral::*;
use instructions::cancel_loan_offer::*;
use instructions::create_loan_offer::*;
use instructions::accept_loan::*;
use instructions::deposit_collateral::*;
use instructions::guarantor_offer::*;
use instructions::repay_loan::*;

// declare_id!("2gXdKnSrVRg9kB5xm5TTKBTvw6oLUs7axYdD1cfbm2cx");
declare_id!("8h4QZ3TgpZBBBVaybKsXaRSEDMCjGsgrVR7xYs4BdHoU");

#[program]
pub mod kubera {
    use super::*;

    pub fn initialize_loan_offer_counter(ctx: Context<InitializeLoanOfferCounter>) -> Result<()> {
        instructions::create_loan_offer::initialize_loan_offer_counter(ctx)
    }

    pub fn create_loan_offer(ctx: Context<CreateLoanOffer>, args: CreateLoanOfferArgs) -> Result<()> {
        instructions::create_loan_offer::create_loan_offer(ctx, args)
    }

    pub fn transfer_to_escrow(ctx: Context<TransferToEscrow>, amount: u64) -> Result<()> {
        instructions::create_loan_offer::transfer_to_escrow(ctx, amount)
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        instructions::deposit_collateral::deposit_collateral(ctx, amount)
    }

    pub fn accept_loan(ctx: Context<AcceptLoan>, loan_offer_id: u64, use_guarantor: bool) -> Result<()> {
        instructions::accept_loan::accept_loan(ctx, loan_offer_id, use_guarantor)
    }
    
    pub fn create_guarantor_offer(ctx: Context<CreateGuarantorOffer>, amount: u64, interest_rate: u64, expiry_date: i64) -> Result<()> {
        instructions::guarantor_offer::create_guarantor_offer(ctx, amount, interest_rate, expiry_date)
    }

    pub fn initialize_guarantor_offer_counter(ctx: Context<InitializeGuarantorOfferCounter>) -> Result<()> {
        instructions::guarantor_offer::initialize_guarantor_offer_counter(ctx)
    }

    pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
        instructions::withdraw_collateral::withdraw_collateral(ctx, amount)
    }

    pub fn cancel_loan_offer(ctx: Context<CancelLoanOffer>) -> Result<()> {
        instructions::cancel_loan_offer::cancel_loan_offer(ctx)
    }
    
    pub fn repay_loan(ctx: Context<RepayLoan>, amount: u64) -> Result<()> {
        instructions::repay_loan::repay_loan(ctx, amount)
    }


}