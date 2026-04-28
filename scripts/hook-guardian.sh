#!/bin/bash
# Claude Code Monitor — Hook Guardian
# Wraps hook.sh to auto-restore hooks in settings.json whenever Claude Code
# strips them on a config rewrite.
set -euo pipefail

GUARDIAN_DIR="$HOME/.claude/claude-code-monitor"
HOOK_SCRIPT="$GUARDIAN_DIR/hook.sh"

# -------------------------------------------------------------------
# 1. Hand off to the actual hook script (write sessions.json)
# -------------------------------------------------------------------
if [ -x "$HOOK_SCRIPT" ]; then
  bash "$HOOK_SCRIPT"
fi

# -------------------------------------------------------------------
# 2. Auto-restore hooks in settings.json if they were stripped
# -------------------------------------------------------------------
/usr/bin/python3 << 'PYEOF'
import json, os

settings_file = os.path.expanduser('~/.claude/settings.json')
guardian_cmd = '~/.claude/claude-code-monitor/hook-guardian.sh'

REQUIRED_EVENTS = [
    'SessionStart', 'SessionEnd', 'Stop',
    'UserPromptSubmit', 'PreToolUse', 'Notification'
]

def has_guardian_hook(hooks_list):
    """Check if any command hook in the list ends with hook-guardian.sh."""
    if not isinstance(hooks_list, list):
        return False
    for h in hooks_list:
        if isinstance(h, dict) and h.get('type') == 'command':
            cmd = h.get('command', '')
            if cmd.endswith('hook-guardian.sh'):
                return True
    return False

def restore_settings():
    try:
        with open(settings_file) as f:
            settings = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return

    hooks = settings.get('hooks', {})
    if not isinstance(hooks, dict):
        hooks = {}
        settings['hooks'] = hooks

    changed = False
    for event in REQUIRED_EVENTS:
        entries = hooks.get(event)
        # If event is missing or hooks array is empty/missing, add guardian hook
        if not entries or not isinstance(entries, list) or len(entries) == 0:
            hooks[event] = [{'matcher': '', 'hooks': [{'type': 'command', 'command': guardian_cmd}]}]
            changed = True
            continue

        # Check each entry's hooks array
        entry_changed = False
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            hooks_arr = entry.get('hooks', [])
            if not isinstance(hooks_arr, list):
                entry['hooks'] = []
                hooks_arr = entry['hooks']
                entry_changed = True

            if not has_guardian_hook(hooks_arr):
                hooks_arr.append({'type': 'command', 'command': guardian_cmd})
                entry_changed = True

        if entry_changed:
            changed = True

    if changed:
        tmp = settings_file + '.guardian.tmp.' + str(os.getpid())
        with open(tmp, 'w') as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        os.rename(tmp, settings_file)

restore_settings()
PYEOF
