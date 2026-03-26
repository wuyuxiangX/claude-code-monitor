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
import { useState } from "react";
import { usePlugins } from "./hooks/usePlugins";
import {
  enablePlugin,
  disablePlugin,
  uninstallPlugin,
  updatePlugin,
} from "./lib/plugins";
import { uninstallSkill } from "./lib/skills";
import { removeMcpServer } from "./lib/mcp";
import type { PluginInfo, SkillInfo, McpServerInfo } from "./types";

type ViewMode = "plugins" | "skills" | "mcp";

const SEARCH_PLACEHOLDERS: Record<ViewMode, string> = {
  plugins: "Search plugins...",
  skills: "Search skills...",
  mcp: "Search MCP servers...",
};

export default function PluginManagerCommand() {
  const [viewMode, setViewMode] = useState<ViewMode>("plugins");
  const {
    enabledPlugins, disabledPlugins, skills, mcpServers,
    isLoading, isMcpLoading, revalidateLocal, revalidateMcp,
  } = usePlugins();

  return (
    <List
      isLoading={viewMode === "mcp" ? isMcpLoading : isLoading}
      searchBarPlaceholder={SEARCH_PLACEHOLDERS[viewMode]}
      searchBarAccessory={
        <List.Dropdown
          tooltip="View"
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
        >
          <List.Dropdown.Item title="Plugins" value="plugins" icon={Icon.Plug} />
          <List.Dropdown.Item title="Skills" value="skills" icon={Icon.Book} />
          <List.Dropdown.Item title="MCP Servers" value="mcp" icon={Icon.Globe} />
        </List.Dropdown>
      }
    >
      {viewMode === "plugins" && (
        <PluginsView
          enabledPlugins={enabledPlugins}
          disabledPlugins={disabledPlugins}
          isLoading={isLoading}
          revalidate={revalidateLocal}
        />
      )}
      {viewMode === "skills" && (
        <SkillsView
          skills={skills}
          isLoading={isLoading}
          revalidate={revalidateLocal}
        />
      )}
      {viewMode === "mcp" && (
        <McpView
          servers={mcpServers}
          isLoading={isMcpLoading}
          revalidate={revalidateMcp}
        />
      )}
    </List>
  );
}

// ===== Plugins View =====

