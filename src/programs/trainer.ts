import type { AnchorTypes } from "@saberhq/anchor-contrib";
import type { PublicKey } from "@solana/web3.js";

import type { TrainerIDL } from "../idls/trainer";

export * from "../idls/trainer";

type TrainerTypes = AnchorTypes<
  TrainerIDL,
  {
    trader: TraderAccount;
    exercise: ExerciseAccount;
    trainer: TrainerAccount;
    params: ParamsAccount;
  },
  {
    validation: ValidationStruct;
  }
>;

export type TrainerProgram = TrainerTypes["Program"];

export type ParamsAccount = TrainerTypes["Accounts"]["Params"];
export type TrainerAccount = TrainerTypes["Accounts"]["Trainer"];
export type TraderAccount = TrainerTypes["Accounts"]["Trader"];
export type ExerciseAccount = TrainerTypes["Accounts"]["Exercise"];

export type ValidationStruct = TrainerTypes["Defined"]["Validation"];

export interface ExerciseData {
  publicKey: PublicKey;
  account: ExerciseAccount;
}
export interface TraderData {
  publicKey: PublicKey;
  account: TraderAccount;
}
