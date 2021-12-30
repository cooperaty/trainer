import * as anchor from '@project-serum/anchor';
const BN = require('bn.js');
const expect = require('chai').expect;
const { PublicKey, SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;
const assert = require("assert");

describe('trainer', () => {
    console.log("🚀 Starting test...");

    // Configure the client to use the local cluster.
    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
  
    // Program client handle.
    const trainerProgram = anchor.workspace.Trainer;

    function expectBalance(actual, expected, message, slack=20000) {
      expect(actual, message).within(expected - slack, expected + slack)
    }
  
    async function createUser(airdropBalance = 10 * LAMPORTS_PER_SOL) {
      let user = anchor.web3.Keypair.generate();
      let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
      await provider.connection.confirmTransaction(sig);
  
      let wallet = new anchor.Wallet(user);
      let userProvider = new anchor.Provider(provider.connection, wallet, provider.opts);
  
      return {
        key: user,
        wallet,
        provider: userProvider,
      };
    }
  
    function createUsers(numUsers) {
      let promises = [];
      for(let i = 0; i < numUsers; i++) {
        promises.push(createUser());
      }
  
      return Promise.all(promises);
    }
  
    async function getAccountBalance(pubkey) {
      let account = await provider.connection.getAccountInfo(pubkey);
      return account?.lamports ?? 0;
    }
  
    function programForUser(user) {
      return new anchor.Program(trainerProgram.idl, trainerProgram.programId, user.provider);
    }
    
    async function createTrader(user, name) {
      const [traderPublicKey, bump] = await anchor.web3.PublicKey.findProgramAddress([
        "trader",
        name.slice(0, 32),
        user.key.publicKey.toBytes()
      ], trainerProgram.programId);

      let program = programForUser(user);
      await program.rpc.createTrader(name, bump, {
        accounts: {
          trader: traderPublicKey,
          user: user.key.publicKey,
          systemProgram: SystemProgram.programId,
        },
      });
  
      return {publicKey: traderPublicKey, account: await program.account.trader.fetch(traderPublicKey)};
    }

    async function updateTraderAccount(user, trader) {  
      let program = programForUser(user);
      return {publicKey: trader.publicKey, account: await program.account.trader.fetch(trader.publicKey)};
    }

    async function createExercise(authority, cid, predictions_capacity = 5) {
      const [exercisePublicKey, bump] = await anchor.web3.PublicKey.findProgramAddress([
        "exercise",
        authority.key.publicKey.toBytes(),
        cid.slice(0, 32)
      ], trainerProgram.programId);

      let program = programForUser(authority);
      await program.rpc.createExercise(cid, predictions_capacity, bump, {
        accounts: {
          exercise: exercisePublicKey,
          authority: authority.key.publicKey,
          systemProgram: SystemProgram.programId,
        },
      });
  
      return {publicKey: exercisePublicKey, account: await program.account.exercise.fetch(exercisePublicKey)};
    }

    async function addPrediction(user, trader, exercise, authority, value, cid) {
      let program = programForUser(user);
      await program.rpc.addPrediction(new anchor.BN(value), cid, {
        accounts: {
          exercise: exercise.publicKey,
          authority: authority.key.publicKey,
          trader: trader.publicKey,
          user: user.key.publicKey,
        },
      });
  
      return {publicKey: exercise.publicKey, account: await program.account.exercise.fetch(exercise.publicKey)};
    }

    async function addOutcome(exercise, authority, outcome, cid) {
      let program = programForUser(authority);
      await program.rpc.addOutcome(new anchor.BN(outcome), cid, {
        accounts: {
          exercise: exercise.publicKey,
          authority: authority.key.publicKey,
        },
      });
  
      return {publicKey: exercise.publicKey, account: await program.account.exercise.fetch(exercise.publicKey)};
    }

    async function checkPrediction(user, trader, exercise, authority, index, cid) {
      let program = programForUser(authority);
      await program.rpc.checkPrediction(new anchor.BN(index), cid, {
        accounts: {
          exercise: exercise.publicKey,
          authority: authority.key.publicKey,
          trader: trader.publicKey, 
          user: user.key.publicKey,
        },
      });
    }

    async function checkMultiplePredictions(users, traders, exercise, authority, index, cid) {
      let program = programForUser(authority);
      let instructions = [];
      let lastTraderIndex = users.length - 1;

      for(let i = 0; i < lastTraderIndex; i++) {
        instructions.push(program.instruction.checkPrediction(new anchor.BN(index), cid, {
          accounts: {
            exercise: exercise.publicKey,
            authority: authority.key.publicKey,
            trader: traders[i].publicKey, 
            user: users[i].key.publicKey,
        }}));
      }

      await program.rpc.checkPrediction(new anchor.BN(index), cid, {
        accounts: {
          exercise: exercise.publicKey,
          authority: authority.key.publicKey,
          trader: traders[lastTraderIndex].publicKey, 
          user: users[lastTraderIndex].key.publicKey,
        },
        instructions,
      });
    }

    it("Creates a trader", async () => {
      const user = await createUser();
      const trader = await createTrader(user, 'Trader');
      
      expect(trader.account.user.toString(), 'Trader user is set').equals(user.key.publicKey.toString());
      expect(trader.account.name, 'Trader name is set').equals('Trader');
    });

    it("Creates a exercice", async () => {
      const authority = await createUser();
      const exercice = await createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");

      expect(exercice.account.authority.toString(), 'Exercice authority is set').equals(authority.key.publicKey.toString());
      expect(exercice.account.cid, 'Exercice cid is set').equals("QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
    }); 

    it("Add a prediction", async () => {
      const authority = await createUser();
      const exercice = await createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      const user = await createUser();
      const trader = await createTrader(user, 'Trader');

      const updatedExercise = await addPrediction(user, trader, exercice, authority, 30, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      const predictions = updatedExercise.account.predictions;
      expect(predictions.length, 'Prediction added').greaterThan(0);
      const prediction = predictions[predictions.length - 1];
      expect(prediction.value.toNumber(), 'Prediction value is set').equals(30);
      expect(prediction.trader.toString(), 'Prediction trader is set').equals(trader.publicKey.toString());
    }); 

    it("Add a outcome", async () => {
      const authority = await createUser();
      const exercice = await createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");

      const updatedExercise = await addOutcome(exercice, authority, 30, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      expect(updatedExercise.account.outcome.toNumber(), 'Outcome is set').equals(30);
    }); 

    it("Check a prediction", async () => {
      const authority = await createUser();
      const exercice = await createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      const user = await createUser();
      const trader = await createTrader(user, 'Trader');

      const updatedExercisePrediction = await addPrediction(user, trader, exercice, authority, 20, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      expect(updatedExercisePrediction.account.predictions.length, 'Prediction added').greaterThan(0);
      const updatedExerciseOutcome = await addOutcome(exercice, authority, 30, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      expect(updatedExerciseOutcome.account.outcome.toNumber(), 'Outcome is set').equals(30);
      await checkPrediction(user, trader, exercice, authority, 0, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      const updatedTrader = await updateTraderAccount(user, trader);
      expect(updatedTrader.account.performance.toNumber(), 'Outcome is set').equals(8);
    }); 

    it("Check predictions", async () => {
      const predictions_capacity = 7;
      const authority = await createUser();
      const exercice = await createExercise(authority, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW", predictions_capacity);
      const users = await createUsers(predictions_capacity);
      const predictions = [-100, -50, -10, 0, 10, 50, 100];
      // https://www.desmos.com/calculator/mqmwlpkyri
      const performance = [0, 10, 30, 35, 40, 40, 15];
      let traders = [];

      for (let i = 0; i < predictions_capacity; i++) {
        let user = users[i];
        let trader = await createTrader(user, 'Trader');

        let updatedExercisePrediction = await addPrediction(user, trader, exercice, authority, predictions[i], "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
        expect(updatedExercisePrediction.account.predictions.length, 'Prediction added').equals(i+1);
        
        traders.push(trader);
      }
      
      const updatedExerciseOutcome = await addOutcome(exercice, authority, 30, "QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      expect(updatedExerciseOutcome.account.outcome.toNumber(), 'Outcome is set').equals(30);

      await checkMultiplePredictions(users, traders, exercice, authority, 0,"QmZmcRLEftCgd8AwsS8hKYSVPtFuEXy6cgWJqL1LEVj8tW");
      
      for (let j = 0; j < predictions_capacity; j++) {
        let user = users[j];
        let trader = traders[j];
        const updatedTrader = await updateTraderAccount(user, trader);
        expect(updatedTrader.account.performance.toNumber(), 'Performance is set').equals(performance[j]);
      }
    }); 
  });