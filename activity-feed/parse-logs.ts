#!/usr/bin/env npx tsx
/**
 * Parse OpenClaw gateway logs and extract activity events.
 * 
 * Usage:
 *   npx tsx parse-logs.ts [--date YYYY-MM-DD] [--follow] [--json]
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

interface ActivityEvent {
  ts: number;
  id: string;
  sessionKey?: string;
  agentId?: string;
  type: "tool" | "model" | "message" | "session" | "error";
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
        id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
        type: "tool",
        action: action.toLowerCase(),
        status: statusWord?.toLowerCase() === "failed" ? "error" : "success",
        message: detail?.slice(0, 500) || undefined,
      };
    }

    // Session events
    if (msg.includes("Session store") || msg.includes("session")) {
      const sessionMatch = msg.match(/agent:[\w:-]+/);
      return {
        ts,
        id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
        type: "session",
        action: "state",
        status: "info",
        sessionKey: sessionMatch?.[0],
        message: msg.slice(0, 200),
      };
    }

    // Error events
    if (level === "ERROR") {
      return {
        ts,
        id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
        type: "error",
        action: "error",
        status: "error",
        message: msg.slice(0, 500),
      };
    }

    // Subsystem events (telegram, browser, etc)
    const subsystemMatch = entry._meta?.name?.match(/subsystem.*?([\w/]+)/);
    if (subsystemMatch && msg) {
      return {
        ts,
        id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
        type: "message",
        action: subsystemMatch[1].replace(/[{}"\s]/g, ""),
        status: level === "ERROR" ? "error" : "info",
        message: (entry["1"] || msg).slice(0, 300),
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function parseLogFile(filePath: string): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];
  
  if (!fs.existsSync(filePath)) {
    console.error(`Log file not found: ${filePath}`);
    return events;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const event = parseLogLine(line);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

async function main() {
  const args = process.argv.slice(2);
  const dateArg = args.find((a, i) => args[i - 1] === "--date") || 
    new Date().toISOString().split("T")[0];
  const jsonOutput = args.includes("--json");

  const logPath = `/tmp/openclaw/openclaw-${dateArg}.log`;
  
  console.error(`Parsing: ${logPath}`);
  
  const events = await parseLogFile(logPath);
  
  if (jsonOutput) {
    console.log(JSON.stringify(events, null, 2));
  } else {
    console.log(`\n📊 Activity Summary for ${dateArg}`);
    console.log("─".repeat(50));
    
    const byType = events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("\nBy Type:");
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${type}: ${count}`);
    }

    const errors = events.filter(e => e.status === "error");
    if (errors.length > 0) {
      console.log(`\n❌ Recent Errors (${errors.length} total):`);
      errors.slice(-5).forEach(e => {
        const time = new Date(e.ts).toLocaleTimeString();
        console.log(`  [${time}] ${e.action}: ${e.message?.slice(0, 80)}...`);
      });
    }

    const tools = events.filter(e => e.type === "tool");
    if (tools.length > 0) {
      console.log(`\n🔧 Tool Activity (${tools.length} total):`);
      const byAction = tools.reduce((acc, e) => {
        acc[e.action] = (acc[e.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      for (const [action, count] of Object.entries(byAction).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${action}: ${count}`);
      }
    }
  }
}

main().catch(console.error);
