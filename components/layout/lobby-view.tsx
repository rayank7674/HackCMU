"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import type { Member, Standing } from "@/types";

type LobbyViewProps = {
  members: Member[];
  standings: Standing[];
};

export function LobbyView({ members, standings }: LobbyViewProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"members" | "board">("members");

  return (
    <div className="flex flex-1 flex-col px-4 pb-8 pt-4">
      <div className="grid grid-cols-2 rounded-2xl bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab("members")}
          className={`h-10 rounded-xl text-sm font-medium ${
            tab === "members" ? "bg-surface-elevated text-foreground" : "text-muted"
          }`}
        >
          Members
        </button>
        <button
          type="button"
          onClick={() => setTab("board")}
          className={`h-10 rounded-xl text-sm font-medium ${
            tab === "board" ? "bg-surface-elevated text-foreground" : "text-muted"
          }`}
        >
          Leaderboard
        </button>
      </div>

      {tab === "members" ? (
        <Card className="mt-4" eyebrow="Live room" title="Group">
          <ul className="space-y-3">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted">{member.role}</p>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    member.online ? "bg-accent" : "bg-border"
                  }`}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="mt-4" eyebrow="This round" title="Standings">
          <ol className="space-y-3">
            {standings.map((row) => (
              <li key={row.id} className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {row.rank}. {row.name}
                </span>
                <span className="font-mono text-sm text-accent">{row.score}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="mt-auto pt-6">
        <Button onClick={() => setOpen(true)}>Invite players</Button>
      </div>

      <Modal open={open} title="Invite to room" onClose={() => setOpen(false)}>
        Share this placeholder code with your group. Hook it to Supabase presence
        when you are ready.
        <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-center font-mono text-lg tracking-[0.18em] text-foreground">
          7K2M
        </p>
      </Modal>
    </div>
  );
}
