import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";

export default function HelpPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Help" />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-8 pt-4">
        <Card title="What StormReady is">
          A household plan for this home. You answer a few questions; StormReady
          shows official alerts and recommended actions when those services are
          connected.
        </Card>
        <Card title="No login required">
          The anonymous path is the product. Log In and Save My Plan are later,
          optional features.
        </Card>
        <Card title="We do not invent alerts">
          If the alert or plan service is missing, you will see unavailable copy.
          An empty list is not treated as all-clear unless an official check says
          so.
        </Card>
        <Card title="Your data">
          Home and household details stay in this browser. They are not uploaded
          until a later save flow exists.
        </Card>
        <Card title="Map">
          The Map tab is a placeholder. There is no Mapbox or live map in Phase 1.
        </Card>
      </div>
    </main>
  );
}
