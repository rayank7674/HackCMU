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
import {
  DEMO_VIEWPORT_KEY,
  LAPTOP_MIN_WIDTH,
  canToggleDemoViewport,
  demoViewportAttribute,
  parseDemoViewport,
  type DemoViewport,
} from "@/lib/layout/viewport-mode";

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
  document.documentElement.style.setProperty(
    "--sr-is-demo-phone",
    applied === "mobile" ? "1" : "0",
  );
  return applied;
}

export function ViewportModeProvider({ children }: { children: ReactNode }) {
  const [stored, setStoredState] = useState<DemoViewport>("laptop");
  const [width, setWidth] = useState(LAPTOP_MIN_WIDTH);

  useEffect(() => {
    const initial = readStored();
    setStoredState(initial);
    setWidth(window.innerWidth);
    applyAttribute(initial, window.innerWidth);

    const onResize = () => {
      setWidth(window.innerWidth);
      applyAttribute(readStored(), window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const setStored = useCallback((next: DemoViewport) => {
    setStoredState(next);
    try {
      window.localStorage.setItem(DEMO_VIEWPORT_KEY, next);
    } catch {
      /* private mode */
    }
    applyAttribute(next, window.innerWidth);
    setWidth(window.innerWidth);
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
