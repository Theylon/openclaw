---
name: qmd-hardened
description: Hardened local qmd search/index workflow (no auto-install from remote source).
homepage: https://github.com/tobi/qmd
metadata:
  {
    "openclaw":
      {
        "emoji": "🛡️",
        "requires": { "bins": ["qmd"] },
      },
  }
---

# qmd-hardened (local fork)

Security-first fork of the `qmd` skill for local use.

## Goal

Use `qmd` for local indexing + search while reducing supply-chain and data-egress risk.

## Hardenings applied

- Removed auto-install from remote git URL.
- Requires preinstalled `qmd` binary (`qmd --version`) instead of installing at runtime.
- Explicitly treats `qmd mcp` as opt-in (manual approval only).
- Documents local-only default behavior and egress considerations.

## Safe default usage

Indexing:
- Add collection: `qmd collection add /path --name docs --mask "**/*.md"`
- Update index: `qmd update`
- Status: `qmd status`

Search:
- BM25: `qmd search "query"`
- Vector: `qmd vsearch "query"`
- Hybrid: `qmd query "query"`
- Get doc: `qmd get docs/path.md:10 -l 40`

## Security notes

- `qmd` is local-first; indexed data is stored locally (default cache path managed by qmd).
- Vector/rerank can use Ollama at `OLLAMA_URL` (default `http://localhost:11434`), which is local by default.
- Do **not** run `qmd mcp` in unattended automation unless explicitly approved.
- If you later want automatic install/update, pin exact version/commit and verify checksums before enabling.
