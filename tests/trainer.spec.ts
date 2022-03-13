import chai from "chai";

import type { ExerciseData, TraderData, TrainerSDK } from "../src";
import { SDK } from "./workspace";

const expect = chai.expect;

const BASECID = "bafkreigyzpenio53l3z4f5l2rkwkjcbjnbgi7mfom6uaf2jczhdnbfktxu";

const getRandomCIDs = (amount: number) => {
  return Array(amount)
    .fill(BASECID)
    .map(
      (cid: string) =>
        cid.slice(0, 50) + Math.random().toString(12).substring(2, 10)
    );
};

const TIMEOUT_24H = new Date().getTime() + 60 * 60 * 24;

describe("trainer", () => {
  console.log("🚀 Starting test...");

  let sdk: TrainerSDK;
  let traderSDK: TrainerSDK;
  let botSDK: TrainerSDK;
  let CIDS: string[];

  before(async () => {
    sdk = SDK();
    await sdk.initializeParams(5);
  });

  beforeEach(async () => {
    botSDK = await sdk.createSigner();
    traderSDK = await sdk.createSigner();
    CIDS = getRandomCIDs(5);
    await sdk.createTrainer(botSDK.provider.wallet.publicKey);
  });

  it("Creates a trader", async () => {
    const trader = await traderSDK.createTrader("Trader");
    expect(trader.account.user.toString(), "Trader user is set").equals(
      traderSDK.provider.wallet.publicKey.toString()
    );
    expect(trader.account.name, "Trader name is set").equals("Trader");
  });

  it("Creates a exercise", async () => {
    const exercise = await botSDK.createExercise(CIDS[0], 5, TIMEOUT_24H);

    expect(
      exercise.account.authority.toString(),
      "Exercise authority is set"
    ).equals(botSDK.provider.wallet.publicKey.toString());
    expect(exercise.account.cid, "Exercise cid is set").equals(CIDS[0]);
    expect(exercise.account.timeout.toNumber(), "Exercise cid is set").equals(
      TIMEOUT_24H
    );
  });

  it("Creates multiples exercises", async () => {
    const exercises = await botSDK.createMultipleExercises(CIDS, 5);

    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      expect(
        exercise.account.authority.toString(),
        "Exercise authority is set"
      ).equals(botSDK.provider.wallet.publicKey.toString());
      expect(exercise.account.cid, "Exercise cid is set").equals(CIDS[i]);
    }
  });

  it("Add a validation", async () => {
    const exercise = await botSDK.createExercise(CIDS[0], 5);
    const trader = await traderSDK.createTrader("Trader");

    await traderSDK.addValidation(trader, exercise, 30);
    const updatedExercise = await traderSDK.reloadExercise(exercise);
    const validations = updatedExercise.account.validations;
    expect(validations.length, "Validation added").greaterThan(0);
    const validation = validations[validations.length - 1];
    expect(validation.value.toNumber(), "Validation value is set").equals(30);
    expect(validation.trader.toString(), "Validation trader is set").equals(
      trader.publicKey.toString()
    );
  });

  it("Add a outcome", async () => {
    const exercise = await botSDK.createExercise(CIDS[0], 5);

    await botSDK.addOutcome(exercise, 30);
    const updatedExercise = await botSDK.reloadExercise(exercise);
    expect(updatedExercise.account.outcome.toNumber(), "Outcome is set").equals(
      30
    );
  });

  it("Check a validation", async () => {
    const exercise = await botSDK.createExercise(CIDS[0], 5);
    const trader = await traderSDK.createTrader(
      "Trader",
      traderSDK.provider.wallet.publicKey
    );

    await traderSDK.addValidation(trader, exercise, 0);
    const updatedExerciseValidation = await traderSDK.reloadExercise(exercise);
    expect(
      updatedExerciseValidation.account.validations.length,
      "Validation added"
    ).greaterThan(0);

    await botSDK.addOutcome(exercise, 30);
    const updatedExerciseOutcome = await botSDK.reloadExercise(exercise);
    expect(
      updatedExerciseOutcome.account.outcome.toNumber(),
      "Outcome is set"
    ).equals(30);

    await botSDK.checkValidation(trader, exercise, 0);
    const updatedTrader = await botSDK.reloadTraderAccount(trader);
    expect(
      updatedTrader.account.performance.toNumber(),
      "Outcome is set"
    ).equals(35);
  });

  it("Check validations", async () => {
    const validations_capacity = 5;
    const exercise: ExerciseData = await botSDK.createExercise(
      CIDS[0],
      validations_capacity
    );
    const traderSDKs: TrainerSDK[] = await sdk.createMultipleSigners(
      validations_capacity
    );
    const validations = [-10, 0, 10, 50, 100];
    // https://www.desmos.com/calculator/mqmwlpkyri
    const performance = [30, 35, 40, 40, 15];
    const traders: TraderData[] = [];

    // onChange
    traderSDKs[0].onExerciseChange(
      exercise.publicKey,
      (exercise: ExerciseData["account"]) => {
        expect(
          exercise.validations.length,
          "Validation correctly loaded"
        ).lessThanOrEqual(validations_capacity);
      }
    );

    for (let i = 0; i < validations_capacity; i++) {
      const traderISDK: TrainerSDK = traderSDKs[i];
      const trader = await traderISDK.createTrader("Trader");

      await traderISDK.addValidation(trader, exercise, validations[i]);
      const updatedExerciseValidation: ExerciseData =
        await traderISDK.reloadExercise(exercise);
      expect(
        updatedExerciseValidation.account.validations.length,
        "Validation added"
      ).equals(i + 1);

      traders.push(trader);
    }

    await botSDK.addOutcome(exercise, 30);
    const updatedExerciseOutcome: ExerciseData = await botSDK.reloadExercise(
      exercise
    );
    expect(
      updatedExerciseOutcome.account.outcome.toNumber(),
      "Outcome is set"
    ).equals(30);

    await botSDK.checkAllValidations(exercise);

    for (let j = 0; j < validations_capacity; j++) {
      const trader = traders[j];
      const updatedTrader = await botSDK.reloadTraderAccount(trader);
      expect(
        updatedTrader.account.performance.toNumber(),
        "Performance is set"
      ).equals(performance[j]);
    }
  });

  it("Close exercise", async () => {
    const exercise = await botSDK.createExercise(CIDS[0], 5);

    await botSDK.closeExercise(exercise, botSDK.provider.wallet.publicKey);
  });
});

// TODO: Add tests for the following conditions:
// - The exercise is not found
// - The user is not found
// - The trader is not found
// - The validation is not found
// - The validation is already checked
// - The validation is not in the range allowed
// - Same trader adds more than one validation
// - Same user adds more than one outcome
