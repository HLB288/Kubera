use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use crate::states::UserCollateral;
use crate::errors::LoanError;

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + std::mem::size_of::<UserCollateral>(),
        seeds = [b"user_collateral", user.key().as_ref()],
        bump
    )]
    pub user_collateral: Account<'info, UserCollateral>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        token::mint = mint,
        token::authority = user,
        seeds = [b"collateral_token_account", user.key().as_ref()],
        bump
    )]
    pub collateral_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
    let user_collateral = &mut ctx.accounts.user_collateral;
    
    // Initialize the user_collateral account if it's new
    if user_collateral.user == Pubkey::default() {
        user_collateral.user = ctx.accounts.user.key();
        user_collateral.amount = 0;
    }
    
    // Add the new amount to the existing collateral
    user_collateral.amount = user_collateral.amount.checked_add(amount).ok_or(LoanError::OverflowError)?;

    // Transfer tokens from user's token account to the collateral token account
    let cpi_accounts = token::Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.collateral_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}