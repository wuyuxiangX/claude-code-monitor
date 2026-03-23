import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { HookSession, HookStateFile, SessionState } from "../types";

const STATE_DIR = join(homedir(), ".claude", "claude-code-monitor");
const STATE_FILE = join(STATE_DIR, "sessions.json");
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export function getStateFilePath(): string {
  return STATE_FILE;
}

export function getStateDirPath(): string {
  return STATE_DIR;
}

export function readHookSessions(): HookSession[] {
  if (!existsSync(STATE_FILE)) return [];

  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    const data: HookStateFile = JSON.parse(raw);
    const now = Date.now();

    return Object.entries(data.sessions)
      .map(([key, session]) => {
        // Ensure required fields exist (handles incomplete entries)
        const normalized: HookSession = {
          session_id: session.session_id || key,
          cwd: session.cwd || "",
          project_name:
            session.project_name ||
            session.session_id?.slice(0, 8) ||
            key.slice(0, 8),
          transcript_path: session.transcript_path || "",
          state: session.state || "ended",
          started_at: session.started_at || session.last_updated_at || now,
          last_updated_at: session.last_updated_at || now,
          ended_at: session.ended_at ?? null,
          last_event: session.last_event || "unknown",
          source: session.source || "",
          term_program: session.term_program,
        };
        // Mark stale sessions as ended
        if (
          normalized.state !== "ended" &&
          now - normalized.last_updated_at > STALE_THRESHOLD_MS
        ) {
          return {
            ...normalized,
            state: "ended" as SessionState,
            last_event: "StaleDetected",
          };
        }
        return normalized;
      })
      .sort((a, b) => b.last_updated_at - a.last_updated_at);
  } catch {
    return [];
  }
}

export function getActiveHookSessions(): HookSession[] {
  return readHookSessions().filter((s) => s.state !== "ended");
}

export function deleteHookSession(sessionId: string): boolean {
  if (!existsSync(STATE_FILE)) return false;

  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    const data: HookStateFile = JSON.parse(raw);
    if (!(sessionId in data.sessions)) return false;
    delete data.sessions[sessionId];
    writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

export function hooksInstalled(): boolean {
  return existsSync(join(STATE_DIR, "hook.sh"));
}
