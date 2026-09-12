import { Header } from "@/components/layout/header";
import { MapStressShell } from "@/components/stormready/map-stress-shell";

export default function MapPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Map" />
      <MapStressShell />
    </main>
  );
}
