import * as anchor from '@project-serum/anchor';
const { PublicKey } = anchor.web3;
const assert = require("assert");

describe('trainer', () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.Provider.env());
  
    // Program client handle.
    const program = anchor.workspace.Trainer;
  
    // Strategy account.
    const strategy = anchor.web3.Keypair.generate();

    // Strategy name.
    const strategyName = "test-strategy";
  
    it("Creates a strategy", async () => {
      await program.rpc.createStrategy(strategyName, {
        accounts: {
          strategy: strategy.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        instructions: [
          await program.account.strategy.createInstruction(strategy),
        ],
        signers: [strategy],
      });
  
      const testStrategy = await program.account.strategy.fetch(strategy.publicKey);
      const name = new TextDecoder("utf-8").decode(new Uint8Array(testStrategy.name));
      assert.ok(name.startsWith(strategyName)); // [u8; 280] => trailing zeros.
      assert.ok(testStrategy.exerciseAnswers.length === 33607);
      assert.ok(testStrategy.head.toNumber() === 0);
      assert.ok(testStrategy.tail.toNumber() === 0);
    });
  
    it("Creates a user", async () => {
      const authority = program.provider.wallet.publicKey;
      const [user, bump] = await PublicKey.findProgramAddress(
        [authority.toBuffer()],
        program.programId
      );
      await program.rpc.createUser("My User", bump, {
        accounts: {
          user,
          authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });
      const account = await program.account.user.fetch(user);
      assert.ok(account.name === "My User");
      assert.ok(account.authority.equals(authority));
    });
  
    it("Sends exercise answers", async () => {
      const authority = program.provider.wallet.publicKey;
      const user = (
        await PublicKey.findProgramAddress(
          [authority.toBuffer()],
          program.programId
        )
      )[0];
  
      // Only send a couple exercise answers so the test doesn't take an eternity.
      const numExerciseAnswers = 10;
  
      // Generate random exercise answers strings.
      const exerciseAnswers = new Array(numExerciseAnswers).fill("").map((msg) => {
        return (
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15)
        );
      });
  
      // Send each exercise answer.
      for (let k = 0; k < numExerciseAnswers; k += 1) {
        console.log("Sending exercise answer " + k);
        await program.rpc.checkExerciseAnswer(exerciseAnswers[k], {
          accounts: {
            user,
            authority,
            strategy: strategy.publicKey,
          },
        });
      }
  
      // Check the strategy state is as expected.
      const testStrategy = await program.account.strategy.fetch(strategy.publicKey);
      const name = new TextDecoder("utf-8").decode(new Uint8Array(testStrategy.name));
      assert.ok(name.startsWith(strategyName)); // [u8; 280] => trailing zeros.
      assert.ok(testStrategy.exerciseAnswers.length === 33607);
      assert.ok(testStrategy.head.toNumber() === numExerciseAnswers);
      assert.ok(testStrategy.tail.toNumber() === 0);
      testStrategy.exerciseAnswers.forEach((msg, idx) => {
        if (idx < 10) {
          const data = new TextDecoder("utf-8").decode(new Uint8Array(msg.data));
          console.log("Exercise answer", idx + ":", data);
          assert.ok(msg.from.equals(user));
          assert.ok(data.startsWith(exerciseAnswers[idx]));
        } else {
          assert.ok(anchor.web3.PublicKey.default);
          assert.ok(
            JSON.stringify(msg.data) === JSON.stringify(new Array(280).fill(0))
          );
        }
      });
    });
  });
