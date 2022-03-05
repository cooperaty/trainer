use anchor_lang::prelude::*;

/// Emitted when an Trader is created
#[event]
pub struct NewTraderEvent {
  /// User account
  #[index]
  pub user: Pubkey,
  /// Name
  pub name: String,
  /// Timestamp of the event
  pub timestamp: i64,
}

/// Emitted when an Exercise is created
#[event]
pub struct NewExerciseEvent {
  /// CID
  #[index]
  pub cid: String,
  /// Timeout
  pub timeout: i64,
  /// Timestamp of the event
  pub timestamp: i64,
}

/// Emitted when an Validation is created
#[event]
pub struct NewValidationEvent {
  /// Exercise account
  #[index]
  pub exercise: Pubkey,
  /// User account
  #[index]
  pub user: Pubkey,
  /// Index
  pub index: u8,
  /// Value
  pub value: i64,
  /// Timestamp of the event
  pub timestamp: i64,
}

/// Emitted when all validations of an Exercise are checked
#[event]
pub struct ExerciseValidatedEvent {
  /// Exercise account
  #[index]
  pub exercise: Pubkey,
  /// Timestamp of the event
  pub timestamp: i64,
}
