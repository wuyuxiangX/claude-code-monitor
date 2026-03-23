import { useCachedPromise } from "@raycast/utils";
import { useEffect, useCallback } from "react";
import { readHookSessions } from "../lib/hook-state";
import { listAllSessions, encodeProjectPath } from "../lib/session-parser";
import { Session, HookSession, SessionMetadata } from "../types";

/**
 * Merge hook state (real-time status) with JSONL metadata (cost, summary, etc.)
 */
function mergeSessions(
  hookSessions: HookSession[],
  jsonlSessions: SessionMetadata[],
): Session[] {
  // Build lookup by session ID from JSONL
  const jsonlById = new Map<string, SessionMetadata>();
  for (const s of jsonlSessions) {
    jsonlById.set(s.id, s);
  }

  // Build lookup by project encoded path for fuzzy matching
  const jsonlByProject = new Map<string, SessionMetadata[]>();
  for (const s of jsonlSessions) {
    const encoded = encodeProjectPath(s.projectPath);
    const list = jsonlByProject.get(encoded) || [];
    list.push(s);
    jsonlByProject.set(encoded, list);
  }

  return hookSessions.map((hook) => {
    // Try to find matching JSONL session
    const jsonl = jsonlById.get(hook.session_id);

    return {
      session_id: hook.session_id,
      cwd: hook.cwd,
      project_name: hook.project_name,
      state: hook.state,
      started_at: hook.started_at,
      last_updated_at: hook.last_updated_at,
      ended_at: hook.ended_at,
      last_event: hook.last_event,
      transcript_path: hook.transcript_path,
      term_program: hook.term_program,
      // Merge JSONL metadata if found
      summary: jsonl?.summary,
      firstMessage: jsonl?.firstMessage,
      turnCount: jsonl?.turnCount,
      cost: jsonl?.cost,
      model: jsonl?.model,
      gitBranch: jsonl?.gitBranch,
    };
  });
}

export function useSessions(pollInterval: number = 3000) {
  const { data, isLoading, revalidate } = useCachedPromise(async () => {
    const hookSessions = readHookSessions();
    // Only load recent JSONL sessions for metadata enrichment
    const jsonlSessions = await listAllSessions({ limit: 50 });
    const merged = mergeSessions(hookSessions, jsonlSessions);

    const active = merged.filter((s) => s.state === "active");
    const waiting = merged.filter((s) => s.state === "waiting");
    const idle = merged.filter((s) => s.state === "idle");
    const ended = merged.filter((s) => s.state === "ended");

    return { all: merged, active, waiting, idle, ended };
  }, []);

  const stableRevalidate = useCallback(() => {
    revalidate();
  }, [revalidate]);

  // Poll for updates
  useEffect(() => {
    const timer = setInterval(stableRevalidate, pollInterval);
    return () => clearInterval(timer);
  }, [stableRevalidate, pollInterval]);

  return {
    sessions: data?.all ?? [],
    activeSessions: data?.active ?? [],
    waitingSessions: data?.waiting ?? [],
    idleSessions: data?.idle ?? [],
    endedSessions: data?.ended ?? [],
    isLoading,
    revalidate: stableRevalidate,
  };
}
