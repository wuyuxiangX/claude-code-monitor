#!/bin/bash
set -euo pipefail

STATE_DIR="$HOME/.claude/claude-code-monitor"
STATE_FILE="$STATE_DIR/sessions.json"
LOCK_DIR="$STATE_DIR/.lock"

# Read JSON from stdin
INPUT=$(cat)

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Acquire lock (mkdir is atomic on POSIX)
acquire_lock() {
  local max_wait=50  # 50 * 0.02 = 1 second max
  local i=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    i=$((i + 1))
    if [ $i -ge $max_wait ]; then
      rmdir "$LOCK_DIR" 2>/dev/null || true
      mkdir "$LOCK_DIR" 2>/dev/null || true
      break
    fi
    sleep 0.02
  done
}

release_lock() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

trap release_lock EXIT

acquire_lock

# Read existing state or create new
if [ -f "$STATE_FILE" ]; then
  CURRENT=$(cat "$STATE_FILE")
else
  CURRENT='{"version":1,"sessions":{}}'
fi

# Update using python3 (available on all macOS)
UPDATED=$(echo "$INPUT" | /usr/bin/python3 -c "
import sys, json, os, time

hook_input = json.load(sys.stdin)
data = json.loads('''$CURRENT''') if '''$CURRENT''' else {'version': 1, 'sessions': {}}

sid = hook_input.get('session_id', '')
if not sid:
    print(json.dumps(data, indent=2))
    sys.exit(0)

event = hook_input.get('hook_event_name', '')
cwd = hook_input.get('cwd', '')
transcript = hook_input.get('transcript_path', '')
source = hook_input.get('source', '')

# Map event to state
if event == 'Notification':
    ntype = hook_input.get('notification_type', '')
    if ntype in ('permission_prompt', 'elicitation_dialog'):
        new_state = 'waiting'
    else:
        new_state = 'idle'
else:
    state_map = {
        'SessionStart': 'idle',
        'UserPromptSubmit': 'active',
        'PreToolUse': 'active',
        'Stop': 'idle',
        'SessionEnd': 'ended',
    }
    new_state = state_map.get(event, '')
    if not new_state:
        print(json.dumps(data, indent=2))
        sys.exit(0)

now = int(time.time() * 1000)

session = data.get('sessions', {}).get(sid, {})

# Ensure base fields exist (handles events arriving before SessionStart)
if 'session_id' not in session:
    session['session_id'] = sid
    session['cwd'] = cwd
    session['project_name'] = os.path.basename(cwd) if cwd else sid[:8]
    session['transcript_path'] = transcript
    session['started_at'] = now
    session['ended_at'] = None
    session['source'] = source

# Always backfill term_program if missing
if not session.get('term_program'):
    session['term_program'] = os.environ.get('TERM_PROGRAM', '')

if event == 'SessionStart':
    session['cwd'] = cwd
    session['project_name'] = os.path.basename(cwd) if cwd else ''
    session['transcript_path'] = transcript
    session['started_at'] = now
    session['ended_at'] = None
    session['source'] = source
    session['term_program'] = os.environ.get('TERM_PROGRAM', '')

if event == 'SessionEnd':
    session['ended_at'] = now

session['state'] = new_state
session['last_updated_at'] = now
session['last_event'] = event

data['sessions'][sid] = session

# Cleanup: remove ended sessions older than 1 hour
cutoff = now - 3600000
data['sessions'] = {
    k: v for k, v in data['sessions'].items()
    if v.get('state') != 'ended' or (v.get('ended_at') or now) > cutoff
}

# Cleanup: mark stale sessions (no update in 30 min) as ended
stale_cutoff = now - 1800000
for k, v in list(data['sessions'].items()):
    if v.get('state') != 'ended' and v.get('last_updated_at', now) < stale_cutoff:
        v['state'] = 'ended'
        v['ended_at'] = now
        v['last_event'] = 'StaleCleanup'

print(json.dumps(data, indent=2))
" 2>/dev/null) || {
  release_lock
  exit 0
}

# Atomic write
TEMP_FILE="$STATE_DIR/sessions.tmp.$$"
echo "$UPDATED" > "$TEMP_FILE"
mv "$TEMP_FILE" "$STATE_FILE"
