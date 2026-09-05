import type { ComponentType } from "react";

export type ActionCategory =
  | "mail"
  | "navigation"
  | "calendar"
  | "ai"
  | "system";

export interface ShortcutConfig {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  display: string;
}

export interface AppAction {
  id: string;
  label: string;
  description?: string;
  category: ActionCategory;
  icon?: ComponentType<{ className?: string }>;
  shortcut?: ShortcutConfig;
  keywords?: string[];
  isAvailable?: () => boolean;
  execute: () => void | Promise<void>;
  mobileVisible?: boolean;
  desktopVisible?: boolean;
  priority?: number;
}
