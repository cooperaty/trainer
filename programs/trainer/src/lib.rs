use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use std::cmp;
use error::ErrorCode;
use events::*;
use utils::*;
use state::*;

mod events;
mod error;
mod state;
mod utils;

declare_id!("E736fby166Ekp8cpTGbZPRFBZV6yq93xy4mMrXHEv22S");

#[program]
pub mod trainer {
    use super::*;

    pub fn create_trader(ctx: Context<CreateTrader>, name: String) -> Result<()> {
        let trader = &mut ctx.accounts.trader;
        trader.user = *ctx.accounts.user.key;
        trader.name = name.clone();

        match ctx.bumps.get("trader") {
            Some(&bump) => { trader.bump = bump; }
            None => { return Err(ErrorCode::BumpNotFound.into()); }
        }

        emit!(NewTraderEvent {
            user: *ctx.accounts.user.key,
            name: name,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn create_exercise(ctx: Context<CreateExercise>, cid: String, validations_capacity: u8, timeout: i64) -> Result<()> {
        if validations_capacity < 1 {
            return Err(ErrorCode::ValidationsCapacityTooSmall.into());
        }
        if Clock::get()?.unix_timestamp > timeout {
            return Err(ErrorCode::ExpiredTimeout.into());
        }
        
        let exercise = &mut ctx.accounts.exercise;
        exercise.sealed = false;
        exercise.cid = cid.clone();
        exercise.authority = *ctx.accounts.authority.key;
        exercise.validations_capacity = validations_capacity;
        exercise.timeout = timeout;

        match ctx.bumps.get("exercise") {
            Some(&bump) => { exercise.bump = bump; }
            None => { return Err(ErrorCode::BumpNotFound.into()); }
        }

        emit!(NewExerciseEvent {
            cid: cid,
            timeout: timeout,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn add_validation(ctx: Context<AddValidation>, value: i64, _cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        let trader = &mut ctx.accounts.trader;
        let user = &mut ctx.accounts.user;
        let clock = Clock::get()?;

        // Check if the exercise is sealed
        if exercise.sealed {
            return Err(ErrorCode::ExerciseSealed.into());
        }

        // Check if the exercise is still active
        if exercise.timeout < clock.unix_timestamp {
            exercise.sealed = true;
            return Err(ErrorCode::ExerciseTimeout.into());
        }
        
        // Check user have not already added a validation
        for validation in exercise.validations.iter() {
            if validation.user == *user.to_account_info().key {
                return Err(ErrorCode::DuplicatedValidation.into());
            }
        }
        
        // Add the validation to the exercise
        exercise.validations.push(Validation {
            value,
            trader: *trader.to_account_info().key,
            user: *user.to_account_info().key,
        });

        if exercise.validations.len() as u8 == exercise.validations_capacity {
            exercise.sealed = true;
        }

        emit!(NewValidationEvent {
            exercise: *exercise.to_account_info().key,
            user: *user.to_account_info().key,
            value: value,
            index: exercise.validations.len() as u8,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn add_outcome(ctx: Context<AddOutcome>, outcome: i64, _cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        exercise.outcome = outcome;
        Ok(())
    }

    pub fn check_validation(ctx: Context<CheckValidation>, index: u8, _cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        let authority = &ctx.accounts.authority;
        let trader = &mut ctx.accounts.trader;
        let validation = exercise.validations.get(index as usize).ok_or_else(|| ErrorCode::InvalidValidationIndex)?;

        // If trader is not the validation's trader, then the validation is invalid
        if *trader.to_account_info().key != validation.trader {
            return Err(ErrorCode::WrongValidationIndex.into());
        }
        
        let rate = cmp::max(100-(validation.value - exercise.outcome).abs(), 0) as u64;
        let performance = (trader.performance + rate) / 2;
        trader.performance = performance;
        
        // Remove the validation from the exercise to assure that it is not checked again
        exercise.validations.remove(index as usize);
        
        if exercise.validations.len() == 0 {
            emit!(ExerciseValidatedEvent {
                exercise: *exercise.to_account_info().key,
                timestamp: Clock::get()?.unix_timestamp,
            });
            exercise.close(authority.to_account_info())?;
        }

        Ok(())
    }

    pub fn close_exercise(ctx: Context<CloseExercise>, _cid: String) -> Result<()> {
        let exercise = &mut ctx.accounts.exercise;
        exercise.close(ctx.accounts.authority.to_account_info())?;
        Ok(())
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
#[instruction(outcome: i64, cid: String)]
pub struct AddOutcome<'info> {
    #[account(mut, 
        has_one = authority @ ErrorCode::WrongExerciseCreator, 
        seeds = [
            b"exercise", 
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

#[derive(Accounts)]
#[instruction(cid: String)]
pub struct CloseExercise<'info> {
    #[account(mut, 
        has_one = authority @ ErrorCode::WrongExerciseCreator, 
        seeds = [
            b"exercise", 
            text_seed(&cid, false),
            text_seed(&cid, true)],
        bump=exercise.bump)]
    pub exercise: Account<'info, Exercise>,
    pub authority: Signer<'info>,
}