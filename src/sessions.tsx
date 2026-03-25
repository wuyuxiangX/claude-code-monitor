import {
  ActionPanel,
  Action,
  List,
  Icon,
  Color,
  Detail,
  showToast,
  Toast,
  Alert,
  confirmAlert,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { useSessions } from "./hooks/useSessions";
import { hooksInstalled, deleteHookSession } from "./lib/hook-state";
import { getSessionDetail } from "./lib/session-parser";
import { focusSession } from "./lib/terminal";
import { formatRelativeTime, formatDuration } from "./lib/time";
import { formatCost } from "./lib/usage-stats";
import {
  Session,
  SessionState,
  SessionDetail as SessionDetailType,
} from "./types";

const STATE_CONFIG: Record<
  SessionState,
  { icon: Icon; color: Color; label: string }
> = {
  active: { icon: Icon.CircleFilled, color: Color.Green, label: "Active" },
  waiting: {
    icon: Icon.ExclamationMark,
    color: Color.Orange,
    label: "Waiting",
  },
  idle: { icon: Icon.Circle, color: Color.Yellow, label: "Idle" },
  ended: {
    icon: Icon.CircleDisabled,
    color: Color.SecondaryText,
    label: "Ended",
  },
};

const DEFAULT_STATE_CONFIG = {
  icon: Icon.QuestionMarkCircle,
  color: Color.SecondaryText,
  label: "Unknown",
};

const APP_LABELS: Record<string, string> = {
  vscode: "VS Code",
  cursor: "Cursor",
  zed: "Zed",
  windsurf: "Windsurf",
  Apple_Terminal: "Terminal",
  "iTerm.app": "iTerm2",
  WarpTerminal: "Warp",
  ghostty: "Ghostty",
  kitty: "kitty",
  tmux: "tmux",
};

function getAppLabel(termProgram: string): string {
  return APP_LABELS[termProgram] || termProgram;
}

export default function SessionsCommand() {
  const {
    activeSessions,
    waitingSessions,
    idleSessions,
    endedSessions,
    isLoading,
    revalidate,
  } = useSessions();

  if (!isLoading && !hooksInstalled()) {
    return (
      <List>
        <List.EmptyView
          title="Hooks Not Installed"
          description='Run "Setup Claude Code Hooks" command first to enable real-time session monitoring.'
          icon={Icon.ExclamationMark}
        />
      </List>
    );
  }

  const isEmpty =
    activeSessions.length === 0 &&
    waitingSessions.length === 0 &&
    idleSessions.length === 0 &&
    endedSessions.length === 0;

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search sessions...">
      {isEmpty && !isLoading && (
        <List.EmptyView
          title="No Sessions"
          description="Start a Claude Code session to see it here."
          icon={Icon.Terminal}
        />
      )}
      {waitingSessions.length > 0 && (
        <List.Section
          title="Waiting for Input"
          subtitle={`${waitingSessions.length}`}
        >
          {waitingSessions.map((s) => (
            <SessionItem key={s.session_id} session={s} onDelete={revalidate} />
          ))}
        </List.Section>
      )}
      {activeSessions.length > 0 && (
        <List.Section title="Active" subtitle={`${activeSessions.length}`}>
          {activeSessions.map((s) => (
            <SessionItem key={s.session_id} session={s} onDelete={revalidate} />
          ))}
        </List.Section>
      )}
      {idleSessions.length > 0 && (
        <List.Section title="Idle" subtitle={`${idleSessions.length}`}>
          {idleSessions.map((s) => (
            <SessionItem key={s.session_id} session={s} onDelete={revalidate} />
          ))}
        </List.Section>
      )}
      {endedSessions.length > 0 && (
        <List.Section title="Ended" subtitle={`${endedSessions.length}`}>
          {endedSessions.map((s) => (
            <SessionItem key={s.session_id} session={s} onDelete={revalidate} />
          ))}
        </List.Section>
      )}
    </List>
  );
}

