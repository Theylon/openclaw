# Skill Routing Guide

Enhanced routing logic for skills. Check this BEFORE invoking skills to ensure correct selection.

---

## 🎮 gog (Google Workspace)

**Use when:**
- Gmail: read, send, search, label, archive emails
- Google Calendar: list events, create events, check availability
- Google Drive: list, search, upload, download files
- Google Contacts: lookup, create, update contacts
- Google Sheets: read, write, update spreadsheets
- Google Docs: create, read, edit documents

**Don't use when:**
- Outlook/Microsoft email → use `himalaya` or browser
- Apple Calendar → use `exec` with `icalBuddy`
- iCloud Drive → use `exec` with file operations
- Local files → use `read`/`write` tools directly
- Notion → use `notion` skill

**Outputs:** Email summaries, calendar JSON, file metadata

---

## 🐙 github (GitHub CLI)

**Use when:**
- Issues: create, list, view, close, comment
- PRs: create, review, merge, list
- Repos: clone, create, list, view
- Actions/CI: list runs, view logs, trigger workflows
- Releases: create, list, download assets
- API queries: `gh api` for anything not covered

**Don't use when:**
- GitLab → use browser or direct API
- Bitbucket → use browser or direct API
- Local git operations → use `exec` with `git` commands
- GitHub web UI actions (settings, permissions) → use browser

**Outputs:** Issue/PR URLs, JSON data, status info

---

## 🐦 bird (X/Twitter)

**Use when:**
- Read tweets, threads, replies
- Search tweets by query or user
- Post tweets (with caution)
- Check notifications/mentions
- View user profiles and timelines

**Don't use when:**
- DMs → not supported, use browser
- Spaces → not supported, use browser
- Account settings → use browser
- Bluesky → different platform entirely
- Mastodon → different platform entirely

**Outputs:** Tweet text, thread content, user info

---

## 🧩 coding-agent (Claude Code / Codex)

**Use when:**
- Complex multi-file code changes
- New project scaffolding
- Debugging that requires exploration
- Refactoring across multiple files
- Long-running coding tasks

**Don't use when:**
- Simple single-file edits → use `edit` tool directly
- Quick script execution → use `exec` tool
- Reading code → use `read` tool
- File creation → use `write` tool
- Git operations → use `exec` with git

**Outputs:** Code changes, new files, git commits

---

## 🌤️ weather

**Use when:**
- Current weather for a location
- Weather forecast (1-3 days)
- Quick weather checks

**Don't use when:**
- Historical weather data → use web search
- Detailed meteorological data → use browser
- Air quality specific queries → use web search
- Weather alerts/warnings → check official sources

**Outputs:** Weather text, temperature, conditions

---

## 📝 apple-notes / things-mac

**Use when (apple-notes):**
- Quick notes, lists, reminders on Apple ecosystem
- Search existing Apple Notes
- Organize notes into folders

**Use when (things-mac):**
- Task management, todos, projects
- Today/upcoming task lists
- Project organization

**Don't use when:**
- Notion → use `notion` skill
- Obsidian → use `obsidian` skill
- Reminders app → use `apple-reminders` skill
- Cross-platform notes → use Notion or other

---

## 📧 himalaya vs gog

**Use himalaya when:**
- Non-Gmail IMAP accounts (Outlook, custom domains)
- Need raw email access
- Offline-first email workflow

**Use gog when:**
- Gmail accounts
- Need Google Workspace integration
- Calendar/Drive/Contacts alongside email

---

## 🔧 exec vs coding-agent vs browser

**Use exec when:**
- Single command execution
- Script running
- System operations
- Git commands
- Package management

**Use coding-agent when:**
- Multi-file code changes
- Complex debugging
- Project scaffolding
- Exploration needed

**Use browser when:**
- Web scraping
- Sites requiring JS
- Login-protected content
- Visual verification needed

---

## 📋 Deterministic Workflows

For these recurring tasks, ALWAYS use the specified skill:

| Task | Skill | Notes |
|------|-------|-------|
| Morning briefing | gog + weather | Email + calendar + weather |
| GitHub PR review | github | `gh pr list`, `gh pr view` |
| Tweet lookup | bird | `bird read <url>` |
| Code changes | coding-agent | For complex multi-file work |
| Quick file edit | edit tool | Single file, known location |
| Task management | things-mac | If using Things 3 |

---

## Negative Examples

### ❌ Common Misfires

| User Request | Wrong Choice | Right Choice |
|--------------|--------------|--------------|
| "Check my Outlook email" | gog | himalaya or browser |
| "Edit this one line" | coding-agent | edit tool |
| "What's the weather" | web_search | weather skill |
| "Post to Bluesky" | bird | browser |
| "Create a git branch" | github | exec with `git checkout -b` |
| "Read this local file" | gog | read tool |

---

*Last updated: 2026-02-12*
