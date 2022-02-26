import * as anchor from '@project-serum/anchor';
import { TrainerSDK } from '../src';
const expect = require('chai').expect;
import { SDK } from "./workspace";

describe('trainer', () => {
    console.log("🚀 Starting test...");

    let sdk: TrainerSDK;
    let traderSDK: TrainerSDK;
    let botSDK: TrainerSDK;
    const solutionKey = anchor.web3.Keypair.generate();

    beforeEach(async () => {
      sdk = SDK();
      botSDK = await sdk.createSigner();
      traderSDK = await sdk.createSigner();
    });

    it("Creates a trader", async () => {
      const trader = await traderSDK.createTrader('Trader');
      expect(trader.account.user.toString(), 'Trader user is set').equals(traderSDK.provider.wallet.publicKey.toString());
      expect(trader.account.name, 'Trader name is set').equals('Trader');
    });

    it("Creates a exercice", async () => {
      const exercice = await botSDK.createExercise("bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim", 5);

      expect(exercice.account.authority.toString(), 'Exercice authority is set').equals(botSDK.provider.wallet.publicKey.toString());
      expect(exercice.account.cid, 'Exercice cid is set').equals("bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
    }); 

    it("Creates multiples exercices", async () => {
      const cids = ["bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevi1", "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevi2", "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevi3"];
      const exercices = await botSDK.createMultipleExercises(cids, 5);

      for (let i = 0; i < exercices.length; i++) {
        let exercice = exercices[i];
        expect(exercice.account.authority.toString(), 'Exercice authority is set').equals(botSDK.provider.wallet.publicKey.toString());
        expect(exercice.account.cid, 'Exercice cid is set').equals(cids[i]);
      }
    }); 

    it("Add a prediction", async () => {
      const exercice = await botSDK.createExercise("bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim", 5);
      const trader = await traderSDK.createTrader('Trader');

      await traderSDK.addPrediction(trader, exercice, 30, "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
      const updatedExercise = await traderSDK.reloadExercise(exercice);
      const predictions = updatedExercise.account.predictions;
      expect(predictions.length, 'Prediction added').greaterThan(0);
      const prediction = predictions[predictions.length - 1];
      expect(prediction.value.toNumber(), 'Prediction value is set').equals(30);
      expect(prediction.trader.toString(), 'Prediction trader is set').equals(trader.publicKey.toString());
    }); 

    it("Add a outcome", async () => {
      const exercice = await botSDK.createExercise("bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim", 5);

      await botSDK.addOutcome(exercice, 30, solutionKey.publicKey, "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
      const updatedExercise = await botSDK.reloadExercise(exercice);
      expect(updatedExercise.account.outcome.toNumber(), 'Outcome is set').equals(30);
    }); 

    it("Check a prediction", async () => {
      const exercice = await botSDK.createExercise("bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim", 5, botSDK.provider.wallet.publicKey);
      const trader = await traderSDK.createTrader('Trader', traderSDK.provider.wallet.publicKey);

      await traderSDK.addPrediction(trader, exercice, 0, "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
      const updatedExercisePrediction = await traderSDK.reloadExercise(exercice);
      expect(updatedExercisePrediction.account.predictions.length, 'Prediction added').greaterThan(0);
      
      await botSDK.addOutcome(exercice, 30, solutionKey.publicKey, "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
      const updatedExerciseOutcome = await botSDK.reloadExercise(exercice);
      expect(updatedExerciseOutcome.account.outcome.toNumber(), 'Outcome is set').equals(30);
      
      await botSDK.checkPrediction(trader, exercice, 0, "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
      const updatedTrader = await botSDK.reloadTraderAccount(trader);
      expect(updatedTrader.account.performance.toNumber(), 'Outcome is set').equals(35);
    }); 

    it("Check predictions", async () => {
      const predictions_capacity = 5;
      const exercice = await botSDK.createExercise("bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim", predictions_capacity);
      const traderSDKs = await sdk.createSigners(predictions_capacity);
      const predictions = [-10, 0, 10, 50, 100];
      // https://www.desmos.com/calculator/mqmwlpkyri
      const performance = [30, 35, 40, 40, 15];
      let traders: any[] = [];

      for (let i = 0; i < predictions_capacity; i++) {
        let traderISDK = traderSDKs[i];
        let trader = await traderISDK.createTrader('Trader');

        await traderISDK.addPrediction(trader, exercice, predictions[i], "bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
        let updatedExercisePrediction: any = await traderISDK.reloadExercise(exercice);
        expect(updatedExercisePrediction.account.predictions.length, 'Prediction added').equals(i+1);
        
        traders.push(trader);
      }
      
      await botSDK.addOutcome(exercice, 30, solutionKey.publicKey,"bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
      const updatedExerciseOutcome: any = await botSDK.reloadExercise(exercice);
      expect(updatedExerciseOutcome.account.outcome.toNumber(), 'Outcome is set').equals(30);

      await botSDK.checkMultiplePredictions(traders, exercice, 0,"bafkreieuenothwt6vlex57nlj3b7olib6qlbkgquk4orwa3oas2xanevim");
      
      for (let j = 0; j < predictions_capacity; j++) {
        let trader = traders[j];
        const updatedTrader = await botSDK.reloadTraderAccount(trader);
        expect(updatedTrader.account.performance.toNumber(), 'Performance is set').equals(performance[j]);
      }
    }); 
  });


  // TODO: Add tests for the following conditions:
  // - The exercise is not found
  // - The user is not found
  // - The trader is not found
  // - The prediction is not found
  // - The prediction is already checked
  // - The prediction is not in the range allowed
  // - Same trader adds more than one prediction
  // - Same user adds more than one outcome