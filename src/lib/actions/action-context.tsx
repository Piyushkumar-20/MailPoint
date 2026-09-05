"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppAction } from "./types";

interface ActionContextType {
  actions: AppAction[];
  availableActions: AppAction[];
  registerAction: (action: AppAction) => () => void;
  registerActions: (actions: AppAction[]) => () => void;
  executeAction: (actionId: string) => Promise<void>;
  getAction: (actionId: string) => AppAction | undefined;

  // Command palette state
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  // Shortcuts / help state
  isShortcutsHelpOpen: boolean;
  openShortcutsHelp: () => void;
  closeShortcutsHelp: () => void;

  // Mobile quick actions state
  isMobileQuickActionsOpen: boolean;
  setMobileQuickActionsOpen: (open: boolean) => void;

  // Device context
  isMobile: boolean;
  isTablet: boolean;
  hasTouch: boolean;
}

const ActionContext = createContext<ActionContextType | null>(null);

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable='true']")) return true;
  if (target.closest(".composer-input")) return true;
  if (target.closest(".email-html-body")) return true;
  return false;
}

export function ActionProvider({ children }: { children: React.ReactNode }) {
  // Registry of actions: Map of id -> AppAction
  const actionsMapRef = useRef<Map<string, AppAction>>(new Map());
  const [, setRegistryVersion] = useState(0);

  const bumpRegistry = useCallback(() => {
    setRegistryVersion((v) => v + 1);
  }, []);

  const registerAction = useCallback(
    (action: AppAction) => {
      actionsMapRef.current.set(action.id, action);
      bumpRegistry();

      return () => {
        actionsMapRef.current.delete(action.id);
        bumpRegistry();
      };
    },
    [bumpRegistry],
  );

  const registerActions = useCallback(
    (newActions: AppAction[]) => {
      for (const action of newActions) {
        actionsMapRef.current.set(action.id, action);
      }
      bumpRegistry();

      return () => {
        for (const action of newActions) {
          actionsMapRef.current.delete(action.id);
        }
        bumpRegistry();
      };
    },
    [bumpRegistry],
  );

  const getAction = useCallback((actionId: string) => {
    return actionsMapRef.current.get(actionId);
  }, []);

  const executeAction = useCallback(
    async (actionId: string) => {
      const action = actionsMapRef.current.get(actionId);
      if (!action) {
        console.warn(`[ActionRegistry] Action not found: ${actionId}`);
        return;
      }

      if (action.isAvailable && !action.isAvailable()) {
        console.warn(`[ActionRegistry] Action not available currently: ${actionId}`);
        return;
      }

      try {
        await action.execute();
      } catch (err) {
        console.error(`[ActionRegistry] Failed to execute action ${actionId}:`, err);
      }
    },
    [],
  );

  // Overlay states
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isMobileQuickActionsOpen, setIsMobileQuickActionsOpen] = useState(false);

  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(
    () => setIsCommandPaletteOpen((prev) => !prev),
    [],
  );

  const openShortcutsHelp = useCallback(() => setIsShortcutsHelpOpen(true), []);
  const closeShortcutsHelp = useCallback(() => setIsShortcutsHelpOpen(false), []);

  // Responsive device detection
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);
      setHasTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
    };

    updateDeviceInfo();
    window.addEventListener("resize", updateDeviceInfo);
    return () => window.removeEventListener("resize", updateDeviceInfo);
  }, []);

  // List of all and currently available actions
  const actions = useMemo(() => {
    return Array.from(actionsMapRef.current.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpRegistry, isCommandPaletteOpen, isShortcutsHelpOpen]);

  const availableActions = useMemo(() => {
    return actions.filter((action) => (action.isAvailable ? action.isAvailable() : true));
  }, [actions]);

  // Global Keyboard Shortcuts Event Handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.metaKey || event.ctrlKey;
      const key = event.key;
      const inEditable = isEditableElement(event.target);

      // 1. Esc handler (always allowed anywhere)
      if (key === "Escape") {
        if (isCommandPaletteOpen) {
          event.preventDefault();
          closeCommandPalette();
          return;
        }
        if (isShortcutsHelpOpen) {
          event.preventDefault();
          closeShortcutsHelp();
          return;
        }
        if (isMobileQuickActionsOpen) {
          event.preventDefault();
          setIsMobileQuickActionsOpen(false);
          return;
        }
        return;
      }

      // 2. Cmd/Ctrl + K (Command palette toggle - allowed even in text inputs)
      if (isCtrlOrCmd && (key === "k" || key === "K")) {
        event.preventDefault();
        toggleCommandPalette();
        return;
      }

      // 3. Cmd/Ctrl + / (Quick search focus - allowed in text inputs)
      if (isCtrlOrCmd && key === "/") {
        event.preventDefault();
        const searchAction = actionsMapRef.current.get("mail.search");
        if (searchAction) {
          void searchAction.execute();
        } else {
          openCommandPalette();
        }
        return;
      }

      // 4. If typing inside an input/textarea/editable, STOP HERE to ensure keyboard safety.
      // Do NOT trigger single-key shortcuts like c, j, k, r, f, e, ?, etc. while the user is typing!
      if (inEditable) {
        return;
      }

      // 5. '?' shortcut: open keyboard shortcuts modal
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        openShortcutsHelp();
        return;
      }

      // 6. Match other single-key or modified shortcuts from registered actions
      for (const action of actionsMapRef.current.values()) {
        if (!action.shortcut) continue;
        if (action.isAvailable && !action.isAvailable()) continue;

        const sc = action.shortcut;
        const keyMatch =
          sc.key.toLowerCase() === key.toLowerCase() ||
          (sc.key === "Enter" && key === "Enter");
        const ctrlMatch = Boolean(sc.ctrlOrCmd) === isCtrlOrCmd;
        const shiftMatch = Boolean(sc.shift) === event.shiftKey;
        const altMatch = Boolean(sc.alt) === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          void action.execute();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isCommandPaletteOpen,
    isShortcutsHelpOpen,
    isMobileQuickActionsOpen,
    closeCommandPalette,
    closeShortcutsHelp,
    toggleCommandPalette,
    openCommandPalette,
    openShortcutsHelp,
  ]);

  const value = useMemo<ActionContextType>(
    () => ({
      actions,
      availableActions,
      registerAction,
      registerActions,
      executeAction,
      getAction,
      isCommandPaletteOpen,
      openCommandPalette,
      closeCommandPalette,
      toggleCommandPalette,
      isShortcutsHelpOpen,
      openShortcutsHelp,
      closeShortcutsHelp,
      isMobileQuickActionsOpen,
      setMobileQuickActionsOpen: setIsMobileQuickActionsOpen,
      isMobile,
      isTablet,
      hasTouch,
    }),
    [
      actions,
      availableActions,
      registerAction,
      registerActions,
      executeAction,
      getAction,
      isCommandPaletteOpen,
      openCommandPalette,
      closeCommandPalette,
      toggleCommandPalette,
      isShortcutsHelpOpen,
      openShortcutsHelp,
      closeShortcutsHelp,
      isMobileQuickActionsOpen,
      isMobile,
      isTablet,
      hasTouch,
    ],
  );

  return <ActionContext.Provider value={value}>{children}</ActionContext.Provider>;
}

export function useActions() {
  const context = useContext(ActionContext);
  if (!context) {
    throw new Error("useActions must be used within an ActionProvider");
  }
  return context;
}

/**
 * Convenience hook to register an action or array of actions for a component lifecycle.
 */
export function useRegisterActions(actionsList: AppAction[]) {
  const { registerActions } = useActions();

  useEffect(() => {
    const unregister = registerActions(actionsList);
    return unregister;
  }, [registerActions, actionsList]);
}
