import { Card } from "@/components/ui/card";
import { UnavailableNote } from "@/components/stormready/unavailable-note";
import type { ResourceStatus } from "@/lib/stormready-api";
import type { ReactNode } from "react";

export function Spinner({ label }: { label: string }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 text-sm text-muted"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent-strong"
        aria-hidden
      />
      {label}
    </span>
  );
}

export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded-full bg-surface-elevated"
          style={{ width: `${92 - index * 14}%` }}
        />
      ))}
    </div>
  );
}

export function LoadingCard({
  title,
  label,
  lines = 3,
}: {
  title: string;
  label: string;
  lines?: number;
}) {
  return (
    <Card eyebrow="Loading" title={title}>
      <div role="status" aria-live="polite" aria-label={label} className="space-y-3">
        <Spinner label={label} />
        <SkeletonLines lines={lines} />
      </div>
    </Card>
  );
}

export function ErrorNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card eyebrow="Error" title={title}>
      <p>{children}</p>
    </Card>
  );
}

export function QueryState({
  status,
  title,
  loadingLabel,
  errorMessage,
  unavailableMessage,
}: {
  status: ResourceStatus;
  title: string;
  loadingLabel: string;
  errorMessage: string;
  unavailableMessage: string;
}) {
  if (status === "loading") {
    return <LoadingCard title={title} label={loadingLabel} />;
  }
  if (status === "error") {
    return <ErrorNote title={title}>{errorMessage}</ErrorNote>;
  }
  if (status === "unavailable") {
    return (
      <UnavailableNote title={title}>{unavailableMessage}</UnavailableNote>
    );
  }
  return null;
}
