# Claude Code Monitor

Real-time monitoring for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions directly from Raycast.

Track active sessions, monitor usage costs, and quickly switch between Claude Code sessions — all without leaving your keyboard.

## Features

### Session Monitoring

- Real-time session status tracking (Active, Waiting for Input, Idle, Ended)
- View session details including project, git branch, model, tokens, and cost
- One-click focus to jump back into any session
- Resume ended sessions directly from Raycast
- Support for multiple terminals: VS Code, Cursor, Zed, iTerm2, Warp, Ghostty, and more

### Menu Bar Status

- Always-visible menu bar icon showing active session count
- Color-coded status: green (active), orange (waiting for input), yellow (idle)
- Quick access to any session from the menu bar

### Usage Dashboard

- Cost tracking with daily, weekly, and monthly breakdowns
- Token usage statistics (input, output, cache)
- Per-project and per-model usage breakdown
- Daily trend visualization

### Extensions Manager

- Browse and manage Claude Code plugins, skills, and MCP servers
- View plugin details, toggle states, and open configuration files

## Setup

1. Install the extension from the Raycast Store
2. Run the **Setup Claude Code Hooks** command to enable real-time monitoring
3. Start using Claude Code — sessions will appear automatically

The setup command configures [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) to report session events. No data leaves your machine.

## Commands

| Command | Description |
|---------|-------------|
| Claude Code Sessions | List all sessions with real-time status |
| Claude Code Status | Menu bar icon with session overview |
| Claude Code Usage | Usage statistics and cost dashboard |
| Setup Claude Code Hooks | One-click hook installation |
| Claude Code Extensions | Manage plugins, skills, and MCP servers |
