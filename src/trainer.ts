import * as anchor from '@project-serum/anchor'
import { Program, Provider as AnchorProvider } from '@project-serum/anchor'
import type { Provider } from '@saberhq/solana-contrib'
import { SignerWallet, SolanaProvider } from '@saberhq/solana-contrib'
import type { PublicKey, Signer } from '@solana/web3.js'
import { TRAINER_PROGRAM_ID } from './constants'
import type { TrainerProgram } from './programs'
import { TrainerJSON } from './programs/trainer'
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = require('base-x')(BASE58)

/**
 * Javascript SDK for interacting with Crate tokens.
 */
export class TrainerSDK {
  constructor(
    public readonly provider: Provider,
    public readonly program: TrainerProgram
  ) {}

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
    )
  }

  /**
   * Creates a new instance of the SDK with the given keypair.
   */
  public withSigner(signer: Signer): TrainerSDK {
    return TrainerSDK.init(
      new SolanaProvider(
        this.provider.connection,
        this.provider.broadcaster,
        new SignerWallet(signer),
        this.provider.opts
      )
    )
  }

  async getAccountBalance(publicKey = this.provider.wallet.publicKey) {
    const account = await this.provider.connection.getAccountInfo(publicKey)
    return account?.lamports ?? 0
  }

  async getAirdrop({
    publicKey = this.provider.wallet.publicKey,
    airdropBalance = anchor.web3.LAMPORTS_PER_SOL,
  }: {
    publicKey?: PublicKey
    airdropBalance?: number
  }) {
    const sig = await this.provider.connection.requestAirdrop(
      publicKey,
      airdropBalance
    )
    await this.provider.connection.confirmTransaction(sig)
  }

  async createTrader(name, authority = this.provider.wallet.publicKey) {
    const [traderPublicKey, bump] =
      await anchor.web3.PublicKey.findProgramAddress(
        ['trader', name.slice(0, 32), authority.toBytes()],
        this.program.programId
      )

    await this.program.rpc.createTrader(name, bump, {
      accounts: {
        trader: traderPublicKey,
        user: authority, // TODO: change user to authority
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    })

    return {
      publicKey: traderPublicKey,
      account: await this.program.account.trader.fetch(traderPublicKey),
    }
  }

  async reloadTraderAccount(trader) {
    return {
      publicKey: trader.publicKey,
      account: await this.program.account.trader.fetch(trader.publicKey),
    }
  }

  async getFilteredTraders(filters) {
    const cmp = (offset, bytes) => {
      return { memcmp: { offset, bytes } }
    }

    const searchFilters: any[] = []

    if ('user' in filters) searchFilters.push(cmp(8, filters.user.toBase58()))

    return await this.program.account.trader.all(searchFilters)
  }

  async createExercise(
    cid,
    predictions_capacity = 5,
    authority = this.provider.wallet.publicKey
  ) {
    const [exercisePublicKey, bump] =
      await anchor.web3.PublicKey.findProgramAddress(
        ['exercise', authority.toBytes(), cid.slice(0, 32), cid.slice(32, 64)],
        this.program.programId
      )

    await this.program.rpc.createExercise(cid, predictions_capacity, bump, {
      accounts: {
        exercise: exercisePublicKey,
        authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    })

    return {
      publicKey: exercisePublicKey,
      account: await this.program.account.exercise.fetch(exercisePublicKey),
    }
  }

  async reloadExercise(exercise) {
    return {
      publicKey: exercise.publicKey,
      account: await this.program.account.exercise.fetch(exercise.publicKey),
    }
  }

  async createMultipleExercises(
    cids,
    predictions_capacity = 5,
    authority = this.provider.wallet.publicKey
  ) {
    const instructions: any[] = []
    const exercisesPublicKeys: PublicKey[] = []

    for (let i = 0; i < cids.length; i++) {
      const cid = cids[i]
      const [exercisePublicKey, bump] =
        await anchor.web3.PublicKey.findProgramAddress(
          [
            'exercise',
            authority.toBytes(),
            cid.slice(0, 32),
            cid.slice(32, 64),
          ],
          this.program.programId
        )

      exercisesPublicKeys.push(exercisePublicKey)

      if (i < cids.length - 1) {
        instructions.push(
          this.program.instruction.createExercise(
            cid,
            predictions_capacity,
            bump,
            {
              accounts: {
                exercise: exercisePublicKey,
                authority,
                systemProgram: anchor.web3.SystemProgram.programId,
              },
            }
          )
        )
      } else {
        await this.program.rpc.createExercise(cid, predictions_capacity, bump, {
          accounts: {
            exercise: exercisePublicKey,
            authority,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          instructions,
        })
      }
    }

    return await Promise.all(
      exercisesPublicKeys.map(async (exercisePublicKey): Promise<any> => {
        return {
          publicKey: exercisePublicKey,
          account: await this.program.account.exercise.fetch(exercisePublicKey),
        }
      })
    )
  }

  async reloadMultipleExercises(exercises) {
    return await Promise.all(
      exercises.map(async (exercise): Promise<any> => {
        return {
          publicKey: exercise.publicKey,
          account: await this.program.account.exercise.fetch(
            exercise.publicKey
          ),
        }
      })
    )
  }

  async getFilteredExercises(filters) {
    const cmp = (offset, bytes) => {
      return { memcmp: { offset, bytes } }
    }

    const searchFilters: any[] = []

    if ('full' in filters)
      searchFilters.push(
        cmp(8, bs58.encode(Buffer.from([filters.full ? 0x1 : 0x0])))
      )
    if ('cid' in filters)
      searchFilters.push(cmp(13, bs58.encode(Buffer.from(filters.cid))))

    return await this.program.account.exercise.all(searchFilters)
  }

  async addPrediction(
    trader,
    exercise,
    value,
    cid,
    authority = this.provider.wallet.publicKey
  ) {
    return await this.program.rpc.addPrediction(new anchor.BN(value), cid, {
      accounts: {
        exercise: exercise.publicKey,
        authority: exercise.account.authority,
        trader: trader.publicKey,
        user: authority,
      },
    })
  }

  async addOutcome(exercise, outcome, solution_key, cid) {
    return await this.program.rpc.addOutcome(
      new anchor.BN(outcome),
      solution_key,
      cid,
      {
        accounts: {
          exercise: exercise.publicKey,
          authority: exercise.account.authority, // TODO: check if payer
        },
      }
    )
  }

  async checkPrediction(trader, exercise, index, cid) {
    return await this.program.rpc.checkPrediction(new anchor.BN(index), cid, {
      accounts: {
        exercise: exercise.publicKey,
        authority: exercise.account.authority,
        trader: trader.publicKey,
        user: trader.account.user,
      },
    })
  }

  async checkMultiplePredictions(traders, exercise, index, cid) {
    const instructions: any[] = []
    const lastTraderIndex = traders.length - 1

    for (let i = 0; i < lastTraderIndex; i++) {
      instructions.push(
        this.program.instruction.checkPrediction(new anchor.BN(index), cid, {
          accounts: {
            exercise: exercise.publicKey,
            authority: exercise.account.authority,
            trader: traders[i].publicKey,
            user: traders[i].account.user,
          },
        })
      )
    }

    await this.program.rpc.checkPrediction(new anchor.BN(index), cid, {
      accounts: {
        exercise: exercise.publicKey,
        authority: exercise.account.authority,
        trader: traders[lastTraderIndex].publicKey,
        user: traders[lastTraderIndex].account.user,
      },
      instructions,
    })
  }

  async createSigner(airdropBalance = anchor.web3.LAMPORTS_PER_SOL) {
    const signer = anchor.web3.Keypair.generate() as Signer
    const sdk = this.withSigner(signer)
    await sdk.getAirdrop({ airdropBalance })
    return sdk
  }

  async createSigners(amount) {
    const promises: any[] = []
    for (let i = 0; i < amount; i++) {
      promises.push(await this.createSigner())
    }

    return Promise.all(promises)
  }
}
