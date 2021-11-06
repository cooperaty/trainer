use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod trainer {
    use super::*;

    pub fn create_user(ctx: Context<CreateUser>, name: String, bump: u8) -> Result<()> {
        ctx.accounts.user.name = name;
        ctx.accounts.user.authority = *ctx.accounts.authority.key;
        ctx.accounts.user.bump = bump;
        Ok(())
    }
    pub fn create_strategy(ctx: Context<CreateStrategy>, name: String) -> Result<()> {
        let given_name = name.as_bytes();
        let mut name = [0u8; 280];
        name[..given_name.len()].copy_from_slice(given_name);
        let mut strategy = ctx.accounts.strategy.load_init()?;
        strategy.name = name;
        Ok(())
    }
    pub fn check_exercise_answer(ctx: Context<CheckExerciseAnswer>, msg: String) -> Result<()> {
        let mut strategy = ctx.accounts.strategy.load_mut()?;
        strategy.append({
            let src = msg.as_bytes();
            let mut data = [0u8; 280];
            data[..src.len()].copy_from_slice(src);
            ExerciseAnswer {
                from: *ctx.accounts.user.to_account_info().key,
                data,
            }
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String, bump: u8)]
pub struct CreateUser<'info> {
    #[account(
        init,
        seeds = [authority.key().as_ref()],
        bump = bump,
        payer = authority,
        space = 320,
    )]
    user: Account<'info, User>,
    #[account(signer)]
    authority: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CreateStrategy<'info> {
    #[account(zero)]
    strategy: Loader<'info, Strategy>,
}

#[derive(Accounts)]
pub struct CheckExerciseAnswer<'info> {
    #[account(
        seeds = [authority.key().as_ref()],
        bump = user.bump,
        has_one = authority,
    )]
    user: Account<'info, User>,
    #[account(signer)]
    authority: AccountInfo<'info>,
    #[account(mut)]
    strategy: Loader<'info, Strategy>,
}

#[account]
pub struct User {
    name: String,
    authority: Pubkey,
    bump: u8,
}

#[account(zero_copy)]
pub struct Strategy {
    head: u64,
    tail: u64,
    name: [u8; 280],            // Human readable name (char bytes).
    exercise_answers: [ExerciseAnswer; 33607], // Leaves the account at 10,485,680 bytes.
}

impl Strategy {
    fn append(&mut self, msg: ExerciseAnswer) {
        self.exercise_answers[Strategy::index_of(self.head)] = msg;
        if Strategy::index_of(self.head + 1) == Strategy::index_of(self.tail) {
            self.tail += 1;
        }
        self.head += 1;
    }
    fn index_of(counter: u64) -> usize {
        std::convert::TryInto::try_into(counter % 33607).unwrap()
    }
}

#[zero_copy]
pub struct ExerciseAnswer {
    pub from: Pubkey,
    pub data: [u8; 280],
}

#[error]
pub enum ErrorCode {
    Unknown,
}
