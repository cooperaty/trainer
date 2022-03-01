import * as anchor from "@project-serum/anchor";
import { Program, Provider as AnchorProvider } from "@project-serum/anchor";
import type { Provider } from "@saberhq/solana-contrib";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import type { PublicKey, Signer } from "@solana/web3.js";
import basex from "base-x";

import { TRAINER_PROGRAM_ID } from "./constants";
import type {
  ExerciseData,
  TraderData,
  TrainerProgram,
} from "./programs/trainer";
import { TrainerJSON } from "./programs/trainer";

const bs58 = basex(
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
);

/**
 * Javascript SDK for interacting with Crate tokens.
 */
export class TrainerSDK {
  constructor(readonly provider: Provider, readonly program: TrainerProgram) {}

  /**
   * Initialize from a Provider
   * @param provider
   * @param TrainerProgramID
   * @returns
   */
  static init(
    provider: Provider,
    TrainerProgramID: PublicKey = TRAINER_PROGRAM_ID
  ): TrainerSDK {
    return new TrainerSDK(
      provider,
      new Program(
        TrainerJSON,
        TrainerProgramID,
        new AnchorProvider(provider.connection, provider.wallet, provider.opts)
      ) as unknown as TrainerProgram
    );
  }

  /**
   * Creates a new instance of the SDK with the given keypair.
   */
  withSigner(signer: Signer): TrainerSDK {
    return TrainerSDK.init(
      new SolanaProvider(
        this.provider.connection,
        this.provider.broadcaster,
        new SignerWallet(signer),
        this.provider.opts
      )
    );
  }

  // HELPERS

  async getAccountBalance(publicKey = this.provider.wallet.publicKey) {
    const account = await this.provider.connection.getAccountInfo(publicKey);
    return account?.lamports ?? 0;
  }

  async getAirdrop({
    publicKey = this.provider.wallet.publicKey,
    airdropBalance = anchor.web3.LAMPORTS_PER_SOL,
  }: {
    publicKey?: PublicKey;
    airdropBalance?: number;
  }) {
    const sig = await this.provider.connection.requestAirdrop(
      publicKey,
      airdropBalance
    );
    await this.provider.connection.confirmTransaction(sig);
  }

  async createSigner(airdropBalance = anchor.web3.LAMPORTS_PER_SOL) {
    const signer = anchor.web3.Keypair.generate() as Signer;
    const sdk = this.withSigner(signer);
    await sdk.getAirdrop({ airdropBalance });
    return sdk;
  }

  async createMultipleSigners(amount: number): Promise<TrainerSDK[]> {
    const promises: TrainerSDK[] = [];
    for (let i = 0; i < amount; i++) {
      promises.push(await this.createSigner());
    }

    return Promise.all(promises);
  }

  // PDA ADDRESS

