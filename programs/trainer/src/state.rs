use anchor_lang::prelude::*;

#[account]
pub struct Trader {
  pub user: Pubkey,
  pub name: String,
  pub performance: u64,
  pub bump: u8,
}

// Calculate the trader's data space
impl Trader {
  pub fn space(name: &str) -> usize {
    // discriminator
    8 +
    // user + name + performance + bump
    32 + (4 + name.len()) + 8 + 1
  }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct Validation {
  pub value: i64,
  pub trader: Pubkey,
  pub user: Pubkey,
}

#[account]
pub struct Exercise {
  pub full: bool,
  pub cid: String,
  pub authority: Pubkey,
  pub outcome: i64,
  pub solution_cid: String,
  pub validations_capacity: u8,
  pub validations: Vec<Validation>,
  pub bump: u8,
}

// Calculate the vote's data space
impl Exercise {
  pub fn space(cid: &str, validations_capacity: u8) -> usize {
    // discriminator
    8 +
    // full + cid + authority + outcome + solution_cid + validations_capacity +
    1 + (4 + cid.len()) + 32 + 8 + (4 + cid.len()) + 1 +
    // vec of validations +
    4 + (validations_capacity as usize) * std::mem::size_of::<Validation>() +
    // bump
    1
  }
}
