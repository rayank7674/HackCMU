"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** Hide the default title row when children render their own header. */
  hideTitle?: boolean;
  panelClassName?: string;
};

export function Modal({
  open,
  title,
  children,
  onClose,
  hideTitle = false,
  panelClassName,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideTitle ? undefined : "modal-title"}
        aria-label={hideTitle ? title : undefined}
        className={[
          "relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl",
          panelClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        {hideTitle ? null : (
          <h2 id="modal-title" className="text-lg font-semibold text-foreground">
            {title}
          </h2>
        )}
        <div
          className={
            hideTitle ? "text-sm leading-relaxed text-foreground" : "mt-3 text-sm leading-relaxed text-muted"
          }
        >
          {children}
        </div>
        <div className="mt-6">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
