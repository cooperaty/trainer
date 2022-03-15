import { SDK } from "./workspace";

async function execute() {
  const instruction = process.argv[2];

  switch (instruction) {
    case "initializeParams": {
      const sdk = SDK();
      await sdk.initializeParams(5);
      break;
    }
    default: {
      console.log("Unknown instruction:", instruction);
    }
  }
}

void execute();
