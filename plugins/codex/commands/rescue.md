---
description: Delegate investigation, an explicit fix request, or follow-up rescue work to the Codex rescue subagent
argument-hint: "[--background|--wait] [--resume|--fresh] [--model <model|spark>] [--effort <none|minimal|low|medium|high|xhigh>] [what Codex should investigate, solve, or continue]"
allowed-tools: Bash(node:*), AskUserQuestion, Agent
---

Invoke the `codex:codex-rescue` subagent via the `Agent` tool (`subagent_type: "codex:codex-rescue"`), forwarding the raw user request as the prompt.
`codex:codex-rescue` is a subagent, not a skill — do not call `Skill(codex:codex-rescue)` (no such skill) or `Skill(codex:rescue)` (re-enters this command and hangs the session). Run inline so the `Agent` tool stays in scope; forked general-purpose subagents don't expose it.
The final user-visible response must be Codex's output verbatim.

Raw user request:
$ARGUMENTS

Execution mode:
- `--background` → run the subagent in the background. `--wait` → run it in the foreground. Neither present → default foreground.
- `--background`/`--wait` are Claude Code execution flags — do not forward them to `task` or treat them as task text.
- `--model`/`--effort` are runtime-selection flags — preserve them for the forwarded `task` call, but don't treat them as task text.
- `--resume`/`--fresh` present → the user already chose; don't ask.
- Otherwise, check for a resumable rescue thread from this session:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task-resume-candidate --json
```

- If `available: true`, use `AskUserQuestion` exactly once: `Continue current Codex thread` vs `Start a new Codex thread`. Put `Continue current Codex thread (Recommended)` first for a clear follow-up ("continue", "keep going", "resume", "apply the top fix", "dig deeper"); otherwise put `Start a new Codex thread (Recommended)` first. Continue chosen → add `--resume`; new thread → add `--fresh`.
- If `available: false`, don't ask — route normally.

Operating rules:
- The subagent is a thin forwarder only: one `Bash` call to `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task ...`, returning that stdout as-is.
- Return the stdout verbatim — no paraphrasing, summarizing, or commentary before/after.
- Don't ask the subagent to inspect files, monitor progress, poll `/codex:status`, fetch `/codex:result`, call `/codex:cancel`, summarize output, or do follow-up work.
- Leave `--effort` and model unset unless the user explicitly asks; `spark` → `gpt-5.3-codex-spark`.
- Leave `--resume`/`--fresh` in the forwarded request — the subagent routes them when building `task`.
- If Codex is missing/unauthenticated, stop and point the user to `/codex:setup`.
- If the user supplied no request, ask what Codex should investigate or fix.
