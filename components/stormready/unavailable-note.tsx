import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";

export function UnavailableNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card eyebrow="Unavailable" title={title}>
      <p>{children}</p>
    </Card>
  );
}
