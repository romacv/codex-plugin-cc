import fs from "node:fs";
import path from "node:path";

import { writeExecutable } from "./helpers.mjs";

const DEFAULT_USAGE = [
  {
    provider: "codex",
    usage: {
      primary: {
        resetDescription: "4:30 PM",
        usedPercent: 42
      }
    }
  }
];

export function installFakeCodexbar(binDir, output = DEFAULT_USAGE) {
  const callsPath = path.join(binDir, "fake-codexbar-calls.jsonl");
  const scriptPath = path.join(binDir, "codexbar");
  const stdout = typeof output === "string" ? output : JSON.stringify(output);
  const source = `#!/usr/bin/env node
const fs = require("node:fs");

fs.appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify(process.argv.slice(2)) + "\\n");
process.stdout.write(${JSON.stringify(stdout)});
`;
  writeExecutable(scriptPath, source);
  return { callsPath, scriptPath };
}
