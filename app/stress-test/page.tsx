import { Suspense } from "react";
import { StressView } from "@/components/stormready/stress-view";

export default function StressTestPage() {
  return (
    <Suspense>
      <StressView />
    </Suspense>
  );
}
