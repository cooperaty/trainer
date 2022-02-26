import type { AnchorTypes } from "@saberhq/anchor-contrib";

import type { TrainerIDL } from "../idls/trainer";

export * from "../idls/trainer";

type TrainerTypes = AnchorTypes<
  TrainerIDL,
  {
    trader: TraderAccount;
    exercise: ExerciseAccount;
  },
  {
    prediction: Prediction;
  }
>;

export type TraderAccount = TrainerTypes["Accounts"]["Trader"];
export type ExerciseAccount = TrainerTypes["Accounts"]["Exercise"];
export type Prediction = TrainerTypes["Defined"]["Prediction"];
export type TrainerProgram = TrainerTypes["Program"];
