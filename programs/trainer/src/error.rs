use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
  #[msg("Wrong authority")]
  WrongAuthority,
  #[msg("Validations capacity too small, must be greater than 0")]
  ValidationsCapacityTooSmall,
  #[msg("Expired timeout, it must be in the future")]
  ExpiredTimeout,
  #[msg("Specified exercise creator does not match the pubkey in the exercise")]
  WrongExerciseCreator,
  #[msg("Specified user does not match the pubkey in the trader")]
  WrongUser,
  #[msg("Specified validation index does not match the pubkey in the trader")]
  WrongValidationIndex,
  #[msg("Trader have already added a validation")]
  DuplicatedValidation,
  #[msg("Invalid validation index")]
  InvalidValidationIndex,
  #[msg("Bump not found")]
  BumpNotFound,
  #[msg("Exercise timeout")]
  ExerciseTimeout,
  #[msg("Exercise sealed")]
  ExerciseSealed,
}
