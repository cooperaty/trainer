import * as anchor from '@project-serum/anchor';
import Client from './client';
const expect = require('chai').expect;

describe('trainer', () => {
    console.log("🚀 Starting test...");

    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
  
    const trainerProgram = anchor.workspace.Trainer;

    const client = new Client(provider, trainerProgram);

    const solutionKey = anchor.web3.Keypair.generate();

    it("Creates a trader", async () => {
      const user = await client.createUser();
      const trader = await client.createTrader(user, 'Trader');
      
      expect(trader.account.user.toString(), 'Trader user is set').equals(user.key.publicKey.toString());
      expect(trader.account.name, 'Trader name is set').equals('Trader');
    });

    it("Creates a exercice", async () => {
      const authority = await client.createUser();
      const exercice = await client.createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");

      expect(exercice.account.authority.toString(), 'Exercice authority is set').equals(authority.key.publicKey.toString());
      expect(exercice.account.cid, 'Exercice cid is set').equals("QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
    }); 

    it("Creates multiples exercices", async () => {
      const authority = await client.createUser();
      const cids = ["QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8t1", "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8t2", "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8t3"];
      const exercices = await client.createMultipleExercises(authority, cids);

      for (let i = 0; i < exercices.length; i++) {
        let exercice = exercices[i];
        expect(exercice.account.authority.toString(), 'Exercice authority is set').equals(authority.key.publicKey.toString());
        expect(exercice.account.cid, 'Exercice cid is set').equals(cids[i]);
      }

      const updatedExercises = await client.getExercises(authority, {full: false, cid: 'QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8t1'});
      console.log(updatedExercises);

    }); 

    it("Add a prediction", async () => {
      const authority = await client.createUser();
      const exercice = await client.createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      const user = await client.createUser();
      const trader = await client.createTrader(user, 'Trader');

      const updatedExercise = await client.addPrediction(user, trader, exercice, authority, 30, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      const predictions = updatedExercise.account.predictions;
      expect(predictions.length, 'Prediction added').greaterThan(0);
      const prediction = predictions[predictions.length - 1];
      expect(prediction.value.toNumber(), 'Prediction value is set').equals(30);
      expect(prediction.trader.toString(), 'Prediction trader is set').equals(trader.publicKey.toString());
    }); 

    it("Add a outcome", async () => {
      const authority = await client.createUser();
      const exercice = await client.createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");

      const updatedExercise = await client.addOutcome(exercice, authority, 30, solutionKey.publicKey, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      expect(updatedExercise.account.outcome.toNumber(), 'Outcome is set').equals(30);
    }); 

    it("Check a prediction", async () => {
      const authority = await client.createUser();
      const exercice = await client.createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      const user = await client.createUser();
      const trader = await client.createTrader(user, 'Trader');

      const updatedExercisePrediction = await client.addPrediction(user, trader, exercice, authority, 0, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      expect(updatedExercisePrediction.account.predictions.length, 'Prediction added').greaterThan(0);
      const updatedExerciseOutcome = await client.addOutcome(exercice, authority, 30, solutionKey.publicKey,"QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      expect(updatedExerciseOutcome.account.outcome.toNumber(), 'Outcome is set').equals(30);
      await client.checkPrediction(user, trader, exercice, authority, 0, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      const updatedTrader = await client.updateTraderAccount(user, trader);
      expect(updatedTrader.account.performance.toNumber(), 'Outcome is set').equals(35);
    }); 

    it("Check predictions", async () => {
      const predictions_capacity = 7;
      const authority = await client.createUser();
      const exercice = await client.createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW", predictions_capacity);
      const users = await client.createUsers(predictions_capacity);
      const predictions = [-100, -50, -10, 0, 10, 50, 100];
      // https://www.desmos.com/calculator/mqmwlpkyri
      const performance = [0, 10, 30, 35, 40, 40, 15];
      let traders = [];

      for (let i = 0; i < predictions_capacity; i++) {
        let user = users[i];
        let trader = await client.createTrader(user, 'Trader');

        let updatedExercisePrediction = await client.addPrediction(user, trader, exercice, authority, predictions[i], "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
        expect(updatedExercisePrediction.account.predictions.length, 'Prediction added').equals(i+1);
        
        traders.push(trader);
      }
      
      const updatedExerciseOutcome = await client.addOutcome(exercice, authority, 30, solutionKey.publicKey,"QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      expect(updatedExerciseOutcome.account.outcome.toNumber(), 'Outcome is set').equals(30);

      await client.checkMultiplePredictions(users, traders, exercice, authority, 0,"QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      
      for (let j = 0; j < predictions_capacity; j++) {
        let user = users[j];
        let trader = traders[j];
        const updatedTrader = await client.updateTraderAccount(user, trader);
        expect(updatedTrader.account.performance.toNumber(), 'Performance is set').equals(performance[j]);
      }
    }); 
  });