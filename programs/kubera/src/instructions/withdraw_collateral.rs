use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::states::UserCollateral;
use crate::errors::LoanError;

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user_collateral", user.key().as_ref()],
        bump
    )]
    pub user_collateral: Account<'info, UserCollateral>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"collateral_token_account", user.key().as_ref()],
        bump
    )]
    pub collateral_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
    let user_collateral = &mut ctx.accounts.user_collateral;
    
    // Check if the user has sufficient collateral
    require!(user_collateral.amount >= amount, LoanError::InsufficientCollateral);

    // Update the collateral amount
    user_collateral.amount = user_collateral.amount.checked_sub(amount).unwrap();

    // Create a binding for the user's public key
    let user_pubkey = ctx.accounts.user.key();

    // Derive the PDA for the collateral token account
    let (_, bump) = Pubkey::find_program_address(
        &[b"collateral_token_account", user_pubkey.as_ref()],
        ctx.program_id
    );

    // Create the seeds for signing
    let seeds = &[
        b"collateral_token_account",
        user_pubkey.as_ref(),
        &[bump],
    ];
    let signer = &[&seeds[..]];

    // Transfer tokens from the collateral account to the user's account
    let cpi_accounts = Transfer {
        from: ctx.accounts.collateral_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}