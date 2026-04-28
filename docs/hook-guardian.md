# Claude Code Monitor Hook 失效问题

## 问题描述

Claude Code Monitor 能读取到用量统计（来自 JSONL 文件解析），但无法检测活跃的终端会话状态（sessions.json 无更新）。

## 根因

Claude Code 在启动或重写配置时，会用自己认识的字段重新生成 `~/.claude/settings.json`，**把不认识的字段（如 `hooks`）直接丢弃**。这导致每次 Claude Code 刷新配置，hook 注册就失效。

## 解决方案

引入 **Hook Guardian** 机制——在 `settings.json` 和实际 `hook.sh` 之间插入一个 wrapper 脚本 `hook-guardian.sh`。每次 hook 事件触发时，guardian 会：

1. 调用原始 `hook.sh`（正常写入 sessions.json）
2. 检查 `settings.json` 里的 hooks 配置是否完整，若被覆盖则立即恢复

这样 guardian 每次 hook 触发都会自动自愈，完全无需手动干预。

### 文件结构

```
~/.claude/claude-code-monitor/
  hook.sh              # 原始 hook，接收事件、写入 sessions.json
  hook-guardian.sh     # wrapper，先调用 hook.sh，再自愈 settings.json
```

### settings.json 中的 hook 配置

```json
{
  "hooks": {
    "SessionStart":   [{ "matcher": "", "hooks": [{ "type": "command", "command": "~/.claude/claude-code-monitor/hook-guardian.sh" }] }],
    "SessionEnd":     [{ "matcher": "", "hooks": [{ "type": "command", "command": "~/.claude/claude-code-monitor/hook-guardian.sh" }] }],
    "Stop":           [{ "matcher": "", "hooks": [{ "type": "command", "command": "~/.claude/claude-code-monitor/hook-guardian.sh" }] }],
    "UserPromptSubmit": [{ "matcher": "", "hooks": [{ "type": "command", "command": "~/.claude/claude-code-monitor/hook-guardian.sh" }] }],
    "PreToolUse":     [{ "matcher": "", "hooks": [{ "type": "command", "command": "~/.claude/claude-code-monitor/hook-guardian.sh" }] }],
    "Notification":   [{ "matcher": "", "hooks": [{ "type": "command", "command": "~/.claude/claude-code-monitor/hook-guardian.sh" }] }]
  }
}
```

### 数据流

```
Claude Code 事件触发
  → hook-guardian.sh (wrapper)
      → hook.sh (写 sessions.json)
      → 检查 settings.json hooks 是否完整
      → 若被覆盖则恢复 hooks 配置
```

## 相关文件

- `scripts/hook.sh` — 原始 hook 脚本
- `scripts/hook-guardian.sh` — 自愈 wrapper
- `src/setup.tsx` — 安装命令，负责部署 hook.sh 和 hook-guardian.sh 并写入 settings.json
