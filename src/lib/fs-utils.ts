import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const HOME = os.homedir();

export const CLAUDE_DIR = path.join(HOME, ".claude");
export const CLAUDE_MONITOR_DIR = path.join(CLAUDE_DIR, "claude-code-monitor");

export function escapeMarkdown(text: string): string {
  return text.replace(/([#*_`|~[\]\\<>])/g, "\\$1");
}

export function getShellProxy(): Record<string, string> {
  // Raycast (GUI app) doesn't source ~/.zshrc, so proxy env vars are missing.
  // Read them directly from shell config files.
  if (process.env.http_proxy || process.env.HTTP_PROXY) return {};
  // Order matches typical shell load order — later files override earlier ones
  // so a user's interactive-shell rc wins over login-shell profile.
  const rcFiles = [".bash_profile", ".zprofile", ".bashrc", ".zshrc"];
  const vars: Record<string, string> = {};
  for (const file of rcFiles) {
    try {
      const content = readFileSync(path.join(HOME, file), "utf-8");
      for (const m of content.matchAll(
        /(?:export\s+)?((https?_proxy|all_proxy|no_proxy))=(\S+)/gi,
      )) {
        vars[m[1]] = m[3].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* file missing — skip */
    }
  }
  return vars;
}

export function buildClaudeEnv(
  extraEnv?: Record<string, string>,
): NodeJS.ProcessEnv {
  const extraPaths = [
    path.join(HOME, ".local", "share", "fnm", "aliases", "default", "bin"),
    path.join(HOME, ".local", "bin"),
    "/usr/local/bin",
    "/opt/homebrew/bin",
  ].join(":");
  const basePath = process.env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin";
  return {
    ...process.env,
    PATH: `${extraPaths}:${basePath}`,
    ...extraEnv,
  };
}
