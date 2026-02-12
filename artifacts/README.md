# Artifacts Directory

Standard handoff boundary for generated outputs. All tool-generated files that need review, retrieval, or passing to subsequent steps go here.

## Structure

```
artifacts/
├── reports/      # Analysis reports, summaries, briefings
├── exports/      # Data exports, CSVs, JSONs
├── generated/    # Code, configs, scripts created by agent
└── temp/         # Scratch files, intermediate outputs (auto-cleanup OK)
```

## Conventions

1. **Write here, not scattered**: All generated artifacts → `artifacts/`
2. **Descriptive names**: `2026-02-12-apartment-report.md` not `report.md`
3. **Date prefix for reports**: `YYYY-MM-DD-<name>.<ext>`
4. **Clean temp regularly**: Files in `temp/` can be deleted after 24h
5. **Don't store secrets**: Never write credentials or tokens here

## Mental Model

> Tools write to disk, models reason over disk, humans retrieve from disk.

This creates a clean review boundary — the human can inspect, approve, or feed artifacts into the next step.

## Examples

```bash
# Good
artifacts/reports/2026-02-12-weekly-briefing.md
artifacts/exports/contacts-backup.json
artifacts/generated/activity-feed-v2.ts
artifacts/temp/scraped-page.html

# Bad (don't do this)
~/Downloads/report.md
/tmp/random-output.json
./untitled.txt
```
