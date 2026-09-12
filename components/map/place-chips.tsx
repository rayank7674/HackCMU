import {
  HOURS_OUTLOOK_FILL,
  HOURS_OUTLOOK_LABEL,
  HOURS_OUTLOOK_LETTER,
  type HoursOutlook,
} from "@/lib/map/google-hours";
import {
  MAP_PLACE_KIND_LABEL,
  MAP_PLACE_KIND_LETTER,
  PLACE_OFFERS,
  type MapPlaceKind,
} from "@/lib/map/places";

export function PlaceTypeChip({ kind }: { kind: MapPlaceKind }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
      <span
        aria-hidden
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: "#64748b" }}
      >
        {MAP_PLACE_KIND_LETTER[kind]}
      </span>
      {MAP_PLACE_KIND_LABEL[kind]}
    </span>
  );
}

export function PlaceHoursChip({ outlook }: { outlook: HoursOutlook }) {
  const fill = HOURS_OUTLOOK_FILL[outlook];
  const letter = HOURS_OUTLOOK_LETTER[outlook];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
      style={{ backgroundColor: fill, color: letter }}
    >
      {HOURS_OUTLOOK_LABEL[outlook]}
    </span>
  );
}

export function PlaceOffers({ kind }: { kind: MapPlaceKind }) {
  const offers = PLACE_OFFERS[kind];
  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        What you can get
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{offers.headline}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
        {offers.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
