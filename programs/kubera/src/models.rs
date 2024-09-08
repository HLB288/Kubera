use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum LoanStatus {
    Proposed,
    Active,
    Repaid,
    Defaulted,
    Cancelled,
    Expired,
}

// Événements
#[event]
pub struct LoanOfferCreated {
    pub lender: Pubkey,
    pub amount: u64,
    pub interest_rate: u64,
    pub term: i64,
    pub required_collateral: u64,
    pub loan_offer_id: u64,
}

#[event]
pub struct LoanActivated {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub amount: u64,
    pub start_time: i64,
}

#[event]
pub struct LoanRepaid {
    pub loan_id: u64,
    pub amount_repaid: u64,
}

#[event]
pub struct LoanDefaulted {
    pub loan_id: u64,
    pub defaulted_amount: u64,
}