"use client";

import Link from "next/link";
import { APP_NAME, APP_NAME_SHORT } from "@/lib/brand";
import { useAppAccess } from "@/lib/use-app-access";

type BrandLinkProps = {
  className?: string;
  collapsed?: boolean;
};

export function BrandLink({ className, collapsed = false }: BrandLinkProps) {
  const { inApp } = useAppAccess();
  return (
    <Link
      href={inApp ? "/home" : "/"}
      className={className}
      aria-label={`${APP_NAME} home`}
    >
      {collapsed ? APP_NAME_SHORT : APP_NAME}
    </Link>
  );
}
