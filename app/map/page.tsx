import { Header } from "@/components/layout/header";
import { MapView } from "@/components/map/map-view";

export default function MapPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Map" />
      <MapView />
    </main>
  );
}
