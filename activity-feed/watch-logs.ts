#!/usr/bin/env npx tsx
/**
 * Real-time log watcher for OpenClaw activity feed.
 * 
 * Watches the gateway log file and extracts tool events in real-time,
 * writing them to ~/.openclaw/activity.jsonl
 * 
 * Usage:
 *   npx tsx watch-logs.ts [--serve PORT]
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as http from "http";

const ACTIVITY_FILE = path.join(os.homedir(), ".openclaw", "activity.jsonl");
const LOG_DIR = "/tmp/openclaw";

interface ActivityEvent {
  ts: number;
  id: string;
  sessionKey?: string;
  agentId?: string;
  type: "tool" | "model" | "message" | "session" | "error" | "command";
  action: string;
  status: "start" | "success" | "error" | "info";
  message?: string;
  durationMs?: number;
}

interface GatewayLogEntry {
  "0"?: string;
  "1"?: string;
  _meta?: {
    date: string;
    logLevelName: string;
    name?: string;
  };
  time?: string;
}

const recentEvents: ActivityEvent[] = [];
const MAX_EVENTS = 1000;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseLogLine(line: string): ActivityEvent | null {
  try {
    const entry: GatewayLogEntry = JSON.parse(line);
    const msg = entry["0"] || entry["1"] || "";
    const ts = entry.time ? new Date(entry.time).getTime() : Date.now();
    const level = entry._meta?.logLevelName || "INFO";

    // Tool events: [tools] exec/edit/read/write/browser/etc
    const toolMatch = msg.match(/\[tools\]\s+(\w+)\s+(failed|succeeded)?:?\s*(.*)/i);
    if (toolMatch) {
      const [, action, statusWord, detail] = toolMatch;
      return {
        ts,
        id: generateId(),
        type: "tool",
        action: action.toLowerCase(),
        status: statusWord?.toLowerCase() === "failed" ? "error" : "success",
        message: detail?.slice(0, 500) || undefined,
      };
    }

    // Model usage events
    if (msg.includes("model.usage") || msg.includes("tokens")) {
      const tokenMatch = msg.match(/(\d+)\s*(?:tokens|in|out)/i);
      return {
        ts,
        id: generateId(),
        type: "model",
        action: "usage",
        status: "info",
        message: msg.slice(0, 200),
      };
    }

    // Session events
    if (msg.includes("Session") || msg.includes("session")) {
      const sessionMatch = msg.match(/agent:[\w:-]+/);
      if (sessionMatch) {
        return {
          ts,
          id: generateId(),
          type: "session",
          action: "state",
          status: "info",
          sessionKey: sessionMatch[0],
          message: msg.slice(0, 200),
        };
      }
    }

    // Error events
    if (level === "ERROR") {
      // Extract action from error message
      const actionMatch = msg.match(/\[(\w+)\]|(\w+)\s+failed/i);
      return {
        ts,
        id: generateId(),
        type: "error",
        action: actionMatch?.[1] || actionMatch?.[2] || "error",
        status: "error",
        message: msg.slice(0, 500),
      };
    }

    // Subsystem events (telegram, browser, etc)
    const subsystemMatch = entry._meta?.name?.match(/subsystem.*?([\w/]+)/);
    if (subsystemMatch && msg && entry["1"]) {
      return {
        ts,
        id: generateId(),
        type: "message",
        action: subsystemMatch[1].replace(/[{}"\s]/g, ""),
        status: level === "ERROR" ? "error" : "info",
        message: entry["1"].slice(0, 300),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function appendActivity(event: ActivityEvent): void {
  try {
    const dir = path.dirname(ACTIVITY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(ACTIVITY_FILE, JSON.stringify(event) + "\n");
    
    // Keep in memory for API
    recentEvents.unshift(event);
    if (recentEvents.length > MAX_EVENTS) {
      recentEvents.pop();
    }
  } catch (err) {
    console.error("[watch-logs] Failed to write activity:", err);
  }
}

function getCurrentLogFile(): string {
  const date = new Date().toISOString().split("T")[0];
  return path.join(LOG_DIR, `openclaw-${date}.log`);
}

function watchLogFile(): void {
  const logFile = getCurrentLogFile();
  console.log(`[watch-logs] Watching: ${logFile}`);
  
  if (!fs.existsSync(logFile)) {
    console.log(`[watch-logs] Log file not found, waiting...`);
    setTimeout(watchLogFile, 5000);
    return;
  }
  
  let fileSize = fs.statSync(logFile).size;
  
  const watcher = fs.watch(logFile, (eventType) => {
    if (eventType === "change") {
      const newSize = fs.statSync(logFile).size;
      if (newSize > fileSize) {
        // Read new content
        const stream = fs.createReadStream(logFile, {
          start: fileSize,
          end: newSize - 1,
        });
        
        let buffer = "";
        stream.on("data", (chunk) => {
          buffer += chunk.toString();
        });
        
        stream.on("end", () => {
          const lines = buffer.split("\n").filter(Boolean);
          for (const line of lines) {
            const event = parseLogLine(line);
            if (event) {
              appendActivity(event);
              console.log(`[${new Date(event.ts).toLocaleTimeString()}] ${event.type}:${event.action} - ${event.status}`);
            }
          }
        });
        
        fileSize = newSize;
      }
    }
  });
  
  // Check for log rotation at midnight
  const checkRotation = setInterval(() => {
    const newLogFile = getCurrentLogFile();
    if (newLogFile !== logFile) {
      console.log(`[watch-logs] Log rotated, switching to: ${newLogFile}`);
      watcher.close();
      clearInterval(checkRotation);
      setTimeout(watchLogFile, 1000);
    }
  }, 60000);
  
  process.on("SIGINT", () => {
    console.log("\n[watch-logs] Shutting down...");
    watcher.close();
    clearInterval(checkRotation);
    process.exit(0);
  });
}

function startServer(port: number): void {
  const server = http.createServer((req, res) => {
    // CORS headers
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
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);
      const type = url.searchParams.get("type");
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      
      let filtered = recentEvents;
      if (type) {
        filtered = filtered.filter(e => e.type === type);
      }
      if (since > 0) {
        filtered = filtered.filter(e => e.ts > since);
      }
      
      res.writeHead(200);
      res.end(JSON.stringify(filtered.slice(0, limit)));
      return;
    }
    
    if (url.pathname === "/api/stats") {
      const stats = {
        total: recentEvents.length,
        byType: recentEvents.reduce((acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        errors: recentEvents.filter(e => e.status === "error").length,
        lastEvent: recentEvents[0]?.ts || null,
      };
      
      res.writeHead(200);
      res.end(JSON.stringify(stats));
      return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });
  
  server.listen(port, () => {
    console.log(`[watch-logs] API server running on http://localhost:${port}`);
    console.log(`  GET /api/activity?limit=100&type=tool&since=<ts>`);
    console.log(`  GET /api/stats`);
  });
}

// Load existing events from activity file
function loadExistingEvents(): void {
  if (fs.existsSync(ACTIVITY_FILE)) {
    try {
      const content = fs.readFileSync(ACTIVITY_FILE, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      for (const line of lines.slice(-MAX_EVENTS)) {
        try {
          const event = JSON.parse(line) as ActivityEvent;
          recentEvents.push(event);
        } catch {}
      }
      recentEvents.sort((a, b) => b.ts - a.ts);
      console.log(`[watch-logs] Loaded ${recentEvents.length} existing events`);
    } catch (err) {
      console.error("[watch-logs] Failed to load existing events:", err);
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const serveIdx = args.indexOf("--serve");
  const port = serveIdx >= 0 ? parseInt(args[serveIdx + 1] || "8742", 10) : null;
  
  console.log("🦞 OpenClaw Activity Feed Watcher");
  console.log("─".repeat(40));
  
  loadExistingEvents();
  
  if (port) {
    startServer(port);
  }
  
  watchLogFile();
}

main();
