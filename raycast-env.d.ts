/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Default Application - Fallback app to focus when session's launch app is unknown */
  "defaultApp": "Apple_Terminal" | "iTerm.app" | "WarpTerminal" | "ghostty" | "vscode" | "cursor" | "zed" | "windsurf" | "jetbrains-idea" | "jetbrains-webstorm" | "jetbrains-pycharm"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `sessions` command */
  export type Sessions = ExtensionPreferences & {}
  /** Preferences accessible in the `menu-bar` command */
  export type MenuBar = ExtensionPreferences & {}
  /** Preferences accessible in the `usage-dashboard` command */
  export type UsageDashboard = ExtensionPreferences & {}
  /** Preferences accessible in the `setup` command */
  export type Setup = ExtensionPreferences & {}
  /** Preferences accessible in the `plugins` command */
  export type Plugins = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `sessions` command */
  export type Sessions = {}
  /** Arguments passed to the `menu-bar` command */
  export type MenuBar = {}
  /** Arguments passed to the `usage-dashboard` command */
  export type UsageDashboard = {}
  /** Arguments passed to the `setup` command */
  export type Setup = {}
  /** Arguments passed to the `plugins` command */
  export type Plugins = {}
}

