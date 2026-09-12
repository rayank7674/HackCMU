import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-full flex-1 flex-col px-5 pb-8 pt-10">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
        Live session
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
        Play together.
        <span className="mt-1 block text-muted">Stay in sync.</span>
      </h1>
      <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">
        Create a room, drop in with your group, and keep scores and presence
        updating in real time.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Button href="/dashboard">Start Session</Button>
        <Button href="/dashboard?intent=create" variant="secondary">
          Create Room
        </Button>
      </div>

      <div className="mt-10 grid gap-3">
        <Card title="Rooms">
          Spin up a shared space and invite people with a short code.
        </Card>
        <Card title="Live board">
          Swap between group members and a running leaderboard.
        </Card>
      </div>

      <p className="mt-auto pt-10 text-center text-xs text-muted">
        Built for HackCMU ·{" "}
        <Link href="/dashboard" className="text-accent underline-offset-2 hover:underline">
          Open lobby
        </Link>
      </p>
    </main>
  );
}
