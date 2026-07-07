---
description: Run a Codex code review against local git state
argument-hint: '[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run a Codex review through the shared built-in reviewer.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint: review-only. Do not fix issues, apply patches, or suggest changes are coming — just run the review and return Codex's output verbatim.

Execution mode rules:
- `--wait` present → foreground, don't ask. `--background` present → Claude background task, don't ask.
- Otherwise estimate size first: `git status --short --untracked-files=all`, `git diff --shortstat --cached`, `git diff --shortstat` (working-tree), or `git diff --shortstat <base>...HEAD` (base-branch). Treat untracked files/dirs as reviewable even with an empty diff shortstat; only conclude nothing to review when the relevant status/diff is genuinely empty.
- Recommend waiting only for a clearly tiny review (~1-2 files, no sign of a broader change); otherwise, including when unclear, recommend background. When in doubt, run the review rather than declaring nothing to review.
- Then `AskUserQuestion` exactly once: `Wait for results` vs `Run in background`, recommended option first and suffixed `(Recommended)`.

Argument handling:
- Preserve the user's arguments exactly; don't strip `--wait`/`--background` or add extra review instructions.
- The companion script parses `--wait`/`--background`, but `Bash(..., run_in_background: true)` is what actually detaches the run.
- `/codex:review` is native-review only — no staged/unstaged-only scope, no extra focus text. Point the user to `/codex:adversarial-review` for custom instructions or more adversarial framing.

Foreground flow:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" review "$ARGUMENTS"
```
Return stdout verbatim — no paraphrasing, summarizing, or commentary, and don't fix anything the review mentions.

Background flow:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" review "$ARGUMENTS"`,
  description: "Codex review",
  run_in_background: true
})
```
Don't call `BashOutput` or wait for completion this turn. After launching, tell the user: "Codex review started in the background. Check `/codex:status` for progress."
