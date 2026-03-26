/**
 * Standalone scanner script.
 * Runs as a child_process to avoid Raycast worker memory limits.
 * Reads all JSONL session files, extracts token usage via chunk-based regex,
 * and writes results to the usage cache file.
 *
 * Usage: node scanner.js [afterDateMs]
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");
const CACHE_FILE = path.join(
  os.homedir(),
  ".claude",
  "claude-code-monitor",
  "usage-cache.json",
);

interface CacheEntry {
  mtime: number;
  turnCount: number;
  cost: number;
  model?: string;
  summary: string;
  firstMessage: string;
  gitBranch?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  id?: string;
  projectPath: string;
  projectName: string;
}

// Pricing (per million tokens)
const PRICING: Record<string, { i: number; o: number; cr: number; cw: number }> = {
  opus: { i: 15, o: 75, cr: 3.75, cw: 18.75 },
  sonnet: { i: 3, o: 15, cr: 0.3, cw: 3.75 },
  haiku: { i: 0.8, o: 4, cr: 0.08, cw: 1 },
};

function calcCost(
  model: string,
  it: number,
  ot: number,
  cr: number,
  cc: number,
): number {
  const lower = model.toLowerCase();
  const p = lower.includes("opus")
    ? PRICING.opus
    : lower.includes("haiku")
      ? PRICING.haiku
      : PRICING.sonnet;
  return (
    (it / 1e6) * p.i +
    (ot / 1e6) * p.o +
    (cr / 1e6) * p.cr +
    (cc / 1e6) * p.cw
  );
}

const RE_IT = /"input_tokens"\s*:\s*(\d+)/g;
const RE_OT = /"output_tokens"\s*:\s*(\d+)/g;
const RE_CR = /"cache_read_input_tokens"\s*:\s*(\d+)/g;
const RE_CC = /"cache_creation_input_tokens"\s*:\s*(\d+)/g;
const RE_MODEL = /"model"\s*:\s*"([^"]+)"/g;
const RE_ASSISTANT = /"type"\s*:\s*"assistant"/g;
const RE_USER = /"type"\s*:\s*"(?:user|human)"/g;
const RE_BRANCH = /"gitBranch"\s*:\s*"([^"]+)"/;

function sumAll(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let s = 0;
  let m;
  while ((m = re.exec(text)) !== null) s += parseInt(m[1], 10);
  return s;
}

function countAll(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let c = 0;
  while (re.exec(text) !== null) c++;
  return c;
}

function lastOf(text: string, re: RegExp): string | undefined {
  re.lastIndex = 0;
  let last: string | undefined;
  let m;
  while ((m = re.exec(text)) !== null) last = m[1];
  return last;
}

function getProjectName(projectPath: string): string {
  return path.basename(projectPath) || projectPath;
}

async function main() {
  const afterDateMs = parseInt(process.argv[2] || "0", 10);
  const afterDate = afterDateMs ? new Date(afterDateMs) : undefined;

  // Load existing cache
  let cache: Record<string, CacheEntry> = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    // No cache yet
  }

  let dirty = false;
  const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(PROJECTS_DIR, dir.name);

    let files: string[];
    try {
      files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    // Resolve project path (simple decode)
    const projectPath = "/" + dir.name.slice(1).replace(/-/g, "/");
    const projectName = getProjectName(projectPath);

    for (const file of files) {
      const fp = path.join(dirPath, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fp);
      } catch {
        continue;
      }
      if (afterDate && stat.mtime < afterDate) continue;

      const mtimeMs = stat.mtime.getTime();
      const existing = cache[fp];
      if (existing && existing.mtime === mtimeMs) {
        // Already cached and fresh — just ensure projectPath is set
        if (!existing.projectPath) {
          existing.projectPath = projectPath;
          existing.projectName = projectName;
          dirty = true;
        }
        continue;
      }

      // Parse via chunk scan
      let inputTokens = 0,
        outputTokens = 0,
        cacheReadTokens = 0,
        cacheCreationTokens = 0;
      let model: string | undefined;
      let assistantTurns = 0,
        userTurns = 0;
      let gitBranch: string | undefined;
      let summary = "";
      let firstMessage = "";
      let id: string | undefined;

      const fd = fs.openSync(fp, "r");
      try {
        // Head: first 8KB for metadata
        const headBuf = Buffer.alloc(8192);
        const headRead = fs.readSync(fd, headBuf, 0, 8192, 0);
        const head = headBuf.toString("utf8", 0, headRead);
        for (const line of head.split("\n")) {
          if (!line.trim() || line.length > 50000) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.type === "summary") {
              summary = entry.summary || "";
              id = entry.leafUuid || path.basename(fp, ".jsonl");
            }
            if (
              (entry.type === "user" || entry.type === "human") &&
              !firstMessage &&
              entry.message?.content
            ) {
              const c = entry.message.content;
              if (typeof c === "string") firstMessage = c.slice(0, 200);
              else if (Array.isArray(c)) {
                const tb = c.find((b: { type: string }) => b.type === "text");
                firstMessage = tb?.text?.slice(0, 200) || "";
              }
            }
          } catch {
            /* skip */
          }
        }

        // Chunk scan for tokens
        const CHUNK = 256 * 1024;
        const buf = Buffer.alloc(CHUNK);
        let pos = 0;
        let carry = "";
        while (pos < stat.size) {
          const bytesRead = fs.readSync(fd, buf, 0, CHUNK, pos);
          if (!bytesRead) break;
          const text = carry + buf.toString("utf8", 0, bytesRead);

          inputTokens += sumAll(text, RE_IT);
          outputTokens += sumAll(text, RE_OT);
          cacheReadTokens += sumAll(text, RE_CR);
          cacheCreationTokens += sumAll(text, RE_CC);
          assistantTurns += countAll(text, RE_ASSISTANT);
          userTurns += countAll(text, RE_USER);

          const m = lastOf(text, RE_MODEL);
          if (m) model = m;

          if (!gitBranch) {
            const gb = text.match(RE_BRANCH);
            if (gb) gitBranch = gb[1];
          }

          carry = text.slice(-200);
          pos += bytesRead;
        }
      } finally {
        fs.closeSync(fd);
      }

      const cost =
        model && (inputTokens || outputTokens)
          ? calcCost(model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens)
          : 0;

      cache[fp] = {
        mtime: mtimeMs,
        turnCount: userTurns + assistantTurns,
        cost,
        model,
        summary,
        firstMessage,
        gitBranch,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        id: id || path.basename(fp, ".jsonl"),
        projectPath,
        projectName,
      };
      dirty = true;
    }
  }

  // Write cache
  if (dirty) {
    const dir = path.dirname(CACHE_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = CACHE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(cache));
    fs.renameSync(tmp, CACHE_FILE);
  }

  // Output JSON summary to stdout
  process.stdout.write(JSON.stringify({ ok: true, count: Object.keys(cache).length }));
}

main().catch((err) => {
  process.stderr.write(String(err));
  process.exit(1);
});
