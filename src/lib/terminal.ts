import { getPreferenceValues } from "@raycast/api";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Session } from "../types";

const execPromise = promisify(exec);

// Editors: CLI command that focuses the project window
const EDITOR_COMMANDS: Record<string, string> = {
  vscode: "code",
  zed: "zed",
  cursor: "cursor",
  windsurf: "windsurf",
};

// Terminals: TERM_PROGRAM → macOS app name
const TERMINAL_APPS: Record<string, string> = {
  Apple_Terminal: "Terminal",
  "iTerm.app": "iTerm",
  WarpTerminal: "Warp",
  ghostty: "Ghostty",
  kitty: "kitty",
};

interface Preferences {
  defaultApp?: string;
}

/**
 * Focus the terminal/editor where the Claude Code session is running.
 * Uses term_program saved by hook.sh during SessionStart.
 * Falls back to user preference or Terminal.app.
 */
export async function focusSession(session: Session): Promise<void> {
  const prefs = getPreferenceValues<Preferences>();
  const termProgram =
    session.term_program || prefs.defaultApp || "Apple_Terminal";
  const cwd = session.cwd;

  if (!cwd) return;

  // 1. Editor: CLI command focuses the project window directly
  const editorCmd = EDITOR_COMMANDS[termProgram];
  if (editorCmd) {
    try {
      await execPromise(`${editorCmd} "${cwd}"`);
    } catch {
      // Editor CLI not found, try open -a
      await execPromise(`open -a "${termProgram}"`).catch(() => {});
    }
    return;
  }

  // 2. Terminal: activate the app
  const appName = TERMINAL_APPS[termProgram] || termProgram;
  try {
    await execPromise(`open -a "${appName}"`);
  } catch {
    // Fallback: try using the raw term_program value
    await execPromise(`open -a "${termProgram}"`).catch(() => {});
  }
}
