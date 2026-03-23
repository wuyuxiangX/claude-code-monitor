import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { SessionMetadata, SessionDetail, SessionMessage } from "../types";

interface JSONLEntry {
  type: string;
  summary?: string;
  leafUuid?: string;
  uuid?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string }>;
  };
  costUSD?: number;
  model?: string;
  timestamp?: string;
  gitBranch?: string;
}

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

// Cache resolved paths
const resolvedPathCache = new Map<string, string>();

export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/[/.]/g, "-");
}

export function getProjectName(projectPath: string): string {
  return path.basename(projectPath) || projectPath;
}

/**
 * Resolve encoded dir name to original path.
 * Priority: sessions-index.json > filesystem walk > naive decode
 */
export async function resolveProjectPath(
  encodedDirName: string,
): Promise<string> {
  const cached = resolvedPathCache.get(encodedDirName);
  if (cached) return cached;

  // 1. Try sessions-index.json
  try {
    const indexPath = path.join(
      PROJECTS_DIR,
      encodedDirName,
      "sessions-index.json",
    );
    const content = await fs.promises.readFile(indexPath, "utf8");
    const index = JSON.parse(content);
    if (index.originalPath && typeof index.originalPath === "string") {
      resolvedPathCache.set(encodedDirName, index.originalPath);
      return index.originalPath;
    }
  } catch {
    // Continue to next strategy
  }

  // 2. Try filesystem-guided resolution
  const fsResolved = await resolveByFilesystemWalk(encodedDirName);
  if (fsResolved) {
    resolvedPathCache.set(encodedDirName, fsResolved);
    return fsResolved;
  }

  // 3. Naive decode (last resort)
  const decoded = "/" + encodedDirName.slice(1).replace(/-/g, "/");
  try {
    await fs.promises.access(decoded);
    resolvedPathCache.set(encodedDirName, decoded);
  } catch {
    // Don't cache lossy results
  }
  return decoded;
}

async function resolveByFilesystemWalk(
  encodedDirName: string,
): Promise<string | null> {
  const homedir = os.homedir();
  const encodedHome = encodeProjectPath(homedir);

  if (!encodedDirName.startsWith(encodedHome)) return null;

  const remainder = encodedDirName.slice(encodedHome.length);
  if (!remainder) return homedir;
  if (remainder[0] !== "-") return null;

  const rest = remainder.slice(1);
  if (!rest) return homedir;

  return walkPathSegments(homedir, rest.split("-"));
}

async function walkPathSegments(
  basePath: string,
  parts: string[],
): Promise<string | null> {
  if (parts.length === 0) return basePath;

  for (let take = parts.length; take >= 1; take--) {
    const componentParts = parts.slice(0, take);
    const remaining = parts.slice(take);

    let component = componentParts.join("-");
    if (component.startsWith("-")) {
      component = "." + component.slice(1);
    } else if (component === "") {
      continue;
    }

    const candidatePath = path.join(basePath, component);
    try {
      const stat = await fs.promises.stat(candidatePath);
      if (remaining.length === 0) return candidatePath;
      if (stat.isDirectory()) {
        const resolved = await walkPathSegments(candidatePath, remaining);
        if (resolved) return resolved;
      }
    } catch {
      // Continue trying
    }
  }
  return null;
}

export async function listProjectDirs(): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(PROJECTS_DIR, {
      withFileTypes: true,
    });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function listSessionFiles(
  encodedProjectPath: string,
): Promise<string[]> {
  const projectDir = path.join(PROJECTS_DIR, encodedProjectPath);
  try {
    const entries = await fs.promises.readdir(projectDir);
    return entries.filter((e) => e.endsWith(".jsonl"));
  } catch {
    return [];
  }
}

async function parseSessionMetadataFast(
  filePath: string,
): Promise<Partial<SessionMetadata>> {
  return new Promise((resolve) => {
    const result: Partial<SessionMetadata> = {};
    let lineCount = 0;
    let turnCount = 0;
    let totalCost = 0;
    let resolved = false;

    const safeResolve = () => {
      if (resolved) return;
      resolved = true;
      result.turnCount = turnCount;
      result.cost = totalCost;
      resolve(result);
    };

    const stream = fs.createReadStream(filePath, {
      encoding: "utf8",
      highWaterMark: 16 * 1024,
    });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const cleanup = () => {
      rl.removeAllListeners();
      stream.removeAllListeners();
      rl.close();
      stream.destroy();
    };

    rl.on("line", (line) => {
      if (resolved) return;
      lineCount++;

      try {
        const entry: JSONLEntry = JSON.parse(line);

        if (entry.type === "summary") {
          result.summary = entry.summary || "";
          result.id = entry.leafUuid || path.basename(filePath, ".jsonl");
        }

        if (entry.type === "user" || entry.type === "human") {
          turnCount++;
          if (!result.firstMessage && entry.message?.content) {
            const content = entry.message.content;
            if (typeof content === "string") {
              result.firstMessage = content.slice(0, 200);
            } else if (Array.isArray(content)) {
              const textBlock = content.find((b) => b.type === "text");
              result.firstMessage = textBlock?.text?.slice(0, 200) || "";
            }
          }
        }

        if (entry.type === "assistant") turnCount++;
        if (entry.costUSD) totalCost += entry.costUSD;
        if (entry.model) result.model = entry.model;
        if (entry.gitBranch) result.gitBranch = entry.gitBranch;
      } catch {
        // Skip unparseable lines
      }

      if (lineCount >= 50) {
        cleanup();
        safeResolve();
      }
    });

    rl.on("close", safeResolve);
    rl.on("error", () => {
      cleanup();
      safeResolve();
    });
    stream.on("error", () => {
      cleanup();
      safeResolve();
    });
  });
}

