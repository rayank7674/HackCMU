import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,#15202b_0%,#07080c_55%)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background shadow-[0_0_80px_rgba(0,0,0,0.45)] sm:min-h-[min(100dvh,920px)] sm:border-x sm:border-border">
        {children}
      </div>
    </div>
  );
}
