# Activity Feed

Real-time activity tracking for OpenClaw agents.

## Components

1. **Log Parser** (`parse-logs.ts`) — Extracts tool events from gateway logs
2. **Activity Writer** — Hook/plugin that writes structured activity to `activity.jsonl`
3. **Web Viewer** (`index.html`) — Simple UI to view activity in real-time

## Quick Start

```bash
# View activity feed in browser
open index.html

# Or serve it
npx serve .
```

## Activity Event Schema

```typescript
interface ActivityEvent {
  ts: number;              // Unix timestamp (ms)
  id: string;              // Unique event ID
  sessionKey: string;      // Session identifier
  agentId: string;         // Agent ID
  type: 'tool' | 'model' | 'message' | 'session';
  action: string;          // Tool name or action type
  status: 'start' | 'success' | 'error';
  params?: Record<string, unknown>;  // Tool parameters (redacted)
  result?: string;         // Truncated result or error
  durationMs?: number;     // Execution time
  tokens?: {               // For model events
    input: number;
    output: number;
  };
}
```

## Data Source

Activity is parsed from:
- `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (gateway logs)
- `~/.openclaw/activity.jsonl` (dedicated activity log, when enabled)
