use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use std::cmp;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod trainer {
    use super::*;

    pub fn create_trader(ctx: Context<CreateTrader>, name: String, bump: u8) -> Result<()> {
        let trader = &mut ctx.accounts.trader;
        trader.user = *ctx.accounts.user.key;
        trader.name = name;
        trader.bump = bump;

        msg!("[TRAD] E: {}", &*trader.to_account_info().key.to_string());
        Ok(())
    }

    pub fn create_exercise(ctx: Context<CreateExercise>, cid: String, predictions_capacity: u8, bump: u8) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        exercise.full = false;
        exercise.cid = cid;
        exercise.authority = *ctx.accounts.authority.key;
        exercise.predictions_capacity = predictions_capacity;
        exercise.bump = bump;

        msg!("[EXER] E: {}", exercise.cid);
        Ok(())
    }

    pub fn add_prediction(ctx: Context<AddPrediction>, value: i64, cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        let trader = &mut ctx.accounts.trader;
        
        // check user have not already added a prediction
        for prediction in exercise.predictions.iter() {
            if prediction.trader == *trader.to_account_info().key {
                return Err(ErrorCode::DuplicatedPrediction.into());
            }
        }
        
        // add the prediction to the exercise
        let prediction = Prediction {
            value,
            trader: *trader.to_account_info().key,
        };
        exercise.predictions.push(prediction);

        msg!(&*trader.to_account_info().key.to_string());
        msg!("[PRED] E: {} P: {} I: {}", cid, value, exercise.predictions.len() - 1);

        Ok(())
    }

    pub fn add_outcome(ctx: Context<AddOutcome>, outcome: i64, cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        exercise.outcome = outcome;

        msg!("[OUTCOME] E: {} Ps: {} O: {}", cid, outcome, exercise.predictions.len());

        Ok(())
    }

    pub fn check_prediction(ctx: Context<CheckPrediction>, index: u8, _cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        let authority = &ctx.accounts.authority;
        let trader = &mut ctx.accounts.trader;
        let prediction = exercise.predictions.get(index as usize).ok_or_else(|| ErrorCode::InvalidPredictionIndex)?;

        // if trader is not the prediction's trader, then the prediction is invalid
        if *trader.to_account_info().key != prediction.trader {
            return Err(ErrorCode::WrongPredictionIndex.into());
        }
        
        let rate = cmp::max(100-(prediction.value - exercise.outcome).abs(), 0) as u64;
        let performance = (trader.performance + rate) / 2;
        trader.performance = performance;

        msg!("[CHECK] E: {} PP: {} PV: {}", index, performance, prediction.value);
        
        // remove the prediction from the exercise to assure that it is not checked again
        exercise.predictions.remove(index as usize);
        
        if exercise.predictions.len() == 0 {
            exercise.close(authority.to_account_info())?;
        }

        Ok(())
    }
}

// Function to retrieve a max of 32 bytes from a string
// Used to generate a PDA
fn text_seed(text: &str) -> &[u8] {
    let b = text.as_bytes();
    if b.len() > 32 {
        &b[0..32]
    } else {
        b
    }
}

#[derive(Accounts)]
#[instruction(name: String, bump: u8)]
pub struct CreateTrader<'info> {
    #[account(
        init,
        payer = user,
        seeds = [
            b"trader",
            text_seed(&name),
            user.to_account_info().key.as_ref()],
        bump = bump,
        space = Trader::space(&name),
    )]
    pub trader: Account<'info, Trader>,
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(cid: String, predictions_capacity: u8, bump: u8)]
pub struct CreateExercise<'info> {
    #[account(
        init,
        seeds = [
            b"exercise", 
            authority.to_account_info().key.as_ref(),
            text_seed(&cid)],
        bump = bump,
        payer = authority,
        space = Exercise::space(&cid, predictions_capacity),
    )]
    pub exercise: Account<'info, Exercise>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(value: i64, cid: String)]
pub struct AddPrediction<'info> {
    #[account(mut, 
        has_one = authority @ ErrorCode::WrongExerciseCreator, 
        seeds = [
            b"exercise", 
            authority.key().as_ref(),
            text_seed(&cid)],
        bump=exercise.bump)]
    pub exercise: Account<'info, Exercise>,
    pub authority: AccountInfo<'info>,
    #[account(mut, 
        has_one = user @ ErrorCode::WrongUser, 
        seeds = [
            b"trader",
            text_seed(&trader.name), 
            user.key().as_ref()],
        bump=trader.bump)]
    pub trader: Account<'info, Trader>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(outcome: i64, cid: String)]
pub struct AddOutcome<'info> {
    #[account(mut, 
        has_one = authority @ ErrorCode::WrongExerciseCreator, 
        seeds = [
            b"exercise", 
            authority.to_account_info().key.as_ref(),
            text_seed(&cid)],
        bump=exercise.bump)]
    pub exercise: Account<'info, Exercise>,
    pub authority: Signer<'info>
}

#[derive(Accounts)]
#[instruction(index: u8, cid: String)]
pub struct CheckPrediction<'info> {
    #[account(mut, 
        has_one = authority @ ErrorCode::WrongExerciseCreator, 
        seeds = [
            b"exercise", 
            authority.key().as_ref(),
            text_seed(&cid)],
        bump=exercise.bump)]
    pub exercise: Account<'info, Exercise>,
    pub authority: Signer<'info>,
    #[account(mut, 
        has_one = user @ ErrorCode::WrongUser, 
        seeds = [
            b"trader", 
            text_seed(&trader.name), 
            user.key().as_ref()],
        bump=trader.bump)]
    pub trader: Account<'info, Trader>,
    pub user: AccountInfo<'info>,
}

#[account]
pub struct Trader {
    pub user: Pubkey,
    pub name: String,
    pub performance: u64,
    pub bump: u8,
}

// Calculate the trader's data space
impl Trader {
    fn space(name: &str) -> usize {
        // discriminator
        8 +
        // user + name + performance + bump
        32 + (4 + name.len()) + 8 + 1
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct Prediction {
    pub value: i64,
    pub trader: Pubkey,
}

#[account]
pub struct Exercise {
    pub full: bool,
    pub cid: String,
    pub authority: Pubkey,
    pub outcome: i64,
    pub predictions_capacity: u8,
    pub predictions: Vec<Prediction>,
    pub bump: u8,
}

// Calculate the vote's data space
impl Exercise {
    fn space(cid: &str, predictions_capacity: u8) -> usize {
        // discriminator
        8 +
        // full + cid + authority + outcome + predictions_capacity +
        1 + (4 + cid.len()) + 32 + 8 + 1 +
        // vec of predictions +
        4 + (predictions_capacity as usize) * std::mem::size_of::<Prediction>() +
        // bump
        1
    }
}

#[error]
pub enum ErrorCode {
    #[msg("Specified exercise creator does not match the pubkey in the exercise")]
    WrongExerciseCreator,
    #[msg("Specified user does not match the pubkey in the trader")]
    WrongUser,
    #[msg("Specified prediction index does not match the pubkey in the trader")]
    WrongPredictionIndex,
    #[msg("Trader have already added a prediction")]
    DuplicatedPrediction,
    #[msg("Invalid prediction index")]
    InvalidPredictionIndex
}
