use anchor_lang::prelude::*;

#[error_code]
pub enum LoanError {
    #[msg("The loan amount must be greater than zero")]
    InvalidAmount,

    #[msg("The interest rate must be greater than zero")]
    InvalidInterestRate,

    #[msg("The loan term must be greater than zero")]
    InvalidTerm,

    #[msg("The required collateral amount must be greater than zero")]
    InvalidCollateralAmount,

    #[msg("Overflow error occurred during calculation")]
    OverflowError,

    #[msg("Invalid loan status for this operation")]
    InvalidLoanStatus,

    #[msg("Insufficient collateral provided")]
    InsufficientCollateral,

    #[msg("The loan has not yet expired")]
    LoanNotExpired,

    #[msg("Only the lender can perform this action")]
    UnauthorizedLender,

    #[msg("Only the borrower can perform this action")]
    UnauthorizedBorrower,

    #[msg("The token account owner does not match the expected owner")]
    InvalidOwner,

    #[msg("Invalid expiry date")]
    InvalidExpiryDate,

    #[msg("Guarantor offer not found")]
    GuarantorOfferNotFound,

    #[msg("Guarantor offer has expired")]
    GuarantorOfferExpired,

    #[msg("The guarantor offer is invalid or does not match the provided ID")]
    InvalidGuarantorOffer,

    #[msg("A guarantor was required but not provided")]
    GuarantorNotProvided,

    #[msg("The loan is not active")]
    LoanNotActive,

    #[msg("Insufficient repayment amount")]
    InsufficientRepayment,

    #[msg("Repayment amount exceeds the total amount due")]
    ExcessiveRepayment,

    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,

    #[msg("Invalid PDA")]
    InvalidPDA,
}