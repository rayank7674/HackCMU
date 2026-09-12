import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,#d7e4f4_0%,#eef3f8_46%,#f4f7fb_100%)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background shadow-[0_0_80px_rgba(16,35,61,0.08)] sm:min-h-[min(100dvh,920px)] sm:border-x sm:border-border">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}