function SessionItem({
  session,
  onDelete,
}: {
  session: Session;
  onDelete: () => void;
}) {
  const config = STATE_CONFIG[session.state] || DEFAULT_STATE_CONFIG;
  const startedAt = session.started_at || Date.now();
  const endedAt = session.ended_at ?? Date.now();
  const duration = formatDuration(startedAt, endedAt);
  const lastUpdate = formatRelativeTime(session.last_updated_at || Date.now());

  const accessories: List.Item.Accessory[] = [
    { tag: { value: config.label, color: config.color } },
  ];

  if (session.is_worktree) {
    accessories.push({
      tag: { value: "Worktree", color: Color.Purple },
    });
  }

  if (session.term_program) {
    accessories.push({
      tag: { value: getAppLabel(session.term_program), color: Color.Blue },
    });
  }

  if (session.gitBranch && session.gitBranch !== "HEAD") {
    accessories.push({ icon: Icon.CodeBlock, text: session.gitBranch });
  }

  accessories.push({ text: duration });
  accessories.push({ text: lastUpdate });

  const title =
    session.project_name ||
    (session.session_id ? session.session_id.slice(0, 12) : "Unknown");

  return (
    <List.Item
      title={title}
      subtitle={session.label || (session.first_prompt ? (session.first_prompt.replace(/\n+/g, " ").trim().length > 50 ? session.first_prompt.replace(/\n+/g, " ").trim().slice(0, 50) + "…" : session.first_prompt.replace(/\n+/g, " ").trim()) : "")}
      icon={{ source: config.icon, tintColor: config.color }}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Session">
            <Action
              title="Focus Session"
              icon={Icon.Terminal}
              onAction={async () => {
                try {
                  await focusSession(session);
                } catch {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Failed to focus session",
                  });
                }
              }}
            />
            {session.session_id && (
              <Action.Push
                title="View Details"
                icon={Icon.Eye}
                shortcut={{ modifiers: ["cmd"], key: "d" }}
                target={<SessionDetailView sessionId={session.session_id} />}
              />
            )}
            {session.cwd && (
              <Action.ShowInFinder
                title="Show in Finder"
                path={session.cwd}
                shortcut={{ modifiers: ["cmd"], key: "f" }}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section title="Copy">
            {session.session_id && (
              <Action.CopyToClipboard
                title="Copy Session ID"
                content={session.session_id}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
            )}
            {session.cwd && (
              <Action.CopyToClipboard
                title="Copy Project Path"
                content={session.cwd}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Delete Session"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["ctrl"], key: "x" }}
              onAction={async () => {
                const confirmed = await confirmAlert({
                  title: "Delete Session",
                  message: `Remove "${session.project_name || session.session_id}" from the list?`,
                  primaryAction: {
                    title: "Delete",
                    style: Alert.ActionStyle.Destructive,
                  },
                });
                if (confirmed) {
                  deleteHookSession(session.session_id);
                  onDelete();
                  await showToast({
                    style: Toast.Style.Success,
                    title: "Session deleted",
                  });
                }
              }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function SessionDetailView({ sessionId }: { sessionId: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionDetailType | null>(null);

  useEffect(() => {
    async function load() {
      const detail = await getSessionDetail(sessionId);
      setSession(detail);
      setIsLoading(false);
    }
    load();
  }, [sessionId]);

  if (!session && !isLoading) {
    return <Detail markdown="# Session Not Found" />;
  }

  const markdown = session ? formatSessionMarkdown(session) : "Loading...";

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        session ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Session ID" text={session.id || ""} />
            <Detail.Metadata.Label
              title="Project"
              text={session.projectName || ""}
            />
            <Detail.Metadata.Label
              title="Path"
              text={session.projectPath || ""}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Turns"
              text={`${session.turnCount || 0}`}
            />
            {session.cost > 0 && (
              <Detail.Metadata.Label
                title="Cost"
                text={formatCost(session.cost)}
              />
            )}
            {session.model && (
              <Detail.Metadata.Label title="Model" text={session.model} />
            )}
            <Detail.Metadata.Label
              title="Last Modified"
              text={
                session.lastModified
                  ? session.lastModified.toLocaleString()
                  : ""
              }
            />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        session ? (
          <ActionPanel>
            <Action.CopyToClipboard
              title="Copy Session ID"
              content={session.id || ""}
            />
            <Action.CopyToClipboard
              title="Copy Project Path"
              content={session.projectPath || ""}
            />
          </ActionPanel>
        ) : undefined
      }
    />
  );
}

function formatSessionMarkdown(session: SessionDetailType): string {
  let md = `# ${session.firstMessage || session.summary || "Session"}\n\n`;
  if (session.summary) md += `> ${session.summary}\n\n`;
  md += `---\n\n## Conversation\n\n`;

  const messages = session.messages || [];
  for (const message of messages.slice(0, 20)) {
    const role = message.type === "user" ? "**You**" : "**Claude**";
    const content =
      (message.content || "").length > 500
        ? (message.content || "").slice(0, 500) + "..."
        : message.content || "";
    md += `${role}:\n${content}\n\n`;
  }

  if (messages.length > 20) {
    md += `\n*...and ${messages.length - 20} more messages*\n`;
  }

  return md;
}