function PluginsView({
  enabledPlugins,
  disabledPlugins,
  isLoading,
  revalidate,
}: {
  enabledPlugins: PluginInfo[];
  disabledPlugins: PluginInfo[];
  isLoading: boolean;
  revalidate: () => void;
}) {
  const isEmpty = enabledPlugins.length === 0 && disabledPlugins.length === 0;

  return (
    <>
      {isEmpty && !isLoading && (
        <List.EmptyView
          title="No Plugins Installed"
          description="Install plugins using Claude Code's /install-plugin command."
          icon={Icon.Plug}
        />
      )}
      {enabledPlugins.length > 0 && (
        <List.Section title="Enabled" subtitle={`${enabledPlugins.length}`}>
          {enabledPlugins.map((p) => (
            <PluginListItem key={p.key} plugin={p} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
      {disabledPlugins.length > 0 && (
        <List.Section title="Disabled" subtitle={`${disabledPlugins.length}`}>
          {disabledPlugins.map((p) => (
            <PluginListItem key={p.key} plugin={p} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
    </>
  );
}

function PluginListItem({
  plugin,
  revalidate,
}: {
  plugin: PluginInfo;
  revalidate: () => void;
}) {
  const description = plugin.metadata?.description ?? "";

  const accessories: List.Item.Accessory[] = [];

  if (plugin.blocklist) {
    accessories.push({
      icon: { source: Icon.ExclamationMark, tintColor: Color.Red },
      tooltip: `Blocked: ${plugin.blocklist.reason}`,
    });
  }

  if (!plugin.installPathExists) {
    accessories.push({
      icon: { source: Icon.Warning, tintColor: Color.Orange },
      tooltip: "Install path missing",
    });
  }

  if (plugin.installation.scope === "local") {
    accessories.push({
      tag: { value: "Local", color: Color.Purple },
    });
  }

  accessories.push({
    tag: { value: plugin.marketplaceId || "unknown", color: Color.Blue },
  });

  const version = plugin.installation.version;
  if (version && version !== "unknown") {
    const displayVersion = version.length > 8 ? version.slice(0, 7) : version;
    accessories.push({
      tag: { value: `v${displayVersion}`, color: Color.SecondaryText },
    });
  }

  const icon = plugin.enabled
    ? { source: Icon.CheckCircle, tintColor: Color.Green }
    : { source: Icon.Circle, tintColor: Color.SecondaryText };

  return (
    <List.Item
      title={plugin.name}
      subtitle={description}
      icon={icon}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Plugin">
            <Action.Push
              title="View Details"
              icon={Icon.Eye}
              target={
                <PluginDetailView plugin={plugin} revalidate={revalidate} />
              }
            />
            <Action
              title={plugin.enabled ? "Disable Plugin" : "Enable Plugin"}
              icon={plugin.enabled ? Icon.CircleDisabled : Icon.CheckCircle}
              shortcut={{ modifiers: ["cmd"], key: "e" }}
              onAction={() => handleToggle(plugin, revalidate)}
            />
            <Action
              title="Update Plugin"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd"], key: "u" }}
              onAction={() => handleUpdate(plugin, revalidate)}
            />
            {plugin.metadata?.homepage && (
              <Action.OpenInBrowser
                title="Open Homepage"
                url={plugin.metadata.homepage}
                shortcut={{ modifiers: ["cmd"], key: "o" }}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section title="Copy">
            <Action.CopyToClipboard
              title="Copy Plugin Key"
              content={plugin.key}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              title="Copy Install Path"
              content={plugin.installation.installPath}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Uninstall Plugin"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["ctrl"], key: "x" }}
              onAction={() => handleUninstall(plugin, revalidate)}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

// ===== Skills View =====

function SkillsView({
  skills,
  isLoading,
  revalidate,
}: {
  skills: SkillInfo[];
  isLoading: boolean;
  revalidate: () => void;
}) {
  const userSkills = skills.filter((s) => s.source === "user");
  const commandSkills = skills.filter((s) => s.source === "command");
  const pluginSkills = skills.filter((s) => s.source === "plugin");

  const isEmpty = skills.length === 0;

  return (
    <>
      {isEmpty && !isLoading && (
        <List.EmptyView
          title="No Skills Installed"
          description="Install skills using npx skills add <package>."
          icon={Icon.Book}
        />
      )}
      {userSkills.length > 0 && (
        <List.Section title="User Skills" subtitle={`${userSkills.length}`}>
          {userSkills.map((s) => (
            <SkillListItem key={`user-${s.dirName}`} skill={s} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
      {commandSkills.length > 0 && (
        <List.Section title="Commands" subtitle={`${commandSkills.length}`}>
          {commandSkills.map((s) => (
            <SkillListItem key={`cmd-${s.dirName}`} skill={s} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
      {pluginSkills.length > 0 && (
        <List.Section title="Plugin Skills" subtitle={`${pluginSkills.length}`}>
          {pluginSkills.map((s) => (
            <SkillListItem key={`plugin-${s.dirName}`} skill={s} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
    </>
  );
}

function SkillListItem({
  skill,
  revalidate,
}: {
  skill: SkillInfo;
  revalidate: () => void;
}) {
  const accessories: List.Item.Accessory[] = [];

  if (skill.userInvokable) {
    accessories.push({
      tag: { value: `/${skill.name}`, color: Color.Green },
    });
  }

  if (skill.pluginName) {
    accessories.push({
      tag: { value: skill.pluginName, color: Color.Blue },
    });
  } else if (skill.source === "user") {
    accessories.push({
      tag: {
        value: skill.isSymlink ? "Symlink" : "Local",
        color: skill.isSymlink ? Color.Blue : Color.Purple,
      },
    });
  }

  return (
    <List.Item
      title={skill.name}
      subtitle={skill.description}
      icon={{ source: Icon.Book, tintColor: Color.Blue }}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Skill">
            <Action.Push
              title="View Details"
              icon={Icon.Eye}
              target={<SkillDetailView skill={skill} revalidate={revalidate} />}
            />
            <Action.ShowInFinder
              title="Show in Finder"
              path={skill.path}
              shortcut={{ modifiers: ["cmd"], key: "f" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Copy">
            <Action.CopyToClipboard
              title="Copy Skill Name"
              content={skill.name}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              title="Copy Skill Path"
              content={skill.path}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Uninstall Skill"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["ctrl"], key: "x" }}
              onAction={() => handleUninstallSkill(skill, revalidate)}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function SkillDetailView({
  skill,
  revalidate,
}: {
  skill: SkillInfo;
  revalidate: () => void;
}) {
  let markdown = `# ${skill.name}\n\n`;
  if (skill.description) markdown += `${skill.description}\n\n`;
  if (skill.userInvokable) markdown += `Use with \`/${skill.name}\` in Claude Code.\n\n`;

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Name" text={skill.name} />
          <Detail.Metadata.Label title="Directory" text={skill.dirName} />
          <Detail.Metadata.TagList title="Type">
            <Detail.Metadata.TagList.Item
              text={skill.isSymlink ? "Symlink" : "Local"}
              color={skill.isSymlink ? Color.Blue : Color.Purple}
            />
            {skill.userInvokable && (
              <Detail.Metadata.TagList.Item
                text="Invokable"
                color={Color.Green}
              />
            )}
          </Detail.Metadata.TagList>
          {skill.symlinkTarget && (
            <>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label
                title="Symlink Target"
                text={skill.symlinkTarget}
              />
            </>
          )}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Path" text={skill.path} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.ShowInFinder
            title="Show in Finder"
            path={skill.path}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
          />
          <Action.CopyToClipboard
            title="Copy Skill Name"
            content={skill.name}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action
            title="Uninstall Skill"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["ctrl"], key: "x" }}
            onAction={() => handleUninstallSkill(skill, revalidate)}
          />
        </ActionPanel>
      }
    />
  );
}

// ===== Plugin Action Handlers =====

async function handleToggle(plugin: PluginInfo, revalidate: () => void) {
  const action = plugin.enabled ? "Disable" : "Enable";
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: `${action === "Disable" ? "Disabling" : "Enabling"} ${plugin.name}...`,
  });
  try {
    if (plugin.enabled) {
      await disablePlugin(plugin.key);
    } else {
      await enablePlugin(plugin.key);
    }
    revalidate();
    toast.style = Toast.Style.Success;
    toast.title = `${action}d ${plugin.name}`;
  } catch (err) {
    toast.style = Toast.Style.Failure;
    toast.title = `Failed to ${action.toLowerCase()} plugin`;
    toast.message = err instanceof Error ? err.message : String(err);
  }
}

async function handleUpdate(plugin: PluginInfo, revalidate: () => void) {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: `Updating ${plugin.name}...`,
  });
  try {
    await updatePlugin(plugin.key);
    revalidate();
    toast.style = Toast.Style.Success;
    toast.title = `Updated ${plugin.name}`;
  } catch (err) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to update plugin";
    toast.message = err instanceof Error ? err.message : String(err);
  }
}

async function handleUninstall(plugin: PluginInfo, revalidate: () => void) {
  const confirmed = await confirmAlert({
    title: "Uninstall Plugin",
    message: `Remove "${plugin.name}" from Claude Code?`,
    primaryAction: {
      title: "Uninstall",
      style: Alert.ActionStyle.Destructive,
    },
  });
  if (!confirmed) return;

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: `Uninstalling ${plugin.name}...`,
  });
  try {
    await uninstallPlugin(plugin.key);
    revalidate();
    toast.style = Toast.Style.Success;
    toast.title = `Uninstalled ${plugin.name}`;
  } catch (err) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to uninstall plugin";
    toast.message = err instanceof Error ? err.message : String(err);
  }
}

async function handleUninstallSkill(skill: SkillInfo, revalidate: () => void) {
  const confirmed = await confirmAlert({
    title: "Uninstall Skill",
    message: `Remove "${skill.name}" from Claude Code?${skill.isSymlink ? " (This will only remove the symlink)" : ""}`,
    primaryAction: {
      title: "Uninstall",
      style: Alert.ActionStyle.Destructive,
    },
  });
  if (!confirmed) return;

  try {
    uninstallSkill(skill.dirName);
    revalidate();
    await showToast({
      style: Toast.Style.Success,
      title: `Uninstalled ${skill.name}`,
    });
  } catch (err) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to uninstall skill",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// ===== MCP View =====

function McpView({
  servers,
  isLoading,
  revalidate,
}: {
  servers: McpServerInfo[];
  isLoading: boolean;
  revalidate: () => void;
}) {
  const userServers = servers.filter((s) => s.category === "user");
  const cloudServers = servers.filter((s) => s.category === "cloud");
  const builtinServers = servers.filter((s) => s.category === "builtin");

  const isEmpty = servers.length === 0;

  return (
    <>
      {isEmpty && !isLoading && (
        <List.EmptyView
          title="No MCP Servers"
          description='Add MCP servers using "claude mcp add" command.'
          icon={Icon.Globe}
        />
      )}
      {userServers.length > 0 && (
        <List.Section title="User MCPs" subtitle={`${userServers.length}`}>
          {userServers.map((s) => (
            <McpListItem key={s.name} server={s} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
      {cloudServers.length > 0 && (
        <List.Section title="claude.ai" subtitle={`${cloudServers.length}`}>
          {cloudServers.map((s) => (
            <McpListItem key={s.name} server={s} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
      {builtinServers.length > 0 && (
        <List.Section title="Built-in MCPs" subtitle={`${builtinServers.length}`}>
          {builtinServers.map((s) => (
            <McpListItem key={s.name} server={s} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
    </>
  );
}

function McpListItem({
  server,
  revalidate,
}: {
  server: McpServerInfo;
  revalidate: () => void;
}) {
  const isConnected = server.status === "Connected";
  const needsAuth = server.status === "Needs Auth";
  const isUnreachable = server.status === "Unreachable";

  const icon = isConnected
    ? { source: Icon.CheckCircle, tintColor: Color.Green }
    : needsAuth
      ? { source: Icon.ExclamationMark, tintColor: Color.Orange }
      : isUnreachable
        ? { source: Icon.Warning, tintColor: Color.Yellow }
        : { source: Icon.Circle, tintColor: Color.SecondaryText };

  const accessories: List.Item.Accessory[] = [];

  if (server.type) {
    accessories.push({
      tag: { value: server.type, color: Color.Blue },
    });
  }

  const STATUS_COLOR: Record<string, Color> = {
    Connected: Color.Green,
    "Needs Auth": Color.Orange,
    Unreachable: Color.Yellow,
  };

  if (isUnreachable && server.statusDetail) {
    accessories.push({
      icon: { source: Icon.Info, tintColor: Color.SecondaryText },
      tooltip: server.statusDetail,
    });
  }

  accessories.push({
    tag: {
      value: server.status || "Unknown",
      color: STATUS_COLOR[server.status] ?? Color.SecondaryText,
    },
    tooltip: isUnreachable ? "Health check unreachable — may still work in active sessions" : undefined,
  });

  const subtitle = server.url || (server.command ? `${server.command} ${server.args || ""}` : "");

  return (
    <List.Item
      title={server.name}
      subtitle={subtitle}
      icon={icon}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="MCP Server">
            <Action.Push
              title="View Details"
              icon={Icon.Eye}
              target={<McpDetailView server={server} revalidate={revalidate} />}
            />
            {needsAuth && server.url && (
              <Action.OpenInBrowser
                title="Open Auth URL"
                url={server.url}
                icon={Icon.Globe}
              />
            )}
            <Action
              title="Refresh Status"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={revalidate}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Copy">
            <Action.CopyToClipboard
              title="Copy Server Name"
              content={server.name}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            {(server.url || server.command) && (
              <Action.CopyToClipboard
                title="Copy Command / URL"
                content={server.url || `${server.command} ${server.args || ""}`}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
            )}
          </ActionPanel.Section>
          {server.category === "user" && (
            <ActionPanel.Section>
              <Action
                title="Remove Server"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["ctrl"], key: "x" }}
                onAction={() => handleRemoveMcp(server, revalidate)}
              />
            </ActionPanel.Section>
          )}
        </ActionPanel>
      }
    />
  );
}

function McpDetailView({
  server,
  revalidate,
}: {
  server: McpServerInfo;
  revalidate: () => void;
}) {
  let markdown = `# ${server.name}\n\n`;
  if (server.url) markdown += `**URL:** \`${server.url}\`\n\n`;
  if (server.command) markdown += `**Command:** \`${server.command} ${server.args || ""}\`\n\n`;
  if (server.status === "Unreachable" && server.statusDetail) {
    markdown += `> **Health Check:** ${server.statusDetail}\n>\n> Unreachable during health check — this does not mean the server cannot work in active Claude Code sessions. npx-based servers often fail health checks due to startup time.\n\n`;
  }

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Name" text={server.name} />
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item
              text={server.status || "Unknown"}
              color={
                server.status === "Connected" ? Color.Green
                  : server.status === "Needs Auth" ? Color.Orange
                    : server.status === "Unreachable" ? Color.Yellow
                      : Color.SecondaryText
              }
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Label title="Category" text={server.category} />
          {server.statusDetail && (
            <Detail.Metadata.Label title="Detail" text={server.statusDetail} />
          )}
          <Detail.Metadata.Separator />
          {server.type && (
            <Detail.Metadata.Label title="Type" text={server.type} />
          )}
          {server.command && (
            <Detail.Metadata.Label title="Command" text={server.command} />
          )}
          {server.args && (
            <Detail.Metadata.Label title="Args" text={server.args} />
          )}
          {server.url && (
            <Detail.Metadata.Label title="URL" text={server.url} />
          )}
          {server.env && (
            <>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label title="Environment" text={server.env} />
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title="Refresh Status"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={revalidate}
          />
          <Action.CopyToClipboard
            title="Copy Server Name"
            content={server.name}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          {server.category === "user" && (
            <Action
              title="Remove Server"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["ctrl"], key: "x" }}
              onAction={() => handleRemoveMcp(server, revalidate)}
            />
          )}
        </ActionPanel>
      }
    />
  );
}

async function handleRemoveMcp(server: McpServerInfo, revalidate: () => void) {
  const confirmed = await confirmAlert({
    title: "Remove MCP Server",
    message: `Remove "${server.name}" from Claude Code?`,
    primaryAction: {
      title: "Remove",
      style: Alert.ActionStyle.Destructive,
    },
  });
  if (!confirmed) return;

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: `Removing ${server.name}...`,
  });
  try {
    await removeMcpServer(server.name);
    revalidate();
    toast.style = Toast.Style.Success;
    toast.title = `Removed ${server.name}`;
  } catch (err) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to remove MCP server";
    toast.message = err instanceof Error ? err.message : String(err);
  }
}

// ===== Plugin Detail View =====

function PluginDetailView({
  plugin,
  revalidate,
}: {
  plugin: PluginInfo;
  revalidate: () => void;
}) {
  const meta = plugin.metadata;
  const contents = plugin.contents;

  let markdown = `# ${meta?.name || plugin.name}\n\n`;
  if (meta?.description) markdown += `${meta.description}\n\n`;

  markdown += `---\n\n`;

  if (contents) {
    if (contents.commands.length > 0) {
      markdown += `## Commands\n\n`;
      for (const cmd of contents.commands) {
        markdown += `- \`/${cmd}\`\n`;
      }
      markdown += `\n`;
    }
    if (contents.skills.length > 0) {
      markdown += `## Skills\n\n`;
      for (const skill of contents.skills) {
        markdown += `- ${skill}\n`;
      }
      markdown += `\n`;
    }
    if (contents.agents.length > 0) {
      markdown += `## Agents\n\n`;
      for (const agent of contents.agents) {
        markdown += `- ${agent}\n`;
      }
      markdown += `\n`;
    }
    if (contents.mcpServers.length > 0) {
      markdown += `## MCP Servers\n\n`;
      for (const server of contents.mcpServers) {
        markdown += `- ${server}\n`;
      }
      markdown += `\n`;
    }
  }

  const installedDate = plugin.installation.installedAt
    ? new Date(plugin.installation.installedAt).toLocaleDateString()
    : "Unknown";
  const updatedDate = plugin.installation.lastUpdated
    ? new Date(plugin.installation.lastUpdated).toLocaleDateString()
    : "Unknown";

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Plugin Key" text={plugin.key} />
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item
              text={plugin.enabled ? "Enabled" : "Disabled"}
              color={plugin.enabled ? Color.Green : Color.SecondaryText}
            />
            {plugin.blocklist && (
              <Detail.Metadata.TagList.Item
                text="Blocked"
                color={Color.Red}
              />
            )}
            {!plugin.installPathExists && (
              <Detail.Metadata.TagList.Item
                text="Missing"
                color={Color.Orange}
              />
            )}
          </Detail.Metadata.TagList>
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="Version"
            text={plugin.installation.version || "unknown"}
          />
          {meta?.author?.name && (
            <Detail.Metadata.Label title="Author" text={meta.author.name} />
          )}
          <Detail.Metadata.Label
            title="Marketplace"
            text={plugin.marketplaceId || "unknown"}
          />
          {plugin.marketplace?.source?.repo && (
            <Detail.Metadata.Label
              title="Source Repo"
              text={plugin.marketplace.source.repo}
            />
          )}
          <Detail.Metadata.Label
            title="Scope"
            text={plugin.installation.scope}
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Installed" text={installedDate} />
          <Detail.Metadata.Label title="Last Updated" text={updatedDate} />
          {plugin.installation.gitCommitSha && (
            <Detail.Metadata.Label
              title="Git SHA"
              text={plugin.installation.gitCommitSha.slice(0, 8)}
            />
          )}
          <Detail.Metadata.Separator />
          {contents && (
            <>
              <Detail.Metadata.Label
                title="Commands"
                text={`${contents.commands.length}`}
              />
              <Detail.Metadata.Label
                title="Skills"
                text={`${contents.skills.length}`}
              />
              <Detail.Metadata.Label
                title="Agents"
                text={`${contents.agents.length}`}
              />
              <Detail.Metadata.Label
                title="MCP Servers"
                text={`${contents.mcpServers.length}`}
              />
            </>
          )}
          {plugin.blocklist && (
            <>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Label
                title="Block Reason"
                text={plugin.blocklist.reason}
              />
              <Detail.Metadata.Label
                title="Block Detail"
                text={plugin.blocklist.text}
              />
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title={plugin.enabled ? "Disable Plugin" : "Enable Plugin"}
            icon={plugin.enabled ? Icon.CircleDisabled : Icon.CheckCircle}
            onAction={() => handleToggle(plugin, revalidate)}
          />
          <Action
            title="Update Plugin"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "u" }}
            onAction={() => handleUpdate(plugin, revalidate)}
          />
          {plugin.installPathExists && (
            <Action.ShowInFinder
              title="Show in Finder"
              path={plugin.installation.installPath}
              shortcut={{ modifiers: ["cmd"], key: "f" }}
            />
          )}
          {meta?.homepage && (
            <Action.OpenInBrowser
              title="Open Homepage"
              url={meta.homepage}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          )}
          <Action.CopyToClipboard
            title="Copy Plugin Key"
            content={plugin.key}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}
