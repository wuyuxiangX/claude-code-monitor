export type SessionState = "active" | "waiting" | "idle" | "ended";

/** Hook state entry written by hook.sh */
export interface HookSession {
  session_id: string;
  cwd: string;
  project_name: string;
  transcript_path: string;
  state: SessionState;
  started_at: number;
  last_updated_at: number;
  ended_at: number | null;
  last_event: string;
  source: string;
  term_program?: string;
  label?: string;
  first_prompt?: string;
  is_worktree?: boolean;
  worktree_name?: string;
}

export interface HookStateRaw extends HookSession {
  _internal?: boolean;
}

export interface HookStateFile {
  version: number;
  sessions: Record<string, HookStateRaw>;
}

/** JSONL session metadata parsed from transcript files */
export interface SessionMetadata {
  id: string;
  filePath: string;
  projectPath: string;
  projectName: string;
  summary: string;
  firstMessage: string;
  lastModified: Date;
  turnCount: number;
  cost: number;
  model?: string;
  gitBranch?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

/** Merged session combining hook state + JSONL metadata */
export interface Session {
  session_id: string;
  cwd: string;
  project_name: string;
  state: SessionState;
  started_at: number;
  last_updated_at: number;
  ended_at: number | null;
  last_event: string;
  // JSONL metadata (may be undefined if not matched)
  summary?: string;
  firstMessage?: string;
  turnCount?: number;
  cost?: number;
  model?: string;
  transcript_path?: string;
  term_program?: string;
  gitBranch?: string;
  label?: string;
  first_prompt?: string;
  is_worktree?: boolean;
  worktree_name?: string;
}

export interface SessionDetail extends SessionMetadata {
  messages: SessionMessage[];
}

export interface SessionMessage {
  type: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  toolUse?: boolean;
}

export interface UsageStats {
  totalSessions: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  sessionsByProject: Record<
    string,
    { count: number; cost: number; inputTokens: number; outputTokens: number }
  >;
  modelBreakdown: Record<string, { sessions: number; cost: number }>;
  topSessions: SessionMetadata[];
}

export interface DailyStats {
  date: string;
  sessions: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
}
