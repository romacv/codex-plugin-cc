---
description: Check whether the local Codex CLI is ready and optionally toggle the stop-time review gate
argument-hint: '[--enable-review-gate|--disable-review-gate]'
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" setup --json $ARGUMENTS
```

If Codex is unavailable and npm is available:
- Use `AskUserQuestion` exactly once: `Install Codex (Recommended)` vs `Skip for now`.
- Install chosen → run `npm install -g @openai/codex`, then rerun the setup command above.

If Codex is already installed or npm is unavailable, don't ask about installation.

Output rules:
- Present the final setup output to the user (the original output if installation was skipped).
- If Codex is installed but not authenticated, preserve the guidance to run `!codex login`.
