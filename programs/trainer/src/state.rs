use anchor_lang::prelude::*;

#[account]
pub struct Trader {
  pub user: Pubkey,
  pub performance: u64,
  pub ranking: u64,
  pub league: u8,
  pub name: String,
  pub bump: u8,
}

// Calculate the trader's data space
impl Trader {
  pub fn space(name: &str) -> usize {
    // discriminator
    8 +
    // user + performance + ranking + league
    32 + 8 + 8 + 1 +
    // name + bump
    (4 + name.len()) + 1
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
  pub sealed: bool,
  pub timeout: i64,
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
    // sealed + timeout + cid + authority + outcome + solution_cid + validations_capacity +
    1 + 8 + (4 + cid.len()) + 32 + 8 + (4 + cid.len()) + 1 +
    // vec of validations +
    4 + (validations_capacity as usize) * std::mem::size_of::<Validation>() +
    // bump
    1
  }
}
