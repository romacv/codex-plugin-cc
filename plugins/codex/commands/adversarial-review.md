---
description: Run a Codex review that challenges the implementation approach and design choices
argument-hint: '[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [focus ...]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run an adversarial Codex review through the shared plugin runtime — a challenge review questioning the chosen implementation, design choices, tradeoffs, and assumptions, not just a stricter pass over defects.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint: review-only. Do not fix issues, apply patches, or suggest changes are coming — just run the review and return Codex's output verbatim. Keep the framing on whether the current approach is right, what assumptions it depends on, and where the design could fail under real-world conditions.

Execution mode rules:
- `--wait` present → foreground, don't ask. `--background` present → Claude background task, don't ask.
- Otherwise estimate size first: `git status --short --untracked-files=all`, `git diff --shortstat --cached`, `git diff --shortstat` (working-tree), or `git diff --shortstat <base>...HEAD` (base-branch). Treat untracked files/dirs as reviewable for auto/working-tree scope even with an empty diff shortstat; only conclude nothing to review when the relevant scope is genuinely empty.
- Recommend waiting only for a clearly tiny review (~1-2 files, no sign of a broader change); otherwise, including when unclear, recommend background. When in doubt, run the review rather than declaring nothing to review.
- Then `AskUserQuestion` exactly once: `Wait for results` vs `Run in background`, recommended option first and suffixed `(Recommended)`.

Argument handling:
- Preserve the user's arguments exactly; don't strip `--wait`/`--background`, weaken the adversarial framing, or rewrite the focus text.
- The companion script parses `--wait`/`--background`, but `Bash(..., run_in_background: true)` is what actually detaches the run.
- Same target selection as `/codex:review` (working-tree, branch, `--base <ref>`); no `--scope staged`/`unstaged`. Unlike `/codex:review`, extra focus text after the flags is supported.

Foreground flow:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" adversarial-review "$ARGUMENTS"
```
Return stdout verbatim — no paraphrasing, summarizing, or commentary, and don't fix anything the review mentions.

Background flow:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" adversarial-review "$ARGUMENTS"`,
  description: "Codex adversarial review",
  run_in_background: true
})
```
Don't call `BashOutput` or wait for completion this turn. After launching, tell the user: "Codex adversarial review started in the background. Check `/codex:status` for progress."
