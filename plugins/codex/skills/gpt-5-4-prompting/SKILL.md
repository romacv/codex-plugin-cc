---
name: gpt-5-4-prompting
description: Internal guidance for composing Codex and GPT-5.4 prompts for coding, review, diagnosis, and research tasks inside the Codex Claude Code plugin
user-invocable: false
---

# GPT-5.4 Prompting

Use this skill when composing a Codex `task` prompt for `/codex:rescue`, or another GPT-5.4-based workflow, for help.

Prompt Codex like an operator, not a collaborator: compact, block-structured, XML-tagged. State the task, the output contract, the follow-through defaults, and only the extra constraints that matter.

Core rules:
- One clear task per Codex run — split unrelated asks into separate runs.
- State what done looks like; do not assume Codex will infer the end state.
- Add explicit grounding/verification rules wherever an unsupported guess would hurt quality.
- Prefer better prompt contracts over raising reasoning or adding long explanations.
- Use XML tags consistently for stable internal structure.

Default recipe:
- `<task>`: the concrete job and relevant repo/failure context.
- `<structured_output_contract>` or `<compact_output_contract>`: exact shape, ordering, brevity.
- `<default_follow_through_policy>`: what Codex should do by default instead of asking routine questions.
- `<verification_loop>` or `<completeness_contract>`: required for debugging, implementation, risky fixes.
- `<grounding_rules>` or `<citation_rules>`: required for review, research, or anything that could drift into unsupported claims.

When to add blocks:
- Coding/debugging: `completeness_contract`, `verification_loop`, `missing_context_gating`.
- Review/adversarial review: `grounding_rules`, `structured_output_contract`, `dig_deeper_nudge`.
- Research/recommendation: `research_mode`, `citation_rules`.
- Write-capable tasks: `action_safety`, to keep Codex narrow and avoid unrelated refactors.

Choosing prompt shape:
- Use built-in `review`/`adversarial-review` commands for reviewing local git changes — those prompts already carry the review contract.
- Use `task` for diagnosis, planning, research, or implementation when you need direct prompt control.
- Use `task --resume-last` for follow-ups on the same thread — send only the delta instruction unless the direction changed materially.

Working rules:
- Explicit prompt contracts over vague nudges.
- Stable XML tag names matching the block names in the reference file.
- Tighten the prompt/verification rules before raising reasoning or complexity.
- Ask for brief, outcome-based progress updates only on long-running or tool-heavy tasks.
- Keep claims anchored to observed evidence; label hypotheses as such.

Assembly checklist:
1. Define the exact task and scope in `<task>`.
2. Choose the smallest output contract that stays usable.
3. Decide whether Codex should keep going by default or stop for missing high-risk details.
4. Add verification, grounding, and safety tags only where needed.
5. Remove redundant instructions before sending.

Reusable blocks: [references/prompt-blocks.md](references/prompt-blocks.md).
End-to-end templates: [references/codex-prompt-recipes.md](references/codex-prompt-recipes.md).
Failure modes to avoid: [references/codex-prompt-antipatterns.md](references/codex-prompt-antipatterns.md).
