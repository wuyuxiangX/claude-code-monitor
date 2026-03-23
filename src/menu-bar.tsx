import {
  MenuBarExtra,
  Icon,
  Color,
  launchCommand,
  LaunchType,
} from "@raycast/api";
import { useSessions } from "./hooks/useSessions";
import { focusSession } from "./lib/terminal";
import { formatRelativeTime, formatDuration } from "./lib/time";
import { formatCost } from "./lib/usage-stats";
import { Session, SessionState } from "./types";

const STATE_ICON: Record<SessionState, { source: Icon; tintColor: Color }> = {
  active: { source: Icon.CircleFilled, tintColor: Color.Green },
  waiting: { source: Icon.ExclamationMark, tintColor: Color.Orange },
  idle: { source: Icon.Circle, tintColor: Color.Yellow },
  ended: { source: Icon.CircleDisabled, tintColor: Color.SecondaryText },
};

const DEFAULT_ICON = { source: Icon.Circle, tintColor: Color.SecondaryText };

export default function MenuBarCommand() {
  const {
    activeSessions,
    waitingSessions,
    idleSessions,
    endedSessions,
    isLoading,
  } = useSessions(10000);

  const liveCount =
    activeSessions.length + waitingSessions.length + idleSessions.length;
  const hasActive = activeSessions.length > 0;
  const hasWaiting = waitingSessions.length > 0;

  const title = liveCount > 0 ? `${liveCount}` : undefined;
  const icon = hasActive
    ? { source: Icon.Terminal, tintColor: Color.Green }
    : hasWaiting
      ? { source: Icon.Terminal, tintColor: Color.Orange }
      : liveCount > 0
        ? { source: Icon.Terminal, tintColor: Color.Yellow }
        : { source: Icon.Terminal, tintColor: Color.SecondaryText };

  return (
    <MenuBarExtra
      icon={icon}
      title={title}
      tooltip={`Claude Code: ${liveCount} session(s)`}
      isLoading={isLoading}
    >
      {activeSessions.length > 0 && (
        <MenuBarExtra.Section title={`Active (${activeSessions.length})`}>
          {activeSessions.map((s) => (
            <SessionMenuItem key={s.session_id} session={s} />
          ))}
        </MenuBarExtra.Section>
      )}
      {waitingSessions.length > 0 && (
        <MenuBarExtra.Section
          title={`Waiting for Input (${waitingSessions.length})`}
        >
          {waitingSessions.map((s) => (
            <SessionMenuItem key={s.session_id} session={s} />
          ))}
        </MenuBarExtra.Section>
      )}
      {idleSessions.length > 0 && (
        <MenuBarExtra.Section title={`Idle (${idleSessions.length})`}>
          {idleSessions.map((s) => (
            <SessionMenuItem key={s.session_id} session={s} />
          ))}
        </MenuBarExtra.Section>
      )}
      {endedSessions.length > 0 && (
        <MenuBarExtra.Section
          title={`Recently Ended (${endedSessions.length})`}
        >
          {endedSessions.slice(0, 5).map((s) => (
            <SessionMenuItem key={s.session_id} session={s} />
          ))}
        </MenuBarExtra.Section>
      )}
      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open Session List"
          icon={Icon.List}
          shortcut={{ modifiers: ["cmd"], key: "l" }}
          onAction={() =>
            launchCommand({ name: "sessions", type: LaunchType.UserInitiated })
          }
        />
        <MenuBarExtra.Item
          title="Usage Dashboard"
          icon={Icon.BarChart}
          shortcut={{ modifiers: ["cmd"], key: "u" }}
          onAction={() =>
            launchCommand({
              name: "usage-dashboard",
              type: LaunchType.UserInitiated,
            })
          }
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

function SessionMenuItem({ session }: { session: Session }) {
  const stateIcon = STATE_ICON[session.state] || DEFAULT_ICON;
  const startedAt = session.started_at || Date.now();
  const endedAt = session.ended_at ?? Date.now();
  const duration = formatDuration(startedAt, endedAt);
  const lastUpdate = formatRelativeTime(session.last_updated_at || Date.now());
  const costStr =
    session.cost != null && session.cost > 0
      ? ` | ${formatCost(session.cost)}`
      : "";

  const title =
    session.project_name ||
    (session.session_id ? session.session_id.slice(0, 12) : "Unknown");

  return (
    <MenuBarExtra.Item
      title={title}
      subtitle={`${duration} | ${lastUpdate}${costStr}`}
      icon={stateIcon}
      onAction={() => focusSession(session)}
    />
  );
}
