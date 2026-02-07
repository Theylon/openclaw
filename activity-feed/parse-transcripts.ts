#!/usr/bin/env npx tsx
/**
 * Parse OpenClaw session transcripts and extract activity events.
 * 
 * Usage:
 *   npx tsx parse-transcripts.ts [--agent <id>] [--session <id>] [--json] [--serve PORT]
 */

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

interface ToolResult {
  type: "toolResult";
  toolCallId: string;
  content: string;
  isError?: boolean;
}

interface MessageContent {
  type: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  toolCallId?: string;
  content?: string;
  isError?: boolean;
  text?: string;
}

interface TranscriptMessage {
  type: string;
  id: string;
  parentId?: string;
  timestamp: string;
  message?: {
    role: string;
    content: MessageContent[];
    model?: string;
    provider?: string;
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
  type: "tool" | "model" | "message" | "error";
  action: string;
  status: "start" | "success" | "error" | "info";
  params?: Record<string, unknown>;
  result?: string;
  durationMs?: number;
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
        const resultText = typeof item.content === "string" 
          ? item.content 
          : JSON.stringify(item.content);
        
        events.push({
          ts,
          id: item.toolCallId || `${ts}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId,
          agentId,
          type: "tool",
          action: "result",
          status: item.isError ? "error" : "success",
          result: resultText?.slice(0, 500),
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
  } catch {
    // Skip malformed lines
  }
  
  return events;
}

async function parseTranscriptFile(filePath: string, agentId: string): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];
  const sessionId = path.basename(filePath, ".jsonl");
  
  if (!fs.existsSync(filePath)) return events;
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  for await (const line of rl) {
    events.push(...parseTranscriptLine(line, agentId, sessionId));
  }
  
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
    
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith(".jsonl"))
      .map(f => ({
        name: f,
        path: path.join(sessionsDir, f),
        mtime: fs.statSync(path.join(sessionsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5); // Only parse 5 most recent sessions per agent
    
    for (const file of files) {
      const events = await parseTranscriptFile(file.path, agent);
      allEvents.push(...events);
      
      if (allEvents.length >= limit * 2) break;
    }
  }
  
  return allEvents
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

function startServer(port: number): void {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/json");
    
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    
    if (url.pathname === "/api/activity") {
      const limit = parseInt(url.searchParams.get("limit") || "200", 10);
      const type = url.searchParams.get("type") || undefined;
      const agent = url.searchParams.get("agent") || undefined;
      const action = url.searchParams.get("action") || undefined;
      const status = url.searchParams.get("status") || undefined;
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      
      let events = await getAllEvents(agent, limit * 2);
      
      if (type) events = events.filter(e => e.type === type);
      if (action) events = events.filter(e => e.action === action);
      if (status) events = events.filter(e => e.status === status);
      if (since > 0) events = events.filter(e => e.ts > since);
      
      res.writeHead(200);
      res.end(JSON.stringify(events.slice(0, limit)));
      return;
    }
    
    if (url.pathname === "/api/stats") {
      const events = await getAllEvents(undefined, 1000);
      
      const stats = {
        total: events.length,
        byType: {} as Record<string, number>,
        byAction: {} as Record<string, number>,
        byAgent: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        errors: events.filter(e => e.status === "error").length,
        totalCost: events.reduce((sum, e) => sum + (e.cost || 0), 0),
        totalTokens: events.reduce((sum, e) => sum + (e.tokens?.total || 0), 0),
      };
      
      for (const e of events) {
        stats.byType[e.type] = (stats.byType[e.type] || 0) + 1;
        stats.byAction[e.action] = (stats.byAction[e.action] || 0) + 1;
        if (e.agentId) stats.byAgent[e.agentId] = (stats.byAgent[e.agentId] || 0) + 1;
        stats.byStatus[e.status] = (stats.byStatus[e.status] || 0) + 1;
      }
      
      res.writeHead(200);
      res.end(JSON.stringify(stats));
      return;
    }
    
    if (url.pathname === "/api/agents") {
      const agentsDir = path.join(OPENCLAW_DIR, "agents");
      const agents = fs.existsSync(agentsDir)
        ? fs.readdirSync(agentsDir).filter(f => 
            fs.statSync(path.join(agentsDir, f)).isDirectory()
          )
        : [];
      
      res.writeHead(200);
      res.end(JSON.stringify(agents));
      return;
    }
    
    if (url.pathname === "/api/tools") {
      const events = await getAllEvents(undefined, 1000);
      const tools = [...new Set(events.filter(e => e.type === "tool").map(e => e.action))];
      
      res.writeHead(200);
      res.end(JSON.stringify(tools.sort()));
      return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });
  
  server.listen(port, () => {
    console.log(`📊 Activity Feed API running on http://localhost:${port}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET /api/activity?limit=200&type=tool&action=exec&status=error&agent=demrezel&since=<ts>`);
    console.log(`  GET /api/stats`);
    console.log(`  GET /api/agents`);
    console.log(`  GET /api/tools`);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const serveIdx = args.indexOf("--serve");
  const port = serveIdx >= 0 ? parseInt(args[serveIdx + 1] || "8742", 10) : null;
  const jsonOutput = args.includes("--json");
  
  if (port) {
    startServer(port);
    return;
  }
  
  // CLI mode
  const agentIdx = args.indexOf("--agent");
  const agent = agentIdx >= 0 ? args[agentIdx + 1] : undefined;
  
  const events = await getAllEvents(agent, 100);
  
  if (jsonOutput) {
    console.log(JSON.stringify(events, null, 2));
  } else {
    console.log(`\n📊 Activity Feed (${events.length} events)\n`);
    
    const byType: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    
    for (const e of events) {
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.type === "tool") byAction[e.action] = (byAction[e.action] || 0) + 1;
    }
    
    console.log("By Type:", byType);
    console.log("Tool Actions:", byAction);
    
    console.log("\nRecent Events:");
    for (const e of events.slice(0, 10)) {
      const time = new Date(e.ts).toLocaleTimeString();
      const status = e.status === "error" ? "❌" : e.status === "success" ? "✅" : "ℹ️";
      console.log(`  [${time}] ${status} ${e.type}:${e.action} (${e.agentId})`);
    }
  }
}

main().catch(console.error);
