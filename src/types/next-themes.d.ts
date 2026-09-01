declare module "next-themes" {
  import type { ComponentType, ReactNode } from "react";

  export type ThemeProviderProps = {
    children?: ReactNode;
    attribute?: string | string[];
    defaultTheme?: string;
    enableSystem?: boolean;
    disableTransitionOnChange?: boolean;
    forcedTheme?: string;
    themes?: string[];
    value?: Record<string, string>;
    storageKey?: string;
    nonce?: string;
  };

  export const ThemeProvider: ComponentType<ThemeProviderProps>;

  export function useTheme(): {
    theme?: string;
    setTheme: (theme: string) => void;
    forcedTheme?: string;
    resolvedTheme?: string;
    themes: string[];
    systemTheme?: string;
  };
}
