import chai from "chai";

import type { ExerciseData, TraderData, TrainerSDK } from "../src";
import { SDK } from "./workspace";

const expect = chai.expect;

const CIDS = [
  "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim",
  "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevi2",
  "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevi3",
];

describe("trainer", () => {
  console.log("🚀 Starting test...");

  let sdk: TrainerSDK;
  let traderSDK: TrainerSDK;
  let botSDK: TrainerSDK;

  beforeEach(async () => {
    sdk = SDK();
    botSDK = await sdk.createSigner();
    traderSDK = await sdk.createSigner();
  });

  it("Creates a trader", async () => {
    const trader = await traderSDK.createTrader("Trader");
    expect(trader.account.user.toString(), "Trader user is set").equals(
      traderSDK.provider.wallet.publicKey.toString()
    );
    expect(trader.account.name, "Trader name is set").equals("Trader");
  });

  it("Creates a exercice", async () => {
    const exercice = await botSDK.createExercise(CIDS[0], 5);

    expect(
      exercice.account.authority.toString(),
      "Exercice authority is set"
    ).equals(botSDK.provider.wallet.publicKey.toString());
    expect(exercice.account.cid, "Exercice cid is set").equals(CIDS[0]);
  });

  it("Creates multiples exercices", async () => {
    const exercices = await botSDK.createMultipleExercises(CIDS, 5);

    for (let i = 0; i < exercices.length; i++) {
      const exercice = exercices[i];
      expect(
        exercice.account.authority.toString(),
        "Exercice authority is set"
      ).equals(botSDK.provider.wallet.publicKey.toString());
      expect(exercice.account.cid, "Exercice cid is set").equals(CIDS[i]);
    }
  });

  it.only("Add a validation", async () => {
    const exercice = await botSDK.createExercise(CIDS[0], 5);
    const trader = await traderSDK.createTrader("Trader");

    await traderSDK.addValidation(trader, exercice, 30, CIDS[0]);
    const updatedExercise = await traderSDK.reloadExercise(exercice);
    const validations = updatedExercise.account.validations;
    expect(validations.length, "Validation added").greaterThan(0);
    const validation = validations[validations.length - 1];
    expect(validation.value.toNumber(), "Validation value is set").equals(30);
    expect(validation.trader.toString(), "Validation trader is set").equals(
      trader.publicKey.toString()
    );
  });

  it("Add a outcome", async () => {
    const exercice = await botSDK.createExercise(CIDS[0], 5);

    await botSDK.addOutcome(exercice, 30, CIDS[1], CIDS[0]);
    const updatedExercise = await botSDK.reloadExercise(exercice);
    expect(updatedExercise.account.outcome.toNumber(), "Outcome is set").equals(
      30
    );
  });

  it("Check a validation", async () => {
    const exercice = await botSDK.createExercise(
      CIDS[0],
      5,
      botSDK.provider.wallet.publicKey
    );
    const trader = await traderSDK.createTrader(
      "Trader",
      traderSDK.provider.wallet.publicKey
    );

    await traderSDK.addValidation(trader, exercice, 0, CIDS[0]);
    const updatedExerciseValidation = await traderSDK.reloadExercise(exercice);
    expect(
      updatedExerciseValidation.account.validations.length,
      "Validation added"
    ).greaterThan(0);

    await botSDK.addOutcome(exercice, 30, CIDS[1], CIDS[0]);
    const updatedExerciseOutcome = await botSDK.reloadExercise(exercice);
    expect(
      updatedExerciseOutcome.account.outcome.toNumber(),
      "Outcome is set"
    ).equals(30);

    await botSDK.checkValidation(trader, exercice, 0, CIDS[0]);
    const updatedTrader = await botSDK.reloadTraderAccount(trader);
    expect(
      updatedTrader.account.performance.toNumber(),
      "Outcome is set"
    ).equals(35);
  });

  it("Check validations", async () => {
    const validations_capacity = 5;
    const exercice: ExerciseData = await botSDK.createExercise(
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

    for (let i = 0; i < validations_capacity; i++) {
      const traderISDK: TrainerSDK = traderSDKs[i];
      const trader = await traderISDK.createTrader("Trader");

      await traderISDK.addValidation(trader, exercice, validations[i], CIDS[0]);
      const updatedExerciseValidation: ExerciseData =
        await traderISDK.reloadExercise(exercice);
      expect(
        updatedExerciseValidation.account.validations.length,
        "Validation added"
      ).equals(i + 1);

      traders.push(trader);
    }

    await botSDK.addOutcome(exercice, 30, CIDS[1], CIDS[0]);
    const updatedExerciseOutcome: ExerciseData = await botSDK.reloadExercise(
      exercice
    );
    expect(
      updatedExerciseOutcome.account.outcome.toNumber(),
      "Outcome is set"
    ).equals(30);

    await botSDK.checkMultipleValidations(traders, exercice, 0, CIDS[0]);

    for (let j = 0; j < validations_capacity; j++) {
      const trader = traders[j];
      const updatedTrader = await botSDK.reloadTraderAccount(trader);
      expect(
        updatedTrader.account.performance.toNumber(),
        "Performance is set"
      ).equals(performance[j]);
    }
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
