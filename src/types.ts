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

// ===== Plugin System Types =====

/** Raw structure of installed_plugins.json */
export interface InstalledPluginsFile {
  version: number;
  plugins: Record<string, PluginInstallation[]>;
}

export interface PluginInstallation {
  scope: "user" | "local";
  projectPath?: string;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha?: string;
}

/** Plugin metadata from .claude-plugin/plugin.json */
export interface PluginMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: { name: string; email?: string };
  homepage?: string;
  license?: string;
  keywords?: string[];
}

/** Marketplace info from known_marketplaces.json */
export interface MarketplaceInfo {
  source: { source: string; repo: string };
  installLocation: string;
  lastUpdated: string;
}

/** Blocklist entry from blocklist.json */
export interface BlocklistEntry {
  plugin: string;
  added_at?: string;
  reason: string;
  text: string;
}

/** Plugin contents discovered by scanning installPath */
export interface PluginContents {
  commands: string[];
  skills: string[];
  agents: string[];
  mcpServers: string[];
  hasReadme: boolean;
}

// ===== Skills System Types =====

export interface SkillInfo {
  name: string;
  description: string;
  dirName: string;
  path: string;
  isSymlink: boolean;
  symlinkTarget?: string;
  userInvokable: boolean;
  source: "user" | "command" | "plugin";
  pluginName?: string;
}

// ===== MCP Server Types =====

export interface McpServerInfo {
  name: string;
  status: string;
  statusDetail?: string;
  type: string;
  category: "user" | "cloud" | "builtin";
  command?: string;
  url?: string;
  args?: string;
  env?: string;
}

/** Fully merged plugin info for display */
export interface PluginInfo {
  key: string;
  name: string;
  marketplaceId: string;
  enabled: boolean;
  installation: PluginInstallation;
  metadata: PluginMetadata | null;
  marketplace: MarketplaceInfo | null;
  blocklist: BlocklistEntry | null;
  contents: PluginContents | null;
  installPathExists: boolean;
}
