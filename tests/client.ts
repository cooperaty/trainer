import * as anchor from '@project-serum/anchor';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = require('base-x')(BASE58)

export default class Client {
    public provider: any;
    public program: any;

    constructor(provider: any, program: any) {
        this.provider = provider;
        this.program = program;
    }
  
    async createUser(airdropBalance = 10 * anchor.web3.LAMPORTS_PER_SOL) {
      let user = anchor.web3.Keypair.generate();
      let sig = await this.provider.connection.requestAirdrop(user.publicKey, airdropBalance);
      await this.provider.connection.confirmTransaction(sig);
  
      let wallet = new anchor.Wallet(user);
      let userProvider = new anchor.Provider(this.provider.connection, wallet, this.provider.opts);
  
      return {
        key: user,
        wallet,
        provider: userProvider,
      };
    }
  
    createUsers(numUsers) {
      let promises = [];
      for(let i = 0; i < numUsers; i++) {
        promises.push(this.createUser());
      }
  
      return Promise.all(promises);
    }
  
    async getAccountBalance(pubkey) {
      let account = await this.provider.connection.getAccountInfo(pubkey);
      return account?.lamports ?? 0;
    }
  
    programForUser(user) {
      return new anchor.Program(this.program.idl, this.program.programId, user.provider);
    }
    
    async createTrader(user, name) {
      const [traderPublicKey, bump] = await anchor.web3.PublicKey.findProgramAddress([
        "trader",
        name.slice(0, 32),
        user.key.publicKey.toBytes()
      ], this.program.programId);

      let program = this.programForUser(user);
      await program.rpc.createTrader(name, bump, {
        accounts: {
          trader: traderPublicKey,
          user: user.key.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });
  
      return {publicKey: traderPublicKey, account: await program.account.trader.fetch(traderPublicKey)};
    }

    async updateTraderAccount(user, trader) {  
      let program = this.programForUser(user);
      return {publicKey: trader.publicKey, account: await program.account.trader.fetch(trader.publicKey)};
    }

    async createExercise(authority, cid, predictions_capacity = 5) {
      const [exercisePublicKey, bump] = await anchor.web3.PublicKey.findProgramAddress([
        "exercise",
        authority.key.publicKey.toBytes(),
        cid.slice(0, 32),
        cid.slice(32, 64)
      ], this.program.programId);

      let program = this.programForUser(authority);
      await program.rpc.createExercise(cid, predictions_capacity, bump, {
        accounts: {
          exercise: exercisePublicKey,
          authority: authority.key.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });
  
      return {publicKey: exercisePublicKey, account: await program.account.exercise.fetch(exercisePublicKey)};
    }

    async createMultipleExercises(authority, cids, predictions_capacity = 5) {
      const program = this.programForUser(authority);
      let instructions = [];
      let exercisesPublicKeys = [];

      for (let i = 0; i < cids.length; i++) {
        let cid = cids[i];
        let [exercisePublicKey, bump] = await anchor.web3.PublicKey.findProgramAddress([
          "exercise",
          authority.key.publicKey.toBytes(),
          cid.slice(0, 32),
          cid.slice(32, 64)
        ], this.program.programId);

        exercisesPublicKeys.push(exercisePublicKey);

        if (i < cids.length - 1) {
          instructions.push(program.instruction.createExercise(cid, predictions_capacity, bump, {
            accounts: {
              exercise: exercisePublicKey,
              authority: authority.key.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId,
            },
          }));
        } else {
          await program.rpc.createExercise(cid, predictions_capacity, bump, {
            accounts: {
              exercise: exercisePublicKey,
              authority: authority.key.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId,
            },
            instructions,
          });
        }
      }
  
      return await Promise.all(exercisesPublicKeys.map(async (exercisePublicKey): Promise<any> => { return { publicKey: exercisePublicKey, account: await program.account.exercise.fetch(exercisePublicKey) }; }));
    }

    async getExercises(user, filters) {
      let program = this.programForUser(user);

      let cmp = (offset, bytes) => { return { memcmp: { offset, bytes } }}

      let searchFilters = [];

      if ('full' in filters) searchFilters.push(cmp(8, bs58.encode(Buffer.from([filters.full ? 0x1 : 0x0]))));
      if ('cid' in filters) searchFilters.push(cmp(13, bs58.encode(Buffer.from(filters.cid))));

      let exercises = await program.account.exercise.all(searchFilters);

      return exercises;
    }

    async addPrediction(user, trader, exercise, authority, value, cid) {
      let program = this.programForUser(user);
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

    async addOutcome(exercise, authority, outcome, solution_key, cid) {
      let program = this.programForUser(authority);
      await program.rpc.addOutcome(new anchor.BN(outcome), solution_key, cid, {
        accounts: {
          exercise: exercise.publicKey,
          authority: authority.key.publicKey,
        },
      });
  
      return {publicKey: exercise.publicKey, account: await program.account.exercise.fetch(exercise.publicKey)};
    }

    async checkPrediction(user, trader, exercise, authority, index, cid) {
      let program = this.programForUser(authority);
      await program.rpc.checkPrediction(new anchor.BN(index), cid, {
        accounts: {
          exercise: exercise.publicKey,
          authority: authority.key.publicKey,
          trader: trader.publicKey, 
          user: user.key.publicKey,
        },
      });
    }

    async checkMultiplePredictions(users, traders, exercise, authority, index, cid) {
      let program = this.programForUser(authority);
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
}