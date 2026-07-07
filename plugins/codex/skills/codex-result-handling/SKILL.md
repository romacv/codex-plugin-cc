---
name: codex-result-handling
description: Internal guidance for presenting Codex helper output back to the user
user-invocable: false
---

# Codex Result Handling

When the helper returns Codex output:
- Preserve the helper's verdict, summary, findings, and next-steps structure; order review findings by severity.
- Use file paths and line numbers exactly as reported.
- Preserve evidence boundaries — keep any inference/uncertainty/follow-up distinction Codex marked.
- Preserve requested sections (observed facts, inferences, open questions, touched files, next steps).
- If there are no findings, say so explicitly and keep the residual-risk note brief.
- If Codex made edits, say so explicitly and list touched files when provided.
- For `codex:codex-rescue`: never turn a failed/incomplete Codex run into a Claude-side implementation attempt — report the failure and stop. If Codex was never successfully invoked, do not generate a substitute answer at all.
- CRITICAL: after presenting review findings, STOP. No code changes, no fixes. Ask the user which issues (if any) to fix before touching a file — auto-applying review fixes is forbidden even if obvious.
- If the helper reports malformed output or a failed run, include the most actionable stderr lines and stop instead of guessing.
- If setup/authentication is required, direct the user to `/codex:setup` — do not improvise alternate auth flows.
