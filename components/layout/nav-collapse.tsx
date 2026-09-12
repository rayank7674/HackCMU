"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const NAV_COLLAPSED_KEY = "stormready.navCollapsed";
const NAV_COLLAPSE_EVENT = "stormready-nav-collapsed";

type NavCollapseContextValue = {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
};

const NavCollapseContext = createContext<NavCollapseContextValue | null>(null);

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function NavCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    setCollapsedState(readCollapsed());
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(NAV_COLLAPSE_EVENT));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const value = useMemo(
    () => ({ collapsed, setCollapsed, toggleCollapsed }),
    [collapsed, setCollapsed, toggleCollapsed],
  );

  return (
    <NavCollapseContext.Provider value={value}>
      {children}
    </NavCollapseContext.Provider>
  );
}

export function useNavCollapse() {
  const ctx = useContext(NavCollapseContext);
  if (!ctx) {
    throw new Error("useNavCollapse must be used within NavCollapseProvider");
  }
  return ctx;
}
