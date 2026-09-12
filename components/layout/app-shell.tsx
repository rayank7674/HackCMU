"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import {
  ViewportModeProvider,
  ViewportToggle,
} from "@/components/layout/viewport-mode";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <ViewportModeProvider>
      <div className="sr-stage">
        <ViewportToggle />
        <div className="sr-shell">
          <div className="sr-main">
            <div className="sr-main-inner">{children}</div>
          </div>
          <BottomNav />
        </div>
      </div>
    </ViewportModeProvider>
  );
}
