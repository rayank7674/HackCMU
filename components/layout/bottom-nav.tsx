"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: HomeIcon, match: (path: string) => path === "/" },
  {
    href: "/plan",
    label: "Plan",
    icon: PlanIcon,
    match: (path: string) => path.startsWith("/plan"),
  },
  {
    href: "/map",
    label: "Map",
    icon: MapIcon,
    match: (path: string) => path.startsWith("/map"),
  },
  {
    href: "/help",
    label: "Help",
    icon: HelpIcon,
    match: (path: string) => path.startsWith("/help"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: ProfileIcon,
    match: (path: string) => path.startsWith("/profile"),
  },
] as const;

const hiddenPrefixes = ["/onboarding", "/dashboard"];

export function BottomNav() {
  const pathname = usePathname();

  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-20 border-t border-border bg-background/92 px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-medium ${
                  active ? "text-accent-strong" : "text-muted"
                }`}
              >
                <Icon active={active} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = {
  active: boolean;
};

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 10.5 12 4l7.5 6.5V20a1 1 0 0 1-1 1h-5v-6h-3v6h-5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 4.5h8.5A2.5 2.5 0 0 1 19 7v12.5H8A2.5 2.5 0 0 1 5.5 17V7A2.5 2.5 0 0 1 8 4.5Z"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
      />
      <path
        d="M9 9h6M9 12.5h6M9 16h3.5"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 7.2 9 5.5l6 2.2 4.5-1.7V16.8L15 18.5l-6-2.2-4.5 1.7V7.2Z"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HelpIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.2"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
      />
      <path
        d="M9.6 9.4a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.8-1.1 1.7V14"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.4" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ProfileIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="9"
        r="3.2"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
      />
      <path
        d="M6.2 18.2c.9-2.6 3-4 5.8-4s4.9 1.4 5.8 4"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
