"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/stormready/query-state";
import { UnavailableNote } from "@/components/stormready/unavailable-note";

type ReadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "playing" }
  | { status: "unavailable"; message: string };

export function ReadPlan({
  text,
  kind = "plan",
}: {
  /** Already-approved plan or stress summary. Never model-improvised copy. */
  text: string;
  kind?: "plan" | "stress";
}) {
  const [state, setState] = useState<ReadState>({ status: "idle" });
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function onRead() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, kind }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("audio")) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body &&
          typeof body === "object" &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : "Read My Plan is unavailable. FaultLine will not invent audio.";
        setState({ status: "unavailable", message });
        return;
      }
      const blob = await response.blob();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      setState({ status: "playing" });
      audio.onended = () => setState({ status: "idle" });
      audio.onerror = () =>
        setState({
          status: "unavailable",
          message: "Audio playback failed. FaultLine will not invent narration.",
        });
      await audio.play();
    } catch {
      setState({
        status: "unavailable",
        message:
          "Read My Plan could not be reached. FaultLine will not invent audio.",
      });
    }
  }

  const title = kind === "stress" ? "Read stress summary" : "Read my plan";

  return (
    <Card eyebrow="Voice" title={title}>
      <p className="mb-3">
        Speaks the already-approved text only. It does not generate a new plan.
      </p>
      <Button
        variant="secondary"
        onClick={() => void onRead()}
        disabled={state.status === "loading" || !text.trim()}
      >
        {state.status === "loading"
          ? "Preparing audio…"
          : state.status === "playing"
            ? "Playing…"
            : title}
      </Button>
      {state.status === "loading" ? (
        <div className="mt-3">
          <Spinner label="Requesting approved-text audio" />
        </div>
      ) : null}
      {state.status === "unavailable" ? (
        <div className="mt-3">
          <UnavailableNote title="Voice unavailable">
            {state.message}
          </UnavailableNote>
        </div>
      ) : null}
    </Card>
  );
}
