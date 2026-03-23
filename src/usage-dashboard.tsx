import { Detail, ActionPanel, Action, Icon } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import {
  getTodayStats,
  getWeekStats,
  getMonthStats,
  getDailyStats,
  formatCost,
  generateCostChart,
  generateProjectTable,
} from "./lib/usage-stats";

export default function UsageDashboardCommand() {
  const { data, isLoading } = useCachedPromise(async () => {
    const [today, week, month, daily] = await Promise.all([
      getTodayStats(),
      getWeekStats(),
      getMonthStats(),
      getDailyStats(7),
    ]);
    return { today, week, month, daily };
  });

  const markdown = data
    ? buildDashboardMarkdown(data)
    : "Loading usage data...";

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        data ? (
          <Detail.Metadata>
            <Detail.Metadata.Label
              title="Today"
              text={`${data.today.totalSessions} sessions`}
            />
            <Detail.Metadata.Label
              title="Today Cost"
              text={formatCost(data.today.totalCost)}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="This Week"
              text={`${data.week.totalSessions} sessions`}
            />
            <Detail.Metadata.Label
              title="Week Cost"
              text={formatCost(data.week.totalCost)}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="This Month"
              text={`${data.month.totalSessions} sessions`}
            />
            <Detail.Metadata.Label
              title="Month Cost"
              text={formatCost(data.month.totalCost)}
            />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={() => {
              // Trigger revalidation by re-rendering
            }}
          />
        </ActionPanel>
      }
    />
  );
}

function buildDashboardMarkdown(data: {
  today: {
    totalSessions: number;
    totalCost: number;
    sessionsByProject: Record<string, { count: number; cost: number }>;
  };
  week: {
    totalSessions: number;
    totalCost: number;
    sessionsByProject: Record<string, { count: number; cost: number }>;
  };
  month: {
    totalSessions: number;
    totalCost: number;
    sessionsByProject: Record<string, { count: number; cost: number }>;
  };
  daily: { date: string; sessions: number; cost: number }[];
}): string {
  let md = "# Claude Code Usage Dashboard\n\n";

  // Summary
  md += "## Overview\n\n";
  md += `| Period | Sessions | Cost |\n`;
  md += `|--------|----------|------|\n`;
  md += `| Today | ${data.today.totalSessions} | ${formatCost(data.today.totalCost)} |\n`;
  md += `| This Week | ${data.week.totalSessions} | ${formatCost(data.week.totalCost)} |\n`;
  md += `| This Month | ${data.month.totalSessions} | ${formatCost(data.month.totalCost)} |\n\n`;

  // Daily chart
  md += "## Daily Trend\n\n";
  md += generateCostChart(data.daily);
  md += "\n\n";

  // Project breakdown
  md += "## Project Breakdown (This Week)\n\n";
  md += generateProjectTable(data.week.sessionsByProject);
  md += "\n";

  return md;
}
