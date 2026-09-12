import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";

export default function MapPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Map" />
      <div className="flex flex-1 flex-col px-5 pb-8 pt-6">
        <Card eyebrow="Placeholder" title="Map is not available yet">
          StormReady does not load a map in this version. A later release may
          add a map of your area. Your plan does not depend on it.
        </Card>
      </div>
    </main>
  );
}
