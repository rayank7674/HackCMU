"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { ChoiceGroup, Field, MultiChoiceGroup, TriState } from "@/components/stormready/choice-field";
import { LoadingCard, QueryState } from "@/components/stormready/query-state";
import { fetchGeocode, type ResourceStatus } from "@/lib/stormready-api";
import {
  BACKUP_POWER_OPTIONS,
  BUDGET_OPTIONS,
  CONSTRUCTION_OPTIONS,
  DWELLING_OPTIONS,
  inputClassName,
} from "@/lib/stormready-format";
import { useOnboardingStep } from "@/lib/onboarding-progress";
import {
  UNKNOWN,
  createEmptyHomeProfile,
  createEmptyHouseholdProfile,
  isKnown,
  type BudgetClass,
  type HomeProfile,
  type HouseholdProfile,
  type MobilityAid,
  type Unknownable,
} from "@/lib/stormready";
import { useProfile } from "@/lib/use-profile";

const STEPS = [
  "Location",
  "Housing",
  "Home",
  "Assets",
  "Household",
  "Budget",
] as const;

const FALLBACK_HOME = createEmptyHomeProfile();
const FALLBACK_HOUSEHOLD = createEmptyHouseholdProfile();

export function OnboardingFlow() {
  const router = useRouter();
  const { profile, hydrated, updateHome, updateHousehold } = useProfile();
  const { step, goTo, clear } = useOnboardingStep();
  const [busy, setBusy] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<ResourceStatus>("idle");
  const [homeDraft, setHomeDraft] = useState<HomeProfile | null>(null);
  const [householdDraft, setHouseholdDraft] = useState<HouseholdProfile | null>(
    null,
  );
  const home = homeDraft ?? profile.home ?? FALLBACK_HOME;
  const household = householdDraft ?? profile.household ?? FALLBACK_HOUSEHOLD;

  const persistHome = (next: HomeProfile) => {
    setHomeDraft(next);
    updateHome(next);
  };

  const persistHousehold = (next: HouseholdProfile) => {
    setHouseholdDraft(next);
    updateHousehold(next);
  };

  const finish = () => {
    persistHome(home);
    persistHousehold(household);
    clear();
    router.push("/plan");
  };

  const canContinueLocation =
    (isKnown(home.addressLine) && home.addressLine.trim() !== "") ||
    (isKnown(home.postalCode) && home.postalCode.trim() !== "");

  const onContinueLocation = async () => {
    if (!canContinueLocation) return;
    if (geocodeStatus === "error" || geocodeStatus === "unavailable") {
      persistHome(home);
      goTo(1);
      return;
    }
    persistHome(home);
    setBusy(true);
    setGeocodeStatus("loading");
    const result = await fetchGeocode({
      addressLine: isKnown(home.addressLine) ? home.addressLine : undefined,
      postalCode: isKnown(home.postalCode) ? home.postalCode : undefined,
      city: isKnown(home.city) ? home.city : undefined,
      state: isKnown(home.state) ? home.state : undefined,
    });
    if (result.ok) {
      persistHome({
        ...home,
        city: isKnown(home.city) ? home.city : result.data.city,
        state: isKnown(home.state) ? home.state : result.data.state,
        postalCode: isKnown(home.postalCode)
          ? home.postalCode
          : result.data.postalCode,
        location: result.data.location,
      });
      setGeocodeStatus("ready");
      setBusy(false);
      goTo(1);
      return;
    }
    setGeocodeStatus(result.reason);
    setBusy(false);
  };

  const budget = household.budgetClass;

  if (!hydrated) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Set up your home" backHref="/" />
        <div className="px-5 py-8">
          <LoadingCard
            title="Set up your home"
            label="Loading your saved answers…"
            lines={2}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Set up your home" backHref="/" />
      <div className="flex flex-1 flex-col px-5 pb-8 pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
          Step {step + 1} of {STEPS.length}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-accent-strong transition-[width]"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          {STEPS[step]}
        </h2>

        <div className="mt-4 flex flex-1 flex-col gap-5">
          {step === 0 ? (
            <LocationStep
              home={home}
              geocodeStatus={geocodeStatus}
              onChange={(next) => {
                setHomeDraft(next);
                if (geocodeStatus !== "idle" && geocodeStatus !== "loading") {
                  setGeocodeStatus("idle");
                }
              }}
            />
          ) : null}
          {step === 1 ? (
            <HousingStep home={home} onChange={setHomeDraft} />
          ) : null}
          {step === 2 ? (
            <CharacteristicsStep home={home} onChange={setHomeDraft} />
          ) : null}
          {step === 3 ? (
            <AssetsStep
              home={home}
              household={household}
              onHomeChange={setHomeDraft}
              onHouseholdChange={setHouseholdDraft}
            />
          ) : null}
          {step === 4 ? (
            <ConstraintsStep household={household} onChange={setHouseholdDraft} />
          ) : null}
          {step === 5 ? (
            <BudgetStep
              value={budget}
              onChange={(next) =>
                setHouseholdDraft({
                  ...household,
                  budgetClass: next,
                })
              }
            />
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-2">
          {step === 0 ? (
            <Button onClick={onContinueLocation} disabled={!canContinueLocation || busy}>
              {busy
                ? "Checking location…"
                : geocodeStatus === "error" || geocodeStatus === "unavailable"
                  ? "Continue without lookup"
                  : "Continue"}
            </Button>
          ) : step === STEPS.length - 1 ? (
            <Button
              onClick={() => {
                persistHome(home);
                persistHousehold(household);
                finish();
              }}
            >
              See my plan
            </Button>
          ) : (
            <Button
              onClick={() => {
                persistHome(home);
                persistHousehold(household);
                goTo(step + 1);
              }}
            >
              Continue
            </Button>
          )}
          {step > 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                persistHome(home);
                persistHousehold(household);
                if (step === STEPS.length - 1) {
                  finish();
                  return;
                }
                goTo(step + 1);
              }}
            >
              Skip for now
            </Button>
          ) : (
            <p className="text-center text-xs text-muted">
              Enter an address or ZIP. You can add more detail later.
            </p>
          )}
          {step > 0 ? (
            <Button variant="ghost" onClick={() => goTo(step - 1)}>
              Back
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function LocationStep({
  home,
  geocodeStatus,
  onChange,
}: {
  home: HomeProfile;
  geocodeStatus: ResourceStatus;
  onChange: (home: HomeProfile) => void;
}) {
  return (
    <>
      <p className="text-sm leading-relaxed text-muted">
        We use this to look up official alerts for your area. Nothing is sent to
        an account.
      </p>
      <Field label="Street address" hint="Optional if you enter a ZIP code.">
        <input
          className={inputClassName}
          value={knownInput(home.addressLine)}
          onChange={(event) =>
            onChange({
              ...home,
              addressLine: emptyToUnknown(event.target.value),
              addressProvenance: "user_reported",
            })
          }
          autoComplete="street-address"
          placeholder="123 Main St"
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="City">
          <input
            className={inputClassName}
            value={knownInput(home.city)}
            onChange={(event) =>
              onChange({ ...home, city: emptyToUnknown(event.target.value) })
            }
            autoComplete="address-level2"
            placeholder="City"
          />
        </Field>
        <Field label="State">
          <input
            className={inputClassName}
            value={knownInput(home.state)}
            onChange={(event) =>
              onChange({ ...home, state: emptyToUnknown(event.target.value) })
            }
            autoComplete="address-level1"
            placeholder="FL"
          />
        </Field>
        <Field label="ZIP">
          <input
            className={inputClassName}
            value={knownInput(home.postalCode)}
            onChange={(event) =>
              onChange({
                ...home,
                postalCode: emptyToUnknown(event.target.value),
              })
            }
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="33602"
          />
        </Field>
      </div>
      <QueryState
        status={geocodeStatus}
        title="Location lookup"
        loadingLabel="Checking this address…"
        errorMessage="Location lookup failed. Your address is saved as you entered it. StormReady will not invent coordinates."
        unavailableMessage="Location lookup is not connected yet. Your address is saved as you entered it. StormReady will not invent coordinates."
      />
    </>
  );
}

function HousingStep({
  home,
  onChange,
}: {
  home: HomeProfile;
  onChange: (home: HomeProfile) => void;
}) {
  return (
    <ChoiceGroup
      legend="What kind of home are you planning for?"
      value={isKnown(home.dwellingType) ? home.dwellingType : "unknown"}
      options={DWELLING_OPTIONS}
      onChange={(dwellingType) =>
        onChange({
          ...home,
          dwellingType,
          attributesProvenance: "user_reported",
        })
      }
    />
  );
}

function CharacteristicsStep({
  home,
  onChange,
}: {
  home: HomeProfile;
  onChange: (home: HomeProfile) => void;
}) {
  return (
    <>
      <ChoiceGroup
        legend="Stories"
        value={
          isKnown(home.stories)
            ? home.stories >= 3
              ? "3"
              : String(home.stories)
            : "unknown"
        }
        options={[
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3+" },
        ]}
        onChange={(value) =>
          onChange({
            ...home,
            stories: Number(value),
            attributesProvenance: "user_reported",
          })
        }
      />
      <Field label="Year built" hint="Approximate is fine.">
        <input
          className={inputClassName}
          value={isKnown(home.yearBuilt) ? String(home.yearBuilt) : ""}
          onChange={(event) =>
            onChange({
              ...home,
              yearBuilt: parseOptionalNumber(event.target.value),
              attributesProvenance: "user_reported",
            })
          }
          inputMode="numeric"
          placeholder="1998"
        />
      </Field>
      <Field
        label="Roof age (years)"
        hint="Unknown is not treated as a new roof."
      >
        <input
          className={inputClassName}
          value={isKnown(home.roofAgeYears) ? String(home.roofAgeYears) : ""}
          onChange={(event) =>
            onChange({
              ...home,
              roofAgeYears: parseOptionalNumber(event.target.value),
              attributesProvenance: "user_reported",
            })
          }
          inputMode="numeric"
          placeholder="12"
        />
      </Field>
      <ChoiceGroup
        legend="Construction"
        value={isKnown(home.construction) ? home.construction : "unknown"}
        options={CONSTRUCTION_OPTIONS}
        onChange={(construction) =>
          onChange({
            ...home,
            construction,
            attributesProvenance: "user_reported",
          })
        }
      />
      <TriState
        legend="Basement"
        value={home.hasBasement}
        onChange={(hasBasement) =>
          onChange({
            ...home,
            hasBasement,
            attributesProvenance: "user_reported",
          })
        }
      />
      <TriState
        legend="Interior room you could shelter in"
        value={home.hasSafeInteriorRoom}
        onChange={(hasSafeInteriorRoom) =>
          onChange({
            ...home,
            hasSafeInteriorRoom,
            attributesProvenance: "user_reported",
          })
        }
      />
    </>
  );
}

function AssetsStep({
  home,
  household,
  onHomeChange,
  onHouseholdChange,
}: {
  home: HomeProfile;
  household: HouseholdProfile;
  onHomeChange: (home: HomeProfile) => void;
  onHouseholdChange: (household: HouseholdProfile) => void;
}) {
  return (
    <>
      <TriState
        legend="Backup power"
        value={home.hasBackupPower}
        onChange={(hasBackupPower) =>
          onHomeChange({
            ...home,
            hasBackupPower,
            backupPowerType:
              hasBackupPower === true ? home.backupPowerType : UNKNOWN,
            attributesProvenance: "user_reported",
          })
        }
      />
      {home.hasBackupPower === true ? (
        <ChoiceGroup
          legend="What kind?"
          value={isKnown(home.backupPowerType) ? home.backupPowerType : "unknown"}
          options={BACKUP_POWER_OPTIONS}
          onChange={(backupPowerType) =>
            onHomeChange({
              ...home,
              backupPowerType,
              attributesProvenance: "user_reported",
            })
          }
        />
      ) : null}
      <TriState
        legend="Hurricane shutters or impact glass"
        value={home.hasHurricaneShutters}
        onChange={(hasHurricaneShutters) =>
          onHomeChange({
            ...home,
            hasHurricaneShutters,
            attributesProvenance: "user_reported",
          })
        }
      />
      <TriState
        legend="Well water"
        value={home.hasWellWater}
        onChange={(hasWellWater) =>
          onHomeChange({
            ...home,
            hasWellWater,
            attributesProvenance: "user_reported",
          })
        }
      />
      <TriState
        legend="Septic system"
        value={home.hasSeptic}
        onChange={(hasSeptic) =>
          onHomeChange({
            ...home,
            hasSeptic,
            attributesProvenance: "user_reported",
          })
        }
      />
      <ChoiceGroup
        legend="Vehicles you could use"
        value={
          isKnown(household.vehicleCount)
            ? household.vehicleCount >= 3
              ? "3"
              : String(household.vehicleCount)
            : "unknown"
        }
        options={[
          { value: "0", label: "0" },
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3+" },
        ]}
        onChange={(value) =>
          onHouseholdChange({
            ...household,
            vehicleCount: Number(value),
          })
        }
      />
    </>
  );
}

function ConstraintsStep({
  household,
  onChange,
}: {
  household: HouseholdProfile;
  onChange: (household: HouseholdProfile) => void;
}) {
  return (
    <>
      <Field label="People in the home">
        <input
          className={inputClassName}
          value={
            isKnown(household.occupantCount) ? String(household.occupantCount) : ""
          }
          onChange={(event) =>
            onChange({
              ...household,
              occupantCount: parseOptionalNumber(event.target.value),
            })
          }
          inputMode="numeric"
          placeholder="3"
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <CountField
          label="Infants"
          value={household.infantsCount}
          onChange={(infantsCount) => onChange({ ...household, infantsCount })}
        />
        <CountField
          label="Children"
          value={household.childrenCount}
          onChange={(childrenCount) => onChange({ ...household, childrenCount })}
        />
        <CountField
          label="Seniors"
          value={household.seniorsCount}
          onChange={(seniorsCount) => onChange({ ...household, seniorsCount })}
        />
      </div>
      <TriState
        legend="Pregnancy in the household"
        value={household.hasPregnancy}
        onChange={(hasPregnancy) => onChange({ ...household, hasPregnancy })}
      />
      <TriState
        legend="Mobility needs"
        hint="Wheelchair, crutches, walker, or help with stairs and transfers."
        value={household.hasMobilityNeeds}
        onChange={(hasMobilityNeeds) =>
          onChange({
            ...household,
            hasMobilityNeeds,
            mobilityAids:
              hasMobilityNeeds === true
                ? Array.isArray(household.mobilityAids)
                  ? household.mobilityAids
                  : []
                : UNKNOWN,
          })
        }
      />
      {household.hasMobilityNeeds === true ? (
        <MultiChoiceGroup
          legend="What applies to this household?"
          hint="Pick all that apply. These change exit and transport steps."
          values={Array.isArray(household.mobilityAids) ? household.mobilityAids : []}
          options={MOBILITY_AID_OPTIONS}
          onChange={(mobilityAids) => onChange({ ...household, mobilityAids })}
        />
      ) : null}
      <TriState
        legend="Power-dependent medical device"
        value={household.hasPowerDependentMedicalDevice}
        onChange={(hasPowerDependentMedicalDevice) =>
          onChange({ ...household, hasPowerDependentMedicalDevice })
        }
      />
      <TriState
        legend="Prescription medications to keep on hand"
        value={household.hasPrescriptionMedications}
        onChange={(hasPrescriptionMedications) =>
          onChange({ ...household, hasPrescriptionMedications })
        }
      />
      <TriState
        legend="Could you leave on your own if asked to evacuate?"
        value={household.canSelfEvacuate}
        onChange={(canSelfEvacuate) =>
          onChange({ ...household, canSelfEvacuate })
        }
      />
      <Field label="Pets" hint="Leave blank if you would rather skip.">
        <input
          className={inputClassName}
          value={isKnown(household.petCount) ? String(household.petCount) : ""}
          onChange={(event) =>
            onChange({
              ...household,
              petCount: parseOptionalNumber(event.target.value),
            })
          }
          inputMode="numeric"
          placeholder="0"
        />
      </Field>
    </>
  );
}

function BudgetStep({
  value,
  onChange,
}: {
  value: Unknownable<BudgetClass>;
  onChange: (value: Unknownable<BudgetClass>) => void;
}) {
  return (
    <ChoiceGroup
      legend="What can you spend right now if you need supplies?"
      hint="This only steers low-cost suggestions. It is stored on this device."
      value={isKnown(value) ? value : "unknown"}
      options={BUDGET_OPTIONS}
      onChange={onChange}
    />
  );
}

const MOBILITY_AID_OPTIONS: { value: MobilityAid; label: string }[] = [
  { value: "wheelchair", label: "Wheelchair" },
  { value: "crutches_or_walker", label: "Crutches or walker" },
  { value: "transfer_help", label: "Needs help transferring" },
  { value: "elevator", label: "Depends on an elevator" },
];

function CountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Unknownable<number>;
  onChange: (value: Unknownable<number>) => void;
}) {
  return (
    <Field label={label}>
      <input
        className={inputClassName}
        value={isKnown(value) ? String(value) : ""}
        onChange={(event) => onChange(parseOptionalNumber(event.target.value))}
        inputMode="numeric"
        placeholder="0"
      />
    </Field>
  );
}

function knownInput(value: Unknownable<string>): string {
  return isKnown(value) ? value : "";
}

function emptyToUnknown(value: string): Unknownable<string> {
  return value.trim() === "" ? UNKNOWN : value;
}

function parseOptionalNumber(value: string): Unknownable<number> {
  const trimmed = value.trim();
  if (trimmed === "") return UNKNOWN;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : UNKNOWN;
}
