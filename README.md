# OpenClaw Org Structure (Eylon)

Updated: 2026-02-13 (Asia/Jerusalem)

This repository mirrors the **Demrezel workspace** and documents the wider OpenClaw multi-agent org running under `~/.openclaw/workspaces`.

## Agent topology

| Agent | Workspace | Role (from SOUL.md) | Identity status |
|---|---|---|---|
| Demrezel | `workspaces/demrezel` | Squad lead + execution partner | Template (not filled) |
| MissionControl | `workspaces/missioncontrol` | Shared brain operator; tasks/status/decisions coherence | Template (not filled) |
| Planner | `workspaces/planner` | Turns intent into executable plans and PRDs | Template (not filled) |
| Polymarket | `workspaces/polymarket` | Polymarket research & ops co-founder | Filled (`Name: Polymarket`, `Emoji: 📊`) |
| Researcher | `workspaces/researcher` | High-signal research operator | No `IDENTITY.md` found |
| SkillLookup | `workspaces/skilllookup` | Tooling/capability router for skills | Partially filled (`Name: SkillLookup`) |
| Writing Agent | `workspaces/writing-agent` | Content workspace present | No `SOUL.md`/`IDENTITY.md` found |

## Souls (concise)

- **Demrezel:** blunt, challenge-first, evidence over vibes.
- **MissionControl:** minimal prose, maximum structure, lifecycle governance.
- **Planner:** crisp planning, asks before assuming.
- **Polymarket:** data-driven trading signals, actionable entries/exits.
- **Researcher:** skeptical, evidence-first findings.
- **SkillLookup:** fast tool/skill routing with exact invocation guidance.

## MissionControl operating README (ported summary)

MissionControl defines the broader operating standard:

1. Session init + architecture validation before task work.
2. Mandatory startup read order (`AGENTS.md` → `SOUL.md` → maps/runbooks → memory).
3. Structured memory architecture (`INDEX`, `active-tasks`, `WORKING`, `daily`, `projects`, `reference`, `archive`).
4. Task lifecycle discipline (`inbox → assigned → in_progress → review → done/blocked`).
5. Sub-agent gate: self-validation PASS + parent verification PASS.
6. Cron for precise scheduling, heartbeat for lightweight checks.
7. External/untrusted content routes to stronger model policy path.
8. Skill routing contract enforced (`use_when`, `dont_use_when`, required inputs/outputs).

## Shared local MCP endpoint

- qmd MCP (local-only): `http://localhost:8181/mcp`
- Intended for all local agents/sessions on this machine.

## Notes

- This repo contains the Demrezel workspace files. Other agent workspaces are sibling directories on the same host and are documented here for org visibility.
- If you want, next step is a **monorepo export** that includes all workspace directories under one GitHub repo.
