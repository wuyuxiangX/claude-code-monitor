import { listAllSessions } from "./session-parser";
import { UsageStats, DailyStats, SessionMetadata } from "../types";

// In-memory cache for today's stats
let todayStatsCache: {
  stats: UsageStats;
  timestamp: number;
  date: string;
} | null = null;
const TODAY_STATS_CACHE_TTL = 30 * 1000; // 30 seconds

function calculateStats(sessions: SessionMetadata[]): UsageStats {
  let totalCostCents = 0;
  const sessionsByProject: Record<string, { count: number; cost: number }> = {};
  const projectCostCents: Record<string, number> = {};

  for (const session of sessions) {
    const costCents = Math.round((session.cost || 0) * 10000);
    totalCostCents += costCents;

    if (!sessionsByProject[session.projectName]) {
      sessionsByProject[session.projectName] = { count: 0, cost: 0 };
      projectCostCents[session.projectName] = 0;
    }
    sessionsByProject[session.projectName].count++;
    projectCostCents[session.projectName] += costCents;
  }

  for (const projectName of Object.keys(sessionsByProject)) {
    sessionsByProject[projectName].cost = projectCostCents[projectName] / 10000;
  }

  const topSessions = [...sessions]
    .filter((s) => s.cost > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  return {
    totalSessions: sessions.length,
    totalCost: totalCostCents / 10000,
    sessionsByProject,
    topSessions,
  };
}

export async function getTodayStats(): Promise<UsageStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  if (
    todayStatsCache &&
    todayStatsCache.date === todayStr &&
    Date.now() - todayStatsCache.timestamp < TODAY_STATS_CACHE_TTL
  ) {
    return todayStatsCache.stats;
  }

  const todaySessions = await listAllSessions({ afterDate: today });
  const stats = calculateStats(todaySessions);

  todayStatsCache = { stats, timestamp: Date.now(), date: todayStr };
  return stats;
}

export async function getWeekStats(): Promise<UsageStats> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  const sessions = await listAllSessions({ afterDate: weekAgo });
  return calculateStats(sessions);
}

export async function getMonthStats(): Promise<UsageStats> {
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  monthAgo.setHours(0, 0, 0, 0);
  const sessions = await listAllSessions({ afterDate: monthAgo });
  return calculateStats(sessions);
}

export async function getDailyStats(days: number = 7): Promise<DailyStats[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const allSessions = await listAllSessions({ afterDate: startDate });
  const dailyStats: DailyStats[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const daySessions = allSessions.filter(
      (s) => s.lastModified >= date && s.lastModified < nextDate,
    );
    const stats = calculateStats(daySessions);

    dailyStats.push({
      date: date.toISOString().split("T")[0],
      sessions: stats.totalSessions,
      cost: stats.totalCost,
    });
  }

  return dailyStats.reverse();
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function generateCostChart(dailyStats: DailyStats[]): string {
  const maxCost = Math.max(...dailyStats.map((d) => d.cost), 0.01);
  const barWidth = 20;

  let chart = "```\n";
  chart += "Daily Cost (last 7 days)\n";
  chart += "─".repeat(35) + "\n";

  for (const day of dailyStats) {
    const date = day.date.slice(5);
    const barLength = Math.round((day.cost / maxCost) * barWidth);
    const bar = "█".repeat(barLength) + "░".repeat(barWidth - barLength);
    chart += `${date} │${bar}│ ${formatCost(day.cost)}\n`;
  }

  chart += "```";
  return chart;
}

export function generateProjectTable(
  sessionsByProject: Record<string, { count: number; cost: number }>,
): string {
  const sorted = Object.entries(sessionsByProject)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .slice(0, 10);

  if (sorted.length === 0) return "No project data available.";

  let table = "| Project | Sessions | Cost |\n";
  table += "|---------|----------|------|\n";

  for (const [project, stats] of sorted) {
    table += `| ${project} | ${stats.count} | ${formatCost(stats.cost)} |\n`;
  }

  return table;
}

export async function isClaudeActive(): Promise<boolean> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execPromise = promisify(exec);
    const { stdout } = await execPromise("pgrep -x claude || true");
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}
