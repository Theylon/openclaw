# OpenClaw Activity Feed - Complete Implementation

**Date:** 2026-02-07  
**Status:** ✅ Working  
**Location:** `~/.openclaw/workspaces/demrezel/activity-feed/`

## Overview

Built a real-time activity feed for OpenClaw that tracks all agent tool calls, model usage, and costs. The system parses session transcripts (JSONL files) and serves them via an HTTP API that a web UI consumes.

### The Problem

OpenClaw's gateway logs only capture **errors**, not successful tool calls. To get full visibility into what agents are doing, we needed to tap into the session transcripts which contain everything.

### Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Session Transcripts │────▶│  Parse Transcripts│────▶│   HTTP API      │
│  (~/.openclaw/agents/│     │  (TypeScript)     │     │  localhost:8742 │
│   */sessions/*.jsonl)│     └──────────────────┘     └────────┬────────┘
└─────────────────────┘                                        │
                                                               ▼
                                                    ┌─────────────────┐
                                                    │   Web UI        │
                                                    │   (index.html)  │
                                                    └─────────────────┘
```

## Files

### 1. `parse-transcripts.ts` - API Server

The core component. Parses JSONL session transcripts and serves activity via HTTP.

**Key functions:**
- `parseTranscriptLine()` - Extracts tool calls and model usage from a single JSONL line
- `parseTranscriptFile()` - Reads an entire transcript file
- `getAllEvents()` - Aggregates events across all agents/sessions
- `startServer()` - HTTP server with filtering endpoints

**Transcript Structure:**
```json
{
  "type": "message",
  "timestamp": "2026-02-07T13:05:00.000Z",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "toolCall", "id": "toolu_xxx", "name": "exec", "arguments": {...} },
      { "type": "toolResult", "toolCallId": "toolu_xxx", "content": "...", "isError": false }
    ],
    "usage": { "input": 1000, "output": 500, "totalTokens": 1500, "cost": { "total": 0.05 } }
  }
}
```

**API Endpoints:**
```
GET /api/activity?limit=200&type=tool&action=exec&status=error&agent=demrezel&since=<ts>
GET /api/stats      → { total, byType, byAction, byAgent, errors, totalCost, totalTokens }
GET /api/agents     → ["demrezel", "planner", "missioncontrol"]
GET /api/tools      → ["exec", "read", "write", "edit", "browser", ...]
```

**Activity Event Schema:**
```typescript
interface ActivityEvent {
  ts: number;           // Unix timestamp (ms)
  id: string;           // Unique event ID (from tool call ID)
  sessionId?: string;   // Session file name
  agentId?: string;     // Agent ID
  type: "tool" | "model" | "error";
  action: string;       // Tool name or "usage"
  status: "start" | "success" | "error" | "info";
  params?: Record<string, unknown>;  // Tool arguments
  result?: string;      // Tool result (truncated)
  model?: string;       // Model ID for model events
  tokens?: { input, output, total };
  cost?: number;        // USD cost
}
```

### 2. `index.html` - Web UI

Single-file web app with:
- **Stats bar**: Total events, tool calls, errors, tokens, cost
- **Filters**: Type pills, status pills, agent dropdown, tool dropdown
- **Timeline**: Scrollable list of events with details
- **Auto-refresh**: Every 10 seconds

**Features:**
- Dark theme matching OpenClaw branding
- Responsive grid layout
- Expandable event details (shows tool arguments/results)
- Color-coded status badges
- Token/cost display for model events

### 3. `start.sh` - Startup Script

```bash
#!/bin/bash
cd ~/.openclaw/workspaces/demrezel/activity-feed
npx tsx parse-transcripts.ts --serve 8742
```

### 4. Hook: `~/.openclaw/hooks/activity-logger/`

A lightweight hook that captures command events (/new, /reset, /stop) and writes them to `~/.openclaw/activity.jsonl`. Less important now that we parse transcripts directly.

## Usage

### Start the Activity Feed

```bash
# Terminal 1: Start API server
cd ~/.openclaw/workspaces/demrezel/activity-feed
npx tsx parse-transcripts.ts --serve 8742

# Terminal 2 (or just double-click):
open index.html
```

### CLI Usage

```bash
# Get stats
curl -s http://localhost:8742/api/stats | jq .

# Get recent tool calls
curl -s "http://localhost:8742/api/activity?type=tool&limit=10" | jq .

# Filter by agent
curl -s "http://localhost:8742/api/activity?agent=demrezel" | jq .

# Filter by tool
curl -s "http://localhost:8742/api/activity?action=exec" | jq .
```

## Code

### parse-transcripts.ts (full)

```typescript
#!/usr/bin/env npx tsx
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as http from "http";
import * as readline from "readline";

interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface MessageContent {
  type: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  toolCallId?: string;
  content?: string;
  isError?: boolean;
}

interface TranscriptMessage {
  type: string;
  id: string;
  timestamp: string;
  message?: {
    role: string;
    content: MessageContent[];
    model?: string;
    usage?: {
      input: number;
      output: number;
      totalTokens: number;
      cost?: { total: number };
    };
  };
}

interface ActivityEvent {
  ts: number;
  id: string;
  sessionId?: string;
  agentId?: string;
  type: "tool" | "model" | "error";
  action: string;
  status: "start" | "success" | "error" | "info";
  params?: Record<string, unknown>;
  result?: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  cost?: number;
}

const OPENCLAW_DIR = path.join(os.homedir(), ".openclaw");

function parseTranscriptLine(line: string, agentId: string, sessionId: string): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  
  try {
    const entry: TranscriptMessage = JSON.parse(line);
    if (entry.type !== "message" || !entry.message) return events;
    
    const ts = new Date(entry.timestamp).getTime();
    const content = entry.message.content || [];
    
    // Extract tool calls
    for (const item of content) {
      if (item.type === "toolCall" && item.name) {
        events.push({
          ts,
          id: item.id || `${ts}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId,
          agentId,
          type: "tool",
          action: item.name,
          status: "start",
          params: item.arguments,
        });
      }
      
      if (item.type === "toolResult") {
        events.push({
          ts,
          id: item.toolCallId || `${ts}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId,
          agentId,
          type: "tool",
          action: "result",
          status: item.isError ? "error" : "success",
          result: typeof item.content === "string" ? item.content?.slice(0, 500) : undefined,
        });
      }
    }
    
    // Extract model usage
    if (entry.message.usage && entry.message.role === "assistant") {
      events.push({
        ts,
        id: `model-${ts}`,
        sessionId,
        agentId,
        type: "model",
        action: "usage",
        status: "info",
        model: entry.message.model,
        tokens: {
          input: entry.message.usage.input,
          output: entry.message.usage.output,
          total: entry.message.usage.totalTokens,
        },
        cost: entry.message.usage.cost?.total,
      });
    }
  } catch {}
  
  return events;
}

async function getAllEvents(agentFilter?: string, limit = 500): Promise<ActivityEvent[]> {
  const agentsDir = path.join(OPENCLAW_DIR, "agents");
  const allEvents: ActivityEvent[] = [];
  
  if (!fs.existsSync(agentsDir)) return allEvents;
  
  const agents = agentFilter 
    ? [agentFilter] 
    : fs.readdirSync(agentsDir).filter(f => 
        fs.statSync(path.join(agentsDir, f)).isDirectory()
      );
  
  for (const agent of agents) {
    const sessionsDir = path.join(agentsDir, agent, "sessions");
    if (!fs.existsSync(sessionsDir)) continue;
    
    // Get 5 most recent sessions per agent
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith(".jsonl"))
      .map(f => ({
        name: f,
        path: path.join(sessionsDir, f),
        mtime: fs.statSync(path.join(sessionsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5);
    
    for (const file of files) {
      const fileStream = fs.createReadStream(file.path);
      const rl = readline.createInterface({ input: fileStream });
      
      for await (const line of rl) {
        allEvents.push(...parseTranscriptLine(line, agent, file.name.replace(".jsonl", "")));
      }
    }
  }
  
  return allEvents.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

function startServer(port: number): void {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    
    if (url.pathname === "/api/activity") {
      const limit = parseInt(url.searchParams.get("limit") || "200", 10);
      const type = url.searchParams.get("type") || undefined;
      const agent = url.searchParams.get("agent") || undefined;
      const action = url.searchParams.get("action") || undefined;
      const status = url.searchParams.get("status") || undefined;
      
      let events = await getAllEvents(agent, limit * 2);
      
      if (type) events = events.filter(e => e.type === type);
      if (action) events = events.filter(e => e.action === action);
      if (status) events = events.filter(e => e.status === status);
      
      res.end(JSON.stringify(events.slice(0, limit)));
      return;
    }
    
    if (url.pathname === "/api/stats") {
      const events = await getAllEvents(undefined, 1000);
      res.end(JSON.stringify({
        total: events.length,
        byType: events.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {}),
        byAction: events.reduce((acc, e) => { acc[e.action] = (acc[e.action] || 0) + 1; return acc; }, {}),
        byAgent: events.reduce((acc, e) => { if (e.agentId) acc[e.agentId] = (acc[e.agentId] || 0) + 1; return acc; }, {}),
        errors: events.filter(e => e.status === "error").length,
        totalCost: events.reduce((sum, e) => sum + (e.cost || 0), 0),
        totalTokens: events.reduce((sum, e) => sum + (e.tokens?.total || 0), 0),
      }));
      return;
    }
    
    if (url.pathname === "/api/agents") {
      const agentsDir = path.join(OPENCLAW_DIR, "agents");
      const agents = fs.existsSync(agentsDir)
        ? fs.readdirSync(agentsDir).filter(f => fs.statSync(path.join(agentsDir, f)).isDirectory())
        : [];
      res.end(JSON.stringify(agents));
      return;
    }
    
    if (url.pathname === "/api/tools") {
      const events = await getAllEvents(undefined, 1000);
      const tools = [...new Set(events.filter(e => e.type === "tool").map(e => e.action))];
      res.end(JSON.stringify(tools.filter(t => t !== "result").sort()));
      return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });
  
  server.listen(port, () => {
    console.log(`📊 Activity Feed API running on http://localhost:${port}`);
  });
}

// Entry point
const args = process.argv.slice(2);
const serveIdx = args.indexOf("--serve");
const port = serveIdx >= 0 ? parseInt(args[serveIdx + 1] || "8742", 10) : null;

if (port) {
  startServer(port);
} else {
  getAllEvents().then(events => console.log(JSON.stringify(events, null, 2)));
}
```

## Sample Output

```json
// GET /api/stats
{
  "total": 1000,
  "byType": { "tool": 462, "model": 538 },
  "byAction": { "exec": 245, "edit": 119, "read": 23, "write": 13, ... },
  "byAgent": { "demrezel": 239, "planner": 744, "missioncontrol": 17 },
  "errors": 0,
  "totalCost": 39.33,
  "totalTokens": 73347431
}

// GET /api/activity?type=tool&limit=1
[{
  "ts": 1770462482516,
  "id": "toolu_01Hzqu2LkdC38XjLmjgSnJUT",
  "sessionId": "16a4e7b7-3649-4256-83f4-c02055474450-topic-1",
  "agentId": "demrezel",
  "type": "tool",
  "action": "exec",
  "status": "start",
  "params": { "command": "curl -s http://localhost:8742/api/stats | jq .", "timeout": 10 }
}]
```

## Future Improvements

1. **WebSocket streaming** - Push new events instead of polling
2. **Persistent activity log** - Write to `activity.jsonl` for faster startup
3. **Cost breakdown charts** - Visualize spending by agent/model/day
4. **Tool result correlation** - Match toolCall → toolResult pairs
5. **Plugin integration** - Use `tool_result_persist` hook for real-time capture
6. **Search** - Full-text search across tool params/results

## Related Files

- Session transcripts: `~/.openclaw/agents/*/sessions/*.jsonl`
- Gateway logs: `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (errors only)
- Hook: `~/.openclaw/hooks/activity-logger/`
