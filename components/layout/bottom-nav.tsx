"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavCollapse } from "@/components/layout/nav-collapse";
import { ThemeToggle } from "@/components/layout/theme-toggle";


export const STRESS_TEST_HREF = "/stress-test";

export const MAIN_NAV_TABS = [
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
    href: STRESS_TEST_HREF,
    label: "Stress",
    icon: StressIcon,
    match: (path: string) => path.startsWith(STRESS_TEST_HREF),
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
  const { collapsed, toggleCollapsed } = useNavCollapse();

  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <nav aria-label="Main" className="sr-nav">
      <div className="sr-nav-top">
        <p className="sr-nav-brand">{collapsed ? "SR" : "StormReady"}</p>
        <ThemeToggle />
        <button
          type="button"
          className="sr-nav-collapse"
          aria-pressed={collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapsed}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      <ul className="sr-nav-list">
        {MAIN_NAV_TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-label={tab.href === STRESS_TEST_HREF ? "Stress Test" : tab.label}
                aria-current={active ? "page" : undefined}
                title={tab.label}
                className={`sr-nav-link ${active ? "is-active" : ""}`}
              >
                <Icon active={active} />
                <span className="sr-nav-link-label">{tab.label}</span>
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

function StressIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 3 6.5 13h5L11 21l6.5-10h-5L13 3Z"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.6}
        strokeLinejoin="round"
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
