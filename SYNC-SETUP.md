# Codex fork — upstream sync automation

Workflow `.github/workflows/sync-upstream.yml` runs monthly (1st, 06:00 UTC) +
manual dispatch. It merges upstream `openai/codex-plugin-cc`; if clean → pushes
to `main` (your Claude Code `autoUpdate` then installs it). On conflict → opens a
GitHub issue for manual resolution.

## One-time setup
- [ ] **Enable Actions on the fork** (forks have them OFF by default):
      https://github.com/romacv/codex-plugin-cc/actions → "I understand my
      workflows, go ahead and enable them".
- [ ] **Test it** (optional): Actions → "Sync upstream" → "Run workflow", or
      `gh workflow run sync-upstream.yml -R romacv/codex-plugin-cc`.
- [ ] **Sync the installed plugin to 1.0.5**: restart Claude Code (autoUpdate on)
      or `/plugin marketplace update romacv-codex` + `/reload-plugins`.

## Notes
- Cron = 1st of each month, 06:00 UTC. Edit the `cron:` line to change it.
- GitHub **pauses a fork's scheduled workflows after 60 days** of repo inactivity;
  the manual "Run workflow" button always works and any push re-arms the schedule.
- **On conflict** (upstream touched customized files) resolve locally:
  ```
  git fetch upstream && git merge upstream/main
  # keep haiku / romacv-codex name / trims
  git push
  ```
- **Version tracks upstream** deliberately (no confusion). autoUpdate installs a
  new version only when upstream bumps it; fork-only edits need a manual
  `/plugin marketplace update romacv-codex`.
