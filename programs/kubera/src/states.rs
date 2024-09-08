use anchor_lang::prelude::*;
use crate::models::LoanStatus;

#[account]
pub struct LoanOffer {
    pub lender: Pubkey,
    pub amount: u64,
    pub interest_rate: u64,
    pub term: i64,
    pub status: LoanStatus,
    pub required_collateral: u64,
    pub loan_offer_id: u64,
    pub guarantor: Option<Pubkey>,
}

#[account]
pub struct Loan {
    pub lender: Pubkey,
    pub borrower: Pubkey,
    pub amount: u64,
    pub interest_rate: u64,
    pub term: i64,
    pub start_time: i64,
    pub status: LoanStatus,
    pub collateral: u64,
    pub loan_id: u64,
    pub guarantor: Option<Pubkey>,
}

#[account]
pub struct AcceptLoan {
    pub borrower: Pubkey,
    pub amount: u64,
    pub interest_rate: u64,
    pub term: i64,
    pub start_time: i64,
    pub status: LoanStatus,
    pub collateral: u64,
    pub loan_id: u64,
    pub guarantor: Option<Pubkey>,
}

#[account]
pub struct UserCollateral {
    pub user: Pubkey,
    pub amount: u64,
}

#[account]
pub struct LoanOfferCounter {
    pub count: u64,
}

#[account]
pub struct GuarantorOffer {
    pub guarantor: Pubkey,
    pub amount: u64,
    pub interest_rate: u64,
    pub expiry_date: i64,
    pub offer_id: u64,
}

#[account]
pub struct GuarantorOfferCounter {
    pub count: u64,
}