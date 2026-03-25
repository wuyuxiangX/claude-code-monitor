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
import { focusSession, resumeSession } from "./lib/terminal";
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
                target={<SessionDetailView sessionId={session.session_id} session={session} />}
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

function SessionDetailView({ sessionId, session: parentSession }: { sessionId: string; session: Session }) {
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<SessionDetailType | null>(null);

  useEffect(() => {
    async function load() {
      const d = await getSessionDetail(sessionId);
      setDetail(d);
      setIsLoading(false);
    }
    load();
  }, [sessionId]);

  if (!detail && !isLoading) {
    return <Detail markdown="# Session Not Found" />;
  }

  const title = parentSession.label || parentSession.first_prompt?.replace(/\n+/g, " ").trim().slice(0, 50) || detail?.summary || "Session";
  const stateConfig = STATE_CONFIG[parentSession.state] || DEFAULT_STATE_CONFIG;
  const startedAt = parentSession.started_at || Date.now();
  const endedAt = parentSession.ended_at ?? Date.now();
  const duration = formatDuration(startedAt, endedAt);
  const gitBranch = parentSession.gitBranch || detail?.gitBranch;
  const firstPrompt = parentSession.first_prompt || detail?.firstMessage || "";
  let markdown = `# ${title}\n\n`;
  if (detail?.summary) markdown += `> ${detail.summary}\n\n`;
  if (firstPrompt) markdown += `---\n\n## First Prompt\n\n${firstPrompt}\n`;

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        detail ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Session ID" text={detail.id || ""} />
            <Detail.Metadata.Label
              title="Project"
              text={detail.projectName || ""}
            />
            <Detail.Metadata.Label
              title="Path"
              text={detail.projectPath || ""}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.TagList title="Status">
              <Detail.Metadata.TagList.Item text={stateConfig.label} color={stateConfig.color} />
            </Detail.Metadata.TagList>
            {parentSession.term_program && (
              <Detail.Metadata.Label
                title="Terminal"
                text={getAppLabel(parentSession.term_program)}
              />
            )}
            {gitBranch && gitBranch !== "HEAD" && (
              <Detail.Metadata.Label title="Git Branch" text={gitBranch} />
            )}
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Turns"
              text={`${detail.turnCount || 0}`}
            />
            {detail.cost > 0 && (
              <Detail.Metadata.Label
                title="Cost"
                text={formatCost(detail.cost)}
              />
            )}
            {detail.model && (
              <Detail.Metadata.Label title="Model" text={detail.model} />
            )}
            {detail.inputTokens && (
              <Detail.Metadata.Label
                title="Input Tokens"
                text={detail.inputTokens.toLocaleString()}
              />
            )}
            {detail.outputTokens && (
              <Detail.Metadata.Label
                title="Output Tokens"
                text={detail.outputTokens.toLocaleString()}
              />
            )}
            {detail.cacheReadTokens && (
              <Detail.Metadata.Label
                title="Cache Read"
                text={detail.cacheReadTokens.toLocaleString()}
              />
            )}
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label title="Duration" text={duration} />
            <Detail.Metadata.Label
              title="Started"
              text={new Date(startedAt).toLocaleString()}
            />
            <Detail.Metadata.Label
              title="Last Modified"
              text={
                detail.lastModified
                  ? detail.lastModified.toLocaleString()
                  : ""
              }
            />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          <Action
            title="Resume Session"
            icon={Icon.ArrowRight}
            onAction={async () => {
              try {
                const cwd = parentSession.cwd || detail?.projectPath || "";
                await resumeSession(sessionId, cwd, parentSession.term_program);
              } catch {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Failed to resume session",
                });
              }
            }}
          />
          <Action.CopyToClipboard
            title="Copy Session ID"
            content={sessionId}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          {(parentSession.cwd || detail?.projectPath) && (
            <Action.CopyToClipboard
              title="Copy Project Path"
              content={parentSession.cwd || detail?.projectPath || ""}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
