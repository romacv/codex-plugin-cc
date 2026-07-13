---
description: Delegate investigation, an explicit fix request, or follow-up rescue work to Codex
argument-hint: "[--background|--wait] [--resume|--fresh] [--model <model|spark>] [--effort <none|minimal|low|medium|high|xhigh>] [what Codex should investigate, solve, or continue]"
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Run a Codex rescue task through the shared plugin runtime.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint: forward unconditionally. Every invocation of this command sends the request to Codex through the `task` runtime — never judge the request as too simple to bother Codex with, never answer it yourself, never skip the `Bash` call.

Resume check:
- `--resume`/`--fresh` present → the user already chose; skip this check.
- Otherwise, check for a resumable rescue thread from this session:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task-resume-candidate --json
```

- If `available: true`, use `AskUserQuestion` exactly once: `Continue current Codex thread` vs `Start a new Codex thread`. Put `Continue current Codex thread (Recommended)` first for a clear follow-up ("continue", "keep going", "resume", "apply the top fix", "dig deeper"); otherwise put `Start a new Codex thread (Recommended)` first. Continue chosen → add `--resume`; new thread → add `--fresh`.
- If `available: false`, don't ask — route normally.

Execution mode rules:
- `--wait` present → foreground, don't ask. `--background` present → Claude background task, don't ask.
- Neither present → default to foreground for a small, clearly bounded rescue request; prefer background when the request looks complicated, open-ended, multi-step, or likely to keep Codex running for a long time. When unsure, prefer background.

Argument handling:
- Preserve the user's raw request text exactly apart from routing flags.
- `--background`/`--wait` are Claude Code execution flags — strip them before calling `task`; do not forward them as task text.
- `--model`/`--effort` are runtime-selection flags — preserve them for the forwarded `task` call, but don't treat them as task text. Leave both unset unless the user explicitly requests them. Map `spark` to `gpt-5.3-codex-spark`.
- `--resume`/`--fresh` — leave in the forwarded request; the companion script routes them when building `task`.
- `--write` — default to adding `--write` to the forwarded `task` call (Codex may edit files) unless the request is explicitly read-only/diagnosis-only ("just look into it", "investigate only", "don't change anything") — in that case omit `--write` so Codex runs in a read-only sandbox.
- If Codex is missing/unauthenticated, stop and point the user to `/codex:setup`.
- If the user supplied no request and there's no resumable thread, ask what Codex should investigate or fix.

Foreground flow:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "$ARGUMENTS"
```
Return stdout verbatim — no paraphrasing, summarizing, or commentary before/after.

Background flow:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "$ARGUMENTS"`,
  description: "Codex rescue",
  run_in_background: true
})
```
Do not call `BashOutput` or wait for completion this turn. After launching, tell the user: "Codex rescue started in the background. Check `/codex:status` for progress."
