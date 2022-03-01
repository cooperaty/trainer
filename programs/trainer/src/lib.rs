use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use std::cmp;
use error::ErrorCode;
use state::*;

mod error;
mod state;

declare_id!("diL5RAnRPxhckzBS6SXfB79ixSrJNATqw1FqEG7Y5GD");

#[program]
pub mod trainer {
    use super::*;

    pub fn create_trader(ctx: Context<CreateTrader>, name: String) -> Result<()> {
        let trader = &mut ctx.accounts.trader;
        trader.user = *ctx.accounts.user.key;
        trader.name = name;

        match ctx.bumps.get("trader") {
            Some(&bump) => { trader.bump = bump; }
            None => { return Err(ErrorCode::BumpNotFound.into()); }
        }

        msg!("[TRAD] E: {}", &*trader.to_account_info().key.to_string());
        Ok(())
    }

    pub fn create_exercise(ctx: Context<CreateExercise>, cid: String, validations_capacity: u8, timeout: i64) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        exercise.full = false;
        exercise.cid = cid;
        exercise.authority = *ctx.accounts.authority.key;
        exercise.validations_capacity = validations_capacity;
        exercise.timeout = timeout;

        match ctx.bumps.get("exercise") {
            Some(&bump) => { exercise.bump = bump; }
            None => { return Err(ErrorCode::BumpNotFound.into()); }
        }

        msg!("[EXER] E: {}", exercise.cid);
        Ok(())
    }

    pub fn add_validation(ctx: Context<AddValidation>, value: i64, cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        let trader = &mut ctx.accounts.trader;
        let user = &mut ctx.accounts.user;
        let clock = Clock::get()?;

        // check if the exercise is full
        if exercise.full {
            return Err(ErrorCode::ExerciseFull.into());
        }

        // check if the exercise is still active
        if exercise.timeout < clock.unix_timestamp {
            return Err(ErrorCode::ExerciseTimeout.into());
        }
        
        // check user have not already added a validation
        for validation in exercise.validations.iter() {
            if validation.user == *user.to_account_info().key {
                return Err(ErrorCode::DuplicatedValidation.into());
            }
        }
        
        // add the validation to the exercise
        let validation = Validation {
            value,
            trader: *trader.to_account_info().key,
            user: *user.to_account_info().key,
        };
        exercise.validations.push(validation);

        msg!("[PRED] E: {} P: {} I: {}", cid, value, exercise.validations.len() - 1);
        Ok(())
    }

    pub fn add_outcome(ctx: Context<AddOutcome>, outcome: i64, solution_cid: String, cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        exercise.outcome = outcome;
        exercise.solution_cid = solution_cid;

        msg!("[OUTCOME] E: {} Ps: {} O: {}", cid, outcome, exercise.validations.len());
        Ok(())
    }

    pub fn check_validation(ctx: Context<CheckValidation>, index: u8, _cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        let authority = &ctx.accounts.authority;
        let trader = &mut ctx.accounts.trader;
        let validation = exercise.validations.get(index as usize).ok_or_else(|| ErrorCode::InvalidValidationIndex)?;

        // if trader is not the validation's trader, then the validation is invalid
        if *trader.to_account_info().key != validation.trader {
            return Err(ErrorCode::WrongValidationIndex.into());
        }
        
        let rate = cmp::max(100-(validation.value - exercise.outcome).abs(), 0) as u64;
        let performance = (trader.performance + rate) / 2;
        trader.performance = performance;

        msg!("[CHECK] E: {} PP: {} PV: {}", index, performance, validation.value);
        
        // remove the validation from the exercise to assure that it is not checked again
        exercise.validations.remove(index as usize);
        
        if exercise.validations.len() == 0 {
            exercise.close(authority.to_account_info())?;
        }

        Ok(())
    }
}

// Function to retrieve a max of 32 bytes from a string
// Used to generate a PDA
fn text_seed(text: &str, leftover: bool) -> &[u8] {
    let b = text.as_bytes();
    if b.len() > 32 {
        if leftover {
            if b.len() > 64 {
                &b[32..64]
            } else {
                &b[32..] 
            }
        } else {
            &b[0..32]
        }
    } else {
        b
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateTrader<'info> {
    #[account(
        init,
        payer = user,
        seeds = [
            b"trader",
            text_seed(&name, false),
            user.to_account_info().key.as_ref()],
        bump,
        space = Trader::space(&name),
    )]
    pub trader: Account<'info, Trader>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(cid: String, validations_capacity: u8, timeout: i64)]
pub struct CreateExercise<'info> {
    #[account(
        init,
        seeds = [
            b"exercise", 
            authority.to_account_info().key.as_ref(),
            text_seed(&cid, false),
            text_seed(&cid, true)],
        bump,
        payer = authority,
        space = Exercise::space(&cid, validations_capacity),
    )]
    pub exercise: Account<'info, Exercise>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(value: i64, cid: String)]
pub struct AddValidation<'info> {
    #[account(mut, 
        seeds = [
            b"exercise", 
            exercise.authority.as_ref(),
            text_seed(&cid, false),
            text_seed(&cid, true)],
        bump=exercise.bump)]
    pub exercise: Account<'info, Exercise>,
    #[account(mut, 
        has_one = user @ ErrorCode::WrongUser, 
        seeds = [
            b"trader",
            text_seed(&trader.name, false), 
            user.key().as_ref()],
        bump=trader.bump)]
    pub trader: Account<'info, Trader>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(outcome: i64, solution_cid: String, cid: String)]
pub struct AddOutcome<'info> {
    #[account(mut, 
        has_one = authority @ ErrorCode::WrongExerciseCreator, 
        seeds = [
            b"exercise", 
            authority.to_account_info().key.as_ref(),
            text_seed(&cid, false),
            text_seed(&cid, true)],
        bump=exercise.bump)]
    pub exercise: Account<'info, Exercise>,
    pub authority: Signer<'info>
}

#[derive(Accounts)]
#[instruction(index: u8, cid: String)]
pub struct CheckValidation<'info> {
    #[account(mut, 
        has_one = authority @ ErrorCode::WrongExerciseCreator, 
        seeds = [
            b"exercise", 
            authority.key().as_ref(),
            text_seed(&cid, false),
            text_seed(&cid, true)],
        bump=exercise.bump)]
    pub exercise: Account<'info, Exercise>,
    pub authority: Signer<'info>,
    #[account(mut, 
        seeds = [
            b"trader", 
            text_seed(&trader.name, false), 
            trader.user.as_ref()],
        bump=trader.bump)]
    pub trader: Account<'info, Trader>,
}