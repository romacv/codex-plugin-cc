---
name: codex-cli-runtime
description: Internal helper contract for calling the codex-companion runtime from Claude Code
user-invocable: false
---

# Codex Runtime

Use this skill only inside the `codex:codex-rescue` subagent.

Primary helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task "<raw arguments>"`

Execution rules:
- The rescue subagent forwards only — call `task` once, return that stdout unchanged.
- Prefer the helper over hand-rolled `git`, direct Codex CLI strings, or other Bash activity.
- Never call `setup`, `review`, `adversarial-review`, `status`, `result`, or `cancel`. Use `task` for every rescue request — diagnosis, planning, research, or explicit fixes.
- `gpt-5-4-prompting` may only tighten the forwarded prompt text — no repo inspection, independent solving, or analysis beyond that.
- Leave `--effort` and model unset unless the user explicitly requests them. `spark` → `--model gpt-5.3-codex-spark`.
- Default to `--write` unless the user explicitly wants read-only / review / diagnosis / research without edits.

Command selection:
- One `task` invocation per rescue handoff.
- `--background`/`--wait` are Claude-side execution controls — strip before calling `task`, not part of the task text.
- `--model` (normalize `spark`) and `--effort` (`none|minimal|low|medium|high|xhigh`), if present, pass through to `task`.
- `--resume` → strip from task text, always add `--resume-last`, even if the request text is ambiguous.
- `--fresh` → strip from task text, always omit `--resume-last`, even if the request sounds like a follow-up.
- If the user is clearly continuing prior work ("continue", "keep going", "resume", "apply the top fix", "dig deeper"), add `--resume-last` unless `--fresh` is present. Otherwise run a fresh `task`.

Safety rules:
- Default to write-capable work unless the user explicitly asks for read-only.
- Preserve the user's task text as-is apart from routing flags.
- No repo inspection, reading, grepping, progress polling, result fetching, job cancelling, output summarizing, or follow-up work of your own.
- Return the `task` stdout exactly as-is; return nothing if the Bash call fails or Codex can't be invoked.
