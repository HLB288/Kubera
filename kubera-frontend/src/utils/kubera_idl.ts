import { Idl } from '@project-serum/anchor';

export const IDL: Idl = {
  version: "0.1.0",
  name: "kubera",
  instructions: [
    {
      name: "accept_loan",
      accounts: [
        { name: "borrower", isMut: true, isSigner: true },
        { name: "lender", isMut: false, isSigner: false },
        { name: "loan_offer", isMut: true, isSigner: false },
        { name: "loan", isMut: true, isSigner: false },
        { name: "borrower_collateral", isMut: true, isSigner: false },
        { name: "borrower_token_account", isMut: true, isSigner: false },
        { name: "lender_token_account", isMut: true, isSigner: false },
        { name: "collateral_token_account", isMut: true, isSigner: false },
        { name: "loan_offer_pda", isMut: false, isSigner: false },
        { name: "guarantor", isMut: false, isSigner: false, isOptional: true },
        { name: "guarantor_collateral", isMut: true, isSigner: false, isOptional: true },
        { name: "token_program", isMut: false, isSigner: false },
        { name: "system_program", isMut: false, isSigner: false }
      ],
      args: [
        { name: "loan_offer_id", type: "u64" },
        { name: "use_guarantor", type: "bool" }
      ]
    },
    {
      name: "cancel_loan_offer",
      accounts: [
        { name: "lender", isMut: true, isSigner: true },
        { name: "loan_offer", isMut: true, isSigner: false }
      ],
      args: []
    },
    {
      name: "create_guarantor_offer",
      accounts: [
        { name: "guarantor", isMut: true, isSigner: true },
        { name: "guarantor_offer", isMut: true, isSigner: false },
        { name: "guarantor_offer_counter", isMut: true, isSigner: false },
        { name: "system_program", isMut: false, isSigner: false }
      ],
      args: [
        { name: "amount", type: "u64" },
        { name: "interest_rate", type: "u64" },
        { name: "expiry_date", type: "i64" }
      ]
    },
    {
      name: "create_loan_offer",
      accounts: [
        { name: "lender", isMut: true, isSigner: true },
        { name: "loan_offer_account", isMut: true, isSigner: false },
        { name: "lender_token_account", isMut: true, isSigner: false },
        { name: "loan_offer_counter", isMut: true, isSigner: false },
        { name: "loan_offer_pda", isMut: false, isSigner: false },
        { name: "system_program", isMut: false, isSigner: false },
        { name: "token_program", isMut: false, isSigner: false }
      ],
      args: [
        { name: "args", type: { defined: "CreateLoanOfferArgs" } }
      ]
    },
    {
      name: "deposit_collateral",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "user_collateral", isMut: true, isSigner: false },
        { name: "user_token_account", isMut: true, isSigner: false },
        { name: "collateral_token_account", isMut: true, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "token_program", isMut: false, isSigner: false },
        { name: "system_program", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false }
      ],
      args: [
        { name: "amount", type: "u64" }
      ]
    },
    {
      name: "initialize_guarantor_offer_counter",
      accounts: [
        { name: "guarantor_offer_counter", isMut: true, isSigner: false },
        { name: "payer", isMut: true, isSigner: true },
        { name: "system_program", isMut: false, isSigner: false }
      ],
      args: []
    },
    {
      name: "initialize_loan_offer_counter",
      accounts: [
        { name: "loan_offer_counter", isMut: true, isSigner: false },
        { name: "payer", isMut: true, isSigner: true },
        { name: "system_program", isMut: false, isSigner: false }
      ],
      args: []
    },
    {
      name: "repay_loan",
      accounts: [
        { name: "borrower", isMut: true, isSigner: true },
        { name: "loan", isMut: true, isSigner: false },
        { name: "borrower_token_account", isMut: true, isSigner: false },
        { name: "lender_token_account", isMut: true, isSigner: false },
        { name: "token_program", isMut: false, isSigner: false },
        { name: "clock", isMut: false, isSigner: false }
      ],
      args: [
        { name: "amount", type: "u64" }
      ]
    },
    {
      name: "transfer_to_escrow",
      accounts: [
        { name: "lender", isMut: true, isSigner: true },
        { name: "lender_token_account", isMut: true, isSigner: false },
        { name: "escrow_token_account", isMut: true, isSigner: false },
        { name: "loan_token_mint", isMut: false, isSigner: false },
        { name: "token_program", isMut: false, isSigner: false }
      ],
      args: [
        { name: "amount", type: "u64" }
      ]
    },
    {
      name: "withdraw_collateral",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "user_collateral", isMut: true, isSigner: false },
        { name: "user_token_account", isMut: true, isSigner: false },
        { name: "collateral_token_account", isMut: true, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "token_program", isMut: false, isSigner: false },
        { name: "system_program", isMut: false, isSigner: false }
      ],
      args: [
        { name: "amount", type: "u64" }
      ]
    }
  ],
  accounts: [
    {
      name: "GuarantorOffer",
      type: {
        kind: "struct",
        fields: [
          { name: "guarantor", type: "publicKey" },
          { name: "amount", type: "u64" },
          { name: "interest_rate", type: "u64" },
          { name: "expiry_date", type: "i64" },
          { name: "offer_id", type: "u64" }
        ]
      }
    },
    {
      name: "GuarantorOfferCounter",
      type: {
        kind: "struct",
        fields: [
          { name: "count", type: "u64" }
        ]
      }
    },
    {
      name: "Loan",
      type: {
        kind: "struct",
        fields: [
          { name: "lender", type: "publicKey" },
          { name: "borrower", type: "publicKey" },
          { name: "amount", type: "u64" },
          { name: "interest_rate", type: "u64" },
          { name: "term", type: "i64" },
          { name: "start_time", type: "i64" },
          { name: "status", type: { defined: "LoanStatus" } },
          { name: "collateral", type: "u64" },
          { name: "loan_id", type: "u64" },
          { name: "guarantor", type: { option: "publicKey" } }
        ]
      }
    },
    {
      name: "LoanOffer",
      type: {
        kind: "struct",
        fields: [
          { name: "lender", type: "publicKey" },
          { name: "amount", type: "u64" },
          { name: "interest_rate", type: "u64" },
          { name: "term", type: "i64" },
          { name: "status", type: { defined: "LoanStatus" } },
          { name: "required_collateral", type: "u64" },
          { name: "loan_offer_id", type: "u64" },
          { name: "guarantor", type: { option: "publicKey" } }
        ]
      }
    },
    {
      name: "LoanOfferCounter",
      type: {
        kind: "struct",
        fields: [
          { name: "count", type: "u64" }
        ]
      }
    },
    {
      name: "UserCollateral",
      type: {
        kind: "struct",
        fields: [
          { name: "user", type: "publicKey" },
          { name: "amount", type: "u64" }
        ]
      }
    }
  ],
  types: [
    {
      name: "CreateLoanOfferArgs",
      type: {
        kind: "struct",
        fields: [
          { name: "amount", type: "u64" },
          { name: "interest_rate", type: "u64" },
          { name: "term", type: "i64" },
          { name: "required_collateral", type: "u64" }
        ]
      }
    },
    {
      name: "LoanStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "Proposed" },
          { name: "Active" },
          { name: "Repaid" },
          { name: "Defaulted" },
          { name: "Cancelled" },
          { name: "Expired" }
        ]
      }
    }
  ],
  events: [
    {
      name: "LoanActivated",
      fields: [
        { name: "loan_id", type: "u64", index: false },
        { name: "borrower", type: "publicKey", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "start_time", type: "i64", index: false }
      ]
    },
    {
      name: "LoanDefaulted",
      fields: [
        { name: "loan_id", type: "u64", index: false },
        { name: "defaulted_amount", type: "u64", index: false }
      ]
    },
    {
      name: "LoanOfferCreated",
      fields: [
        { name: "lender", type: "publicKey", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "interest_rate", type: "u64", index: false },
        { name: "term", type: "i64", index: false },
        { name: "required_collateral", type: "u64", index: false },
        { name: "loan_offer_id", type: "u64", index: false }
      ]
    },
    {
      name: "LoanRepaid",
      fields: [
        { name: "loan_id", type: "u64", index: false },
        { name: "amount_repaid", type: "u64", index: false }
      ]
    }
  ],
  errors: [
    { code: 6000, name: "InvalidAmount", msg: "The loan amount must be greater than zero" },
    { code: 6001, name: "InvalidInterestRate", msg: "The interest rate must be greater than zero" },
    { code: 6002, name: "InvalidTerm", msg: "The loan term must be greater than zero" },
    { code: 6003, name: "InvalidCollateralAmount", msg: "The required collateral amount must be greater than zero" },
    { code: 6004, name: "OverflowError", msg: "Overflow error occurred during calculation" },
    { code: 6005, name: "InvalidLoanStatus", msg: "Invalid loan status for this operation" },
    { code: 6006, name: "InsufficientCollateral", msg: "Insufficient collateral provided" },
    { code: 6007, name: "LoanNotExpired", msg: "The loan has not yet expired" },
    { code: 6008, name: "UnauthorizedLender", msg: "Only the lender can perform this action" },
    { code: 6009, name: "UnauthorizedBorrower", msg: "Only the borrower can perform this action" },
    { code: 6010, name: "InvalidOwner", msg: "The token account owner does not match the expected owner" },
    { code: 6011, name: "InvalidExpiryDate", msg: "Invalid expiry date" },
    { code: 6012, name: "GuarantorOfferNotFound", msg: "Guarantor offer not found" },
    { code: 6013, name: "GuarantorOfferExpired", msg: "Guarantor offer has expired" },
    { code: 6014, name: "InvalidGuarantorOffer", msg: "The guarantor offer is invalid or does not match the provided ID" },
    { code: 6015, name: "GuarantorNotProvided", msg: "A guarantor was required but not provided" },
    { code: 6016, name: "LoanNotActive", msg: "The loan is not active" },
    { code: 6017, name: "InsufficientRepayment", msg: "Insufficient repayment amount" },
    { code: 6018, name: "ExcessiveRepayment", msg: "Repayment amount exceeds the total amount due" },
    { code: 6019, name: "InvalidTokenAccountOwner", msg: "Invalid token account owner" },
    { code: 6020, name: "InvalidPDA", msg: "Invalid PDA" }
  ]
};

export const PROGRAM_ID = "8h4QZ3TgpZBBBVaybKsXaRSEDMCjGsgrVR7xYs4BdHoU";
export type Kubera = typeof IDL;