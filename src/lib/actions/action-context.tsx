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
  const actionsMapRef = useRef<Map<string, AppAction>>(new Map());
  const [registryVersion, setRegistryVersion] = useState(0);

  const bumpRegistry = useCallback(() => {
    setRegistryVersion((version) => version + 1);
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

  const executeAction = useCallback(async (actionId: string) => {
    const action = actionsMapRef.current.get(actionId);

    if (!action) {
      console.warn(`[ActionRegistry] Action not found: ${actionId}`);
      return;
    }

    if (action.isAvailable && !action.isAvailable()) {
      console.warn(
        `[ActionRegistry] Action not available currently: ${actionId}`,
      );
      return;
    }

    try {
      await action.execute();
    } catch (err) {
      console.error(
        `[ActionRegistry] Failed to execute action ${actionId}:`,
        err,
      );
    }
  }, []);

  // Mobile quick actions state
  const [isMobileQuickActionsOpen, setIsMobileQuickActionsOpen] =
    useState(false);

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

  // Rebuild the action list whenever the registry changes.
  const actions = useMemo(() => {
    return Array.from(actionsMapRef.current.values());
  }, [registryVersion]);

  const availableActions = useMemo(
    () =>
      actions.filter((action) =>
        action.isAvailable ? action.isAvailable() : true,
      ),
    [actions],
  );

  // Global keyboard shortcuts.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.metaKey || event.ctrlKey;
      const key = event.key;
      const inEditable = isEditableElement(event.target);

      // Escape closes the mobile quick-actions menu.
      if (key === "Escape") {
        if (isMobileQuickActionsOpen) {
          event.preventDefault();
          setIsMobileQuickActionsOpen(false);
        }
        return;
      }

      // Cmd/Ctrl + / focuses MailPoint search.
      // This shortcut is intentionally independent of the removed
      // Command Palette.
      if (isCtrlOrCmd && key === "/") {
        event.preventDefault();

        const searchAction = actionsMapRef.current.get("mail.search");
        if (searchAction) {
          void searchAction.execute();
        }

        return;
      }

      // Never trigger single-key shortcuts while the user is typing.
      if (inEditable) {
        return;
      }

      // Match registered keyboard shortcuts.
      for (const action of actionsMapRef.current.values()) {
        if (!action.shortcut) continue;
        if (action.isAvailable && !action.isAvailable()) continue;

        const shortcut = action.shortcut;
        const keyMatch =
          shortcut.key.toLowerCase() === key.toLowerCase() ||
          (shortcut.key === "Enter" && key === "Enter");
        const ctrlMatch = Boolean(shortcut.ctrlOrCmd) === isCtrlOrCmd;
        const shiftMatch = Boolean(shortcut.shift) === event.shiftKey;
        const altMatch = Boolean(shortcut.alt) === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          void action.execute();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileQuickActionsOpen]);

  const value = useMemo<ActionContextType>(
    () => ({
      actions,
      availableActions,
      registerAction,
      registerActions,
      executeAction,
      getAction,
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
      isMobileQuickActionsOpen,
      isMobile,
      isTablet,
      hasTouch,
    ],
  );

  return (
    <ActionContext.Provider value={value}>{children}</ActionContext.Provider>
  );
}

export function useActions() {
  const context = useContext(ActionContext);

  if (!context) {
    throw new Error("useActions must be used within an ActionProvider");
  }

  return context;
}
export function useRegisterActions(actionsList: AppAction[]) {
  const { registerActions } = useActions();

  useEffect(() => {
    const unregister = registerActions(actionsList);
    return unregister;
  }, [registerActions, actionsList]);
}
