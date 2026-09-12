"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import {
  NavCollapseProvider,
  useNavCollapse,
} from "@/components/layout/nav-collapse";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <NavCollapseProvider>
      <AppShellInner>{children}</AppShellInner>
    </NavCollapseProvider>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const { collapsed } = useNavCollapse();

  return (
    <div className="sr-stage">
      <div className={`sr-shell${collapsed ? " is-nav-collapsed" : ""}`}>
        <div className="sr-main">
          <div className="sr-main-inner">{children}</div>
        </div>
        <BottomNav />
      </div>
    </div>
  );
}