  async getExerciseAddress(authority: PublicKey, cid: string) {
    const [exercisePublicKey] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("exercise"),
        authority.toBuffer(),
        anchor.utils.bytes.utf8.encode(cid.slice(0, 32)),
        anchor.utils.bytes.utf8.encode(cid.slice(32, 64)),
      ],
      this.program.programId
    );
    return exercisePublicKey;
  }

  // INSTRUCTIONS

  async createTrader(name: string, user = this.provider.wallet.publicKey) {
    const [traderPublicKey] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("trader"),
        anchor.utils.bytes.utf8.encode(name.slice(0, 32)),
        user.toBuffer(),
      ],
      this.program.programId
    );

    await this.program.rpc.createTrader(name, {
      accounts: {
        trader: traderPublicKey,
        user,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    });

    return {
      publicKey: traderPublicKey,
      account: await this.program.account.trader.fetch(traderPublicKey),
    };
  }

  async createExercise(
    cid: string,
    validations_capacity = 5,
    timeout: number = new Date().getTime() + 60 * 60 * 24,
    authority = this.provider.wallet.publicKey
  ) {
    const exercisePublicKey = await this.getExerciseAddress(authority, cid);

    await this.program.rpc.createExercise(
      cid,
      validations_capacity,
      new anchor.BN(timeout),
      {
        accounts: {
          exercise: exercisePublicKey,
          authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      }
    );

    return {
      publicKey: exercisePublicKey,
      account: await this.program.account.exercise.fetch(exercisePublicKey),
    };
  }

  async addValidation(
    trader: TraderData,
    exercise: ExerciseData,
    value: number,
    cid: string,
    authority: PublicKey = this.provider.wallet.publicKey
  ) {
    return await this.program.rpc.addValidation(new anchor.BN(value), cid, {
      accounts: {
        exercise: exercise.publicKey,
        trader: trader.publicKey,
        user: authority,
      },
    });
  }

  async addOutcome(
    exercise: ExerciseData,
    outcome: number,
    solution_cid: string,
    cid: string
  ) {
    return await this.program.rpc.addOutcome(
      new anchor.BN(outcome),
      solution_cid,
      cid,
      {
        accounts: {
          exercise: exercise.publicKey,
          authority: exercise.account.authority,
        },
      }
    );
  }

  async checkValidation(
    trader: TraderData,
    exercise: ExerciseData,
    index: number,
    cid: string
  ) {
    return await this.program.rpc.checkValidation(index, cid, {
      accounts: {
        exercise: exercise.publicKey,
        authority: exercise.account.authority,
        trader: trader.publicKey,
      },
    });
  }

  // INSTRUCTIONS MULTIPLE

  async createMultipleExercises(
    cids: string[],
    validations_capacity = 5,
    timeout: number = new Date().getTime() + 60 * 60 * 24,
    authority = this.provider.wallet.publicKey
  ) {
    const instructions: anchor.web3.TransactionInstruction[] = [];
    const exercisesPublicKeys: PublicKey[] = [];

    for (let i = 0; i < cids.length; i++) {
      const cid = cids[i];
      const exercisePublicKey = await this.getExerciseAddress(authority, cid);

      exercisesPublicKeys.push(exercisePublicKey);

      if (i < cids.length - 1) {
        instructions.push(
          this.program.instruction.createExercise(
            cid,
            validations_capacity,
            new anchor.BN(timeout),
            {
              accounts: {
                exercise: exercisePublicKey,
                authority,
                systemProgram: anchor.web3.SystemProgram.programId,
              },
            }
          )
        );
      } else {
        await this.program.rpc.createExercise(
          cid,
          validations_capacity,
          new anchor.BN(timeout),
          {
            accounts: {
              exercise: exercisePublicKey,
              authority,
              systemProgram: anchor.web3.SystemProgram.programId,
            },
            instructions,
          }
        );
      }
    }

    return await Promise.all(
      exercisesPublicKeys.map(
        async (exercisePublicKey: PublicKey): Promise<ExerciseData> => ({
          publicKey: exercisePublicKey,
          account: await this.program.account.exercise.fetch(exercisePublicKey),
        })
      )
    );
  }

  async checkMultipleValidations(
    traders: TraderData[],
    exercise: ExerciseData,
    index: number,
    cid: string
  ) {
    const instructions: anchor.web3.TransactionInstruction[] = [];
    const lastTraderIndex = traders.length - 1;

    for (let i = 0; i < lastTraderIndex; i++) {
      instructions.push(
        this.program.instruction.checkValidation(index, cid, {
          accounts: {
            exercise: exercise.publicKey,
            authority: exercise.account.authority,
            trader: traders[i].publicKey,
          },
        })
      );
    }

    await this.program.rpc.checkValidation(index, cid, {
      accounts: {
        exercise: exercise.publicKey,
        authority: exercise.account.authority,
        trader: traders[lastTraderIndex].publicKey,
      },
      instructions,
    });
  }

  // GETTERS

  async reloadTraderAccount(trader: TraderData) {
    return {
      publicKey: trader.publicKey,
      account: await this.program.account.trader.fetch(trader.publicKey),
    };
  }

  async reloadExercise(exercise: ExerciseData) {
    return {
      publicKey: exercise.publicKey,
      account: await this.program.account.exercise.fetch(exercise.publicKey),
    };
  }

  async reloadMultipleExercises(exercises: ExerciseData[]) {
    return await Promise.all(
      exercises.map(async (exercise: ExerciseData): Promise<ExerciseData> => {
        return {
          publicKey: exercise.publicKey,
          account: await this.program.account.exercise.fetch(
            exercise.publicKey
          ),
        };
      })
    );
  }

  async getFilteredTraders(filters: { user?: PublicKey } = {}) {
    const cmp = (offset: number, bytes: string) => {
      return { memcmp: { offset, bytes } };
    };

    const searchFilters: anchor.web3.GetProgramAccountsFilter[] = [];

    if ("user" in filters && filters.user)
      searchFilters.push(cmp(8, filters.user.toBase58()));

    return await this.program.account.trader.all(searchFilters);
  }

  async getFilteredExercises(filters: { full?: boolean; cid?: string } = {}) {
    const cmp = (offset: number, bytes: string) => {
      return { memcmp: { offset, bytes } };
    };

    const searchFilters: anchor.web3.GetProgramAccountsFilter[] = [];

    if ("full" in filters)
      searchFilters.push(
        cmp(8, bs58.encode(Buffer.from([filters.full ? 0x1 : 0x0])))
      );
    if ("cid" in filters && filters.cid)
      searchFilters.push(cmp(21, bs58.encode(Buffer.from(filters.cid))));

    return await this.program.account.exercise.all(searchFilters);
  }
}
