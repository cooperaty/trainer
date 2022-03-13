import anchor from "@project-serum/anchor";
import { SolanaProvider } from "@saberhq/solana-contrib";
import { PublicKey } from "@solana/web3.js";

import { TrainerSDK } from "../src";

module.exports = async function (anchorProvider: anchor.Provider) {
  anchor.setProvider(anchorProvider);

  // Add your deploy script here.
  const provider = SolanaProvider.load({
    connection: anchorProvider.connection,
    wallet: anchorProvider.wallet,
    opts: anchorProvider.opts,
  });

  const sdk = TrainerSDK.init(provider);

  await sdk.initializeParams(5);
  await sdk.modifyAuthority(
    new PublicKey("EgHtSV6fWdDdhXscC32zqCWtqfdvFi3dDui6sdYezprM")
  );
};
