use anchor_lang::prelude::*;
use crate::states::{GuarantorOffer, GuarantorOfferCounter};
use crate::errors::LoanError;

#[derive(Accounts)]
#[instruction(amount: u64, interest_rate: u64, expiry_date: i64)]
pub struct CreateGuarantorOffer<'info> {
    #[account(mut)]
    pub guarantor: Signer<'info>,

    #[account(
        init,
        payer = guarantor,
        space = 8 + std::mem::size_of::<GuarantorOffer>(),
        seeds = [
            b"guarantor_offer",
            guarantor.key().as_ref(),
            &guarantor_offer_counter.count.to_le_bytes()
        ],
        bump
    )]
    pub guarantor_offer: Account<'info, GuarantorOffer>,

    #[account(
        mut,
        seeds = [b"guarantor_offer_counter"],
        bump
    )]
    pub guarantor_offer_counter: Account<'info, GuarantorOfferCounter>,

    pub system_program: Program<'info, System>,
}

pub fn create_guarantor_offer(ctx: Context<CreateGuarantorOffer>, amount: u64, interest_rate: u64, expiry_date: i64) -> Result<()> {
    require!(amount > 0, LoanError::InvalidAmount);
    require!(interest_rate > 0, LoanError::InvalidInterestRate);
    require!(expiry_date > Clock::get()?.unix_timestamp, LoanError::InvalidExpiryDate);

    let guarantor_offer_counter = &mut ctx.accounts.guarantor_offer_counter;
    let offer_id = guarantor_offer_counter.count;
    guarantor_offer_counter.count = guarantor_offer_counter.count.checked_add(1).ok_or(LoanError::OverflowError)?;

    let guarantor_offer = &mut ctx.accounts.guarantor_offer;
    guarantor_offer.guarantor = ctx.accounts.guarantor.key();
    guarantor_offer.amount = amount;
    guarantor_offer.interest_rate = interest_rate;
    guarantor_offer.expiry_date = expiry_date;
    guarantor_offer.offer_id = offer_id;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeGuarantorOfferCounter<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<GuarantorOfferCounter>(),
        seeds = [b"guarantor_offer_counter"],
        bump
    )]
    pub guarantor_offer_counter: Account<'info, GuarantorOfferCounter>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_guarantor_offer_counter(ctx: Context<InitializeGuarantorOfferCounter>) -> Result<()> {
    let guarantor_offer_counter = &mut ctx.accounts.guarantor_offer_counter;
    guarantor_offer_counter.count = 0;
    Ok(())
}

#[derive(Accounts)]
pub struct CancelGuarantorOffer<'info> {
    #[account(mut)]
    pub guarantor: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"guarantor_offer",
            guarantor.key().as_ref(),
            &guarantor_offer.offer_id.to_le_bytes()
        ],
        bump,
        constraint = guarantor_offer.guarantor == guarantor.key(),
        close = guarantor
    )]
    pub guarantor_offer: Account<'info, GuarantorOffer>,
}

pub fn cancel_guarantor_offer(_ctx: Context<CancelGuarantorOffer>) -> Result<()> {
    // La contrainte dans CancelGuarantorOffer assure que seul le garant peut annuler l'offre
    // L'attribut `close = guarantor` ferme automatiquement le compte et renvoie les fonds au garant
    Ok(())
}

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct GetGuarantorOffer<'info> {
    #[account(
        seeds = [
            b"guarantor_offer",
            guarantor_offer.guarantor.as_ref(),
            &offer_id.to_le_bytes()
        ],
        bump,
        constraint = guarantor_offer.offer_id == offer_id
    )]
    pub guarantor_offer: Account<'info, GuarantorOffer>,
}

pub fn get_guarantor_offer(_ctx: Context<GetGuarantorOffer>) -> Result<()> {
    // Cette fonction ne fait rien car la contrainte dans GetGuarantorOffer
    // assure déjà que le compte GuarantorOffer correct est fourni
    Ok(())
}