import * as anchor from "@project-serum/anchor";
import { SolanaProvider } from "@saberhq/solana-contrib";
import type { ConfirmOptions } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import os from "os";

import { TrainerSDK } from "../src";

export const SDK = (): TrainerSDK => {
  const url = "https://api.google.devnet.solana.com";
  const preflightCommitment = "recent";
  const connection = new anchor.web3.Connection(url, preflightCommitment);
  const keypairPath = os.homedir() + "/.config/solana/id.json";
  const keypairData = fs.readFileSync(keypairPath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const key = Uint8Array.from(JSON.parse(process.env.KEYPAIR || keypairData));
  const wallet = new anchor.Wallet(Keypair.fromSecretKey(key));

  // Add your deploy script here.
  const provider = SolanaProvider.load({
    connection: connection,
    wallet: wallet,
    opts: { commitment: preflightCommitment } as ConfirmOptions,
  });
  return TrainerSDK.init(provider);
};
