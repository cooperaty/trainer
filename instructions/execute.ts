import { PublicKey } from "@solana/web3.js";

import type { ExerciseData } from "../src";
import { SDK } from "./workspace";

const DEFAULT_CID =
  "bafkreibs4rp5yfkj26pmpy5si3g7tasparmhjn2blkll5vlzm4t3l7s2hy";

async function execute() {
  const instruction = process.argv[2];
  const sdk = SDK();

  switch (instruction) {
    case "initializeParams": {
      console.log("🚀 Initialize params...");
      const minValidations = parseInt(process.argv[3] || "5");
      await sdk.initializeParams(minValidations);
      console.log("✅ Done");
      break;
    }
    case "modifyMinValidations": {
      const minValidations = parseInt(process.argv[3] || "5");
      console.log(
        `🚀 Modifying min validations param to value ${minValidations}...`
      );
      await sdk.modifyMinValidations(minValidations);
      console.log("✅ Done");
      break;
    }
    case "modifyAuthority": {
      console.log("🚀 Modifying authority param...");
      const authority = process.argv[3]
        ? new PublicKey(process.argv[3])
        : sdk.provider.wallet.publicKey;
      await sdk.modifyAuthority(authority);
      console.log("✅ Done");
      break;
    }
    case "createTrainer": {
      console.log("🚀 Create trainer...");
      const pubkey = process.argv[3]
        ? new PublicKey(process.argv[3])
        : sdk.provider.wallet.publicKey;
      console.log("🔑 Public key:", pubkey.toString());
      const trainer = await sdk.createTrainer(pubkey);
      console.log("✅ Done", trainer);
      break;
    }
    case "createExercise": {
      console.log("🚀 Create exercise...");
      const cid = process.argv[3] || DEFAULT_CID;
      const exercise = await sdk.createExercise(cid);
      console.log("✅ Done", exercise);
      break;
    }
    case "checkExercise": {
      const outcome = process.argv[3] ? parseInt(process.argv[3]) : 100;
      const cid = process.argv[4] || DEFAULT_CID;
      const exercise = await sdk.getFilteredExercises({ cid });
      if (exercise?.length !== 1) console.error("Exercise not found");
      console.log(`🚀 Checking exercise with outcome ${outcome}...`);
      await sdk.addOutcome(exercise[0], outcome);
      await sdk.checkAllValidations(exercise[0]);
      console.log("✅ Done", exercise);
      break;
    }
    case "listenExercise": {
      const outcome = process.argv[3] ? parseInt(process.argv[3]) : 100;
      const cid = process.argv[4] || DEFAULT_CID;
      const exercisePubkey = await sdk.getExerciseAddress(cid);
      if (!exercisePubkey) console.error("Exercise not found");
      console.log(`🚀 Listening exercise with outcome ${outcome}...`);
      sdk.onExerciseChange(
        exercisePubkey,
        async (exercise: ExerciseData | null) => {
          console.log("🔔 Exercise changed", exercise);
          if (!exercise) console.error("✅ Done");
          if (exercise?.account?.sealed) {
            console.log(`🚀 Checking exercise with outcome ${outcome}...`);
            await sdk.addOutcome(exercise, outcome);
            await sdk.checkAllValidations(exercise);
          }
        }
      );
      break;
    }
    case "closeExercise": {
      console.log("🚀 Close exercise...");
      const cid = process.argv[3] || DEFAULT_CID;
      const exercise = await sdk.getFilteredExercises({ cid });
      if (exercise?.length !== 1) console.error("Exercise not found");
      const trainer = await sdk.closeExercise(exercise[0]);
      console.log("✅ Done", trainer);
      break;
    }
    default: {
      console.log("Unknown instruction", instruction);
    }
  }
}

void execute();
