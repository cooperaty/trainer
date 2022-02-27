use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
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
}
