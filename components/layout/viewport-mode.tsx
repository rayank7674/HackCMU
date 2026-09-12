"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEMO_VIEWPORT_KEY,
  LAPTOP_MIN_WIDTH,
  canToggleDemoViewport,
  demoViewportAttribute,
  parseDemoViewport,
  type DemoViewport,
} from "@/lib/layout/viewport-mode";

const VIEWPORT_CHANGE = "stormready-demo-viewport";

type ViewportModeContextValue = {
  stored: DemoViewport;
  applied: DemoViewport;
  showToggle: boolean;
  setStored: (next: DemoViewport) => void;
};

const ViewportModeContext = createContext<ViewportModeContextValue | null>(null);

function readStored(): DemoViewport {
  try {
    return parseDemoViewport(window.localStorage.getItem(DEMO_VIEWPORT_KEY));
  } catch {
    return "laptop";
  }
}

function applyAttribute(stored: DemoViewport, width: number) {
  const applied = demoViewportAttribute(stored, width);
  document.documentElement.setAttribute("data-demo-viewport", applied);
  return applied;
}

function subscribeWidth(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

function subscribeStored(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(VIEWPORT_CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VIEWPORT_CHANGE, onChange);
  };
}

export function ViewportModeProvider({ children }: { children: ReactNode }) {
  const width = useSyncExternalStore(
    subscribeWidth,
    () => window.innerWidth,
    () => LAPTOP_MIN_WIDTH,
  );
  const stored = useSyncExternalStore(
    subscribeStored,
    readStored,
    (): DemoViewport => "laptop",
  );

  useEffect(() => {
    applyAttribute(stored, width);
  }, [stored, width]);

  const setStored = useCallback((next: DemoViewport) => {
    try {
      window.localStorage.setItem(DEMO_VIEWPORT_KEY, next);
    } catch {
      /* private mode */
    }
    applyAttribute(next, window.innerWidth);
    window.dispatchEvent(new Event(VIEWPORT_CHANGE));
  }, []);

  const value = useMemo<ViewportModeContextValue>(
    () => ({
      stored,
      applied: demoViewportAttribute(stored, width),
      showToggle: canToggleDemoViewport(width),
      setStored,
    }),
    [stored, width, setStored],
  );

  return (
    <ViewportModeContext.Provider value={value}>
      {children}
    </ViewportModeContext.Provider>
  );
}

export function useViewportMode() {
  const ctx = useContext(ViewportModeContext);
  if (!ctx) {
    throw new Error("useViewportMode must be used within ViewportModeProvider");
  }
  return ctx;
}

export function ViewportToggle() {
  const { stored, showToggle, setStored } = useViewportMode();

  if (!showToggle) {
    return null;
  }

  const isMobileDemo = stored === "mobile";

  return (
    <div className="sr-viewport-toggle">
      <p className="sr-viewport-toggle-label">Demo layout</p>
      <div className="sr-viewport-toggle-group" role="group" aria-label="Demo layout">
        <button
          type="button"
          aria-pressed={!isMobileDemo}
          className={!isMobileDemo ? "is-active" : undefined}
          onClick={() => setStored("laptop")}
        >
          Laptop
        </button>
        <button
          type="button"
          aria-pressed={isMobileDemo}
          className={isMobileDemo ? "is-active" : undefined}
          onClick={() => setStored("mobile")}
        >
          Mobile
        </button>
      </div>
    </div>
  );
}