/**
 * List all sessions across all projects.
 */
export async function listAllSessions(options?: {
  limit?: number;
  afterDate?: Date;
}): Promise<SessionMetadata[]> {
  const sessions: SessionMetadata[] = [];
  const projectDirs = await listProjectDirs();
  const afterDate = options?.afterDate;
  const limit = options?.limit;

  const fileInfos: Array<{
    filePath: string;
    projectDir: string;
    mtime: Date;
  }> = [];

  for (const projectDir of projectDirs) {
    const sessionFiles = await listSessionFiles(projectDir);
    for (const sessionFile of sessionFiles) {
      const filePath = path.join(PROJECTS_DIR, projectDir, sessionFile);
      try {
        const stat = await fs.promises.stat(filePath);
        if (afterDate && stat.mtime < afterDate) continue;
        fileInfos.push({ filePath, projectDir, mtime: stat.mtime });
      } catch {
        // Skip
      }
    }
  }

  fileInfos.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  const filesToParse = limit ? fileInfos.slice(0, limit) : fileInfos;

  for (const { filePath, projectDir, mtime } of filesToParse) {
    try {
      const metadata = await parseSessionMetadataFast(filePath);
      const projectPath = await resolveProjectPath(projectDir);

      sessions.push({
        id: metadata.id || path.basename(filePath, ".jsonl"),
        filePath,
        projectPath,
        projectName: getProjectName(projectPath),
        summary: metadata.summary || "",
        firstMessage: metadata.firstMessage || "",
        lastModified: mtime,
        turnCount: metadata.turnCount || 0,
        cost: metadata.cost || 0,
        model: metadata.model,
        gitBranch: metadata.gitBranch,
      });
    } catch {
      // Skip
    }
  }

  return sessions;
}

/**
 * Get full session details including all messages.
 */
export async function getSessionDetail(
  sessionId: string,
): Promise<SessionDetail | null> {
  const projectDirs = await listProjectDirs();

  for (const projectDir of projectDirs) {
    const sessionFiles = await listSessionFiles(projectDir);
    const matchingFile = sessionFiles.find(
      (f) => f === `${sessionId}.jsonl` || f.includes(sessionId),
    );

    if (matchingFile) {
      const filePath = path.join(PROJECTS_DIR, projectDir, matchingFile);
      return parseFullSession(filePath, projectDir);
    }
  }
  return null;
}

async function parseFullSession(
  filePath: string,
  encodedProjectPath: string,
): Promise<SessionDetail> {
  return new Promise((resolve, reject) => {
    const messages: SessionMessage[] = [];
    let summary = "";
    let id = path.basename(filePath, ".jsonl");
    let totalCost = 0;
    let model: string | undefined;
    let firstMessage = "";

    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream });

    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const entry: JSONLEntry = JSON.parse(line);

        if (entry.type === "summary") {
          summary = entry.summary || "";
          id = entry.leafUuid || id;
        }

        if (entry.type === "user" || entry.type === "human") {
          let content = "";
          if (typeof entry.message?.content === "string") {
            content = entry.message.content;
          } else if (Array.isArray(entry.message?.content)) {
            content = entry.message.content
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("\n");
          }
          if (!firstMessage) firstMessage = content.slice(0, 200);
          messages.push({
            type: "user",
            content,
            timestamp: entry.timestamp ? new Date(entry.timestamp) : undefined,
          });
        }

        if (entry.type === "assistant") {
          let content = "";
          let hasToolUse = false;
          if (typeof entry.message?.content === "string") {
            content = entry.message.content;
          } else if (Array.isArray(entry.message?.content)) {
            for (const block of entry.message.content) {
              if (block.type === "text") content += block.text || "";
              else if (block.type === "tool_use") hasToolUse = true;
            }
          }
          messages.push({
            type: "assistant",
            content,
            timestamp: entry.timestamp ? new Date(entry.timestamp) : undefined,
            toolUse: hasToolUse,
          });
        }

        if (entry.costUSD) totalCost += entry.costUSD;
        if (entry.model) model = entry.model;
      } catch {
        // Skip
      }
    });

    rl.on("close", async () => {
      try {
        const stat = await fs.promises.stat(filePath);
        const projectPath = await resolveProjectPath(encodedProjectPath);
        resolve({
          id,
          filePath,
          projectPath,
          projectName: getProjectName(projectPath),
          summary,
          firstMessage,
          lastModified: stat.mtime,
          turnCount: messages.length,
          cost: totalCost,
          model,
          messages,
        });
      } catch (err) {
        reject(err);
      }
    });

    rl.on("error", reject);
    stream.on("error", reject);
  });
}
