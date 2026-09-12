# StormReady MVP — Cursor Plan Specification

# PROJECT CONTEXT FOR THE CODING AGENT

You are joining a project at a hackathon after an earlier product idea was abandoned.

The old repository was designed around rooms/groups. **That previous product idea is no longer being pursued.**

The new product is **StormReady**, an all-hazards household disaster-preparedness planner.

This is not a generic weather app, generic chatbot, social/room app, or engineering-grade disaster simulator.

The first product state is intentionally between:
- a polished personalized preparedness planner, and
- the foundation for a future advanced resilience/stress-testing system.

The immediate MVP should prioritize the attached reference's product experience:
**home profile → current conditions → personalized actions → help/resources**, while implementing the architecture cleanly enough that advanced scenarios and simulations can be added later.

## Product vision in one paragraph

StormReady takes a household's location, current official hazard information, home characteristics, household constraints, and preparation budget and converts them into a short, prioritized, explainable action plan. It should reduce information overload and help a household decide what matters most now, what should happen before the next event, what belongs in long-term preparation, and where to find legitimate local or government help.

## Product philosophy

The app should feel:
- calm,
- trustworthy,
- highly personalized,
- action-oriented,
- transparent about uncertainty,
- grounded in authoritative sources.

It should NOT feel:
- alarmist,
- like an AI fortune teller,
- like a government replacement,
- like an engineering inspection,
- like a social app,
- like a room/group collaboration product.

## Important distinction about the future "Faultline" concept

The longer-term product direction may eventually include more advanced scenario simulation/stress testing inspired by the Faultline concept. That is **future architecture only** for this MVP.

Do not implement full Faultline-style cascading infrastructure simulation now.

However, keep the following code boundaries clean so future work can add them:
- `hazards`
- `recommendations`
- `household/home profile`
- `resources`
- `scenarios` as an optional future concept
- external-data adapters
- deterministic decision/rules engine

The current user experience should remain StormReady.


## Role

You are the lead implementation engineer for StormReady. Build the first production-quality hackathon MVP described below.

Do not overbuild. Optimize for:
1. A polished, trustworthy user experience.
2. A working end-to-end recommendation flow.
3. Real official hazard data where practical.
4. Deterministic, auditable recommendations.
5. Clear provenance and safety boundaries.
6. An architecture that can later expand into more advanced prediction/simulation.

The current target is the middle ground between a simple preparedness checklist and the full long-term vision. The MVP should feel like a real product, not a prototype full of disconnected sponsor demos.

---


# 0. IMPORTANT: Existing repository migration

## This repository contains an old project direction

The existing codebase was previously intended for an application where users could create or join **rooms/groups** and interact inside those spaces.

That is the OLD product direction.

**Do not preserve the old room/group product architecture as the conceptual foundation of this project.**

We are pivoting the repository to **StormReady**, a personalized household disaster-preparedness application.

Before implementing new functionality:

1. Inspect the entire repository and identify the existing room/group-related routes, pages, database tables, components, hooks, types, API routes, and navigation.
2. Reuse low-level infrastructure only when it is genuinely useful:
   - existing Next.js configuration,
   - Tailwind configuration,
   - authentication setup,
   - database connection utilities,
   - generic UI primitives,
   - useful API/client utilities.
3. Treat room/group-specific product logic as obsolete unless it can be cleanly repurposed without creating conceptual debt.
4. Remove, replace, or isolate old room/group UI so that a new user never encounters:
   - “Create Room”
   - “Join Room”
   - “Groups”
   - room codes
   - group membership dashboards
   - chat/group-management flows
   - previous social/multiplayer navigation
   unless a piece is independently useful to StormReady.
5. Do not build the new StormReady experience on top of the old room/group data model merely because it already exists.
6. Prefer a clean StormReady domain model over adapting obsolete entities.
7. If old room/group code is extensive, keep it temporarily isolated or remove it incrementally rather than spending large amounts of time rewriting unrelated infrastructure.
8. Do not spend hackathon time building a perfect cleanup/refactor. The priority is the new product.

## Product pivot acceptance test

When the app is opened, the product should immediately communicate:

> **StormReady — Your home. Your risk. Your plan.**

A new user should be able to go from:

```text
Welcome
→ Tell us about your home
→ Current conditions
→ Personalized plan
→ Help / resources
```

without ever encountering the old room/group concept.

If the repository contains old routes such as `/rooms`, `/groups`, `/dashboard`, or similar, decide whether to:
- repurpose them for StormReady,
- redirect them,
- or remove them,

based on the least-risk path to a coherent MVP.

The final application should feel as though StormReady is the intended product, not a room/group application with StormReady features attached.

# 1. Product definition

## Product name

**StormReady**

Suggested tagline:

**Your home. Your risk. Your plan.**

## Core promise

StormReady helps a household turn current hazard information into a personalized, budget-aware preparation plan based on:
- location,
- current hazard/official alerts,
- home characteristics,
- household constraints,
- available budget,
- and relevant local/official resources.

## Core user question

The product should answer:

> **What matters most for my household right now, what should I do first, and where can I get legitimate help?**

Do not position the MVP as:
- an engineering inspection,
- a structural safety certification,
- a damage predictor,
- an evacuation authority,
- an insurance/claims system,
- an automatic government-benefit eligibility engine,
- or a contractor endorsement platform.

Official guidance always takes precedence over StormReady recommendations.

---

# 2. MVP product flow

Build this as the primary end-to-end experience:

```text
Landing / Welcome
    ↓
Home + Household Profile
    ↓
Geocode Location
    ↓
Retrieve Current Official Hazard / Weather Information
    ↓
Normalize Hazard State
    ↓
Deterministic Recommendation Engine
    ↓
Budget + Priority Ranking
    ↓
Personalized Plan
    ↓
Relevant Local Help + Official Resources
```

The experience should be fast enough for a user to complete the initial profile in under three minutes.

---

# 3. Main screens

## Screen 1 — Welcome / Home

Purpose:
- communicate the product clearly,
- establish trust,
- start the profile.

Content:
- StormReady logo/name
- concise explanation
- primary CTA: `Get Started`
- secondary CTA: `Log In`
- reassurance that recommendations are based on official information and the user's own inputs.

Do not overwhelm this screen with technical details.

---

## Screen 2 — Tell Us About Your Home

Use a clean multi-step form/progress indicator.

Collect:

### Location
- Address or ZIP code

### Housing
- Single-family home
- Apartment / condo
- Manufactured / mobile home
- Other

### Home characteristics
- Approximate year built
- Number of stories
- Foundation type, if known
- Roof type
- Approximate roof age, if known
- Window / door protection, if known
- Garage
- Basement

### Existing preparedness assets
- Generator
- Battery backup
- Storm shutters / window protection
- Emergency supplies
- Other relevant protections

### Household constraints
- Transportation access
- Pets
- Accessibility / mobility considerations
- Essential household needs

### Budget
- Immediate preparation budget

Important:
- Unknown values remain `unknown`.
- Never silently interpret unknown as “no”.
- Clearly distinguish user-reported information from externally sourced information.

---

# 4. Location and hazard system

## Geocoding

Convert the address to:
- latitude,
- longitude,
- normalized address,
- jurisdiction information where available.

Store provenance for the location data.

## Official hazard data

For the U.S. MVP, use the National Weather Service APIs as the primary live source.

Retrieve:
- active alerts,
- watches/warnings/advisories,
- current weather,
- forecast data relevant to the location.

Store:
- hazard type,
- severity,
- event/title,
- affected area,
- issue time,
- expiration time,
- source,
- raw/source URL when practical.

### Critical trust rule

Never paraphrase an official warning in a way that changes its meaning.

The UI must clearly show:
- source,
- last updated,
- official alert status.

If the source is unavailable:
- show that it is unavailable,
- do not fabricate a current condition.

---

# 5. Hazard model

Implement a normalized internal schema that supports multiple hazards.

Initial supported hazards:

### Primary
- Hurricane / severe wind

### Secondary
- Wildfire
- Winter storm

### Later-ready architecture
- Flood
- Tornado
- Earthquake
- Extreme heat

The system should not be hard-coded around hurricanes even though the primary demo is hurricane-focused.

Use a common hazard → exposure → vulnerability → action framework.

Example normalized hazard object:

```ts
type HazardState = {
  type: "hurricane" | "wildfire" | "winter_storm" | "flood" | "tornado" | "earthquake" | "extreme_heat";
  severity: "low" | "moderate" | "high" | "extreme";
  active: boolean;
  officialAlert?: {
    headline: string;
    level: string;
    issuedAt: string;
    expiresAt?: string;
    source: string;
    url?: string;
  };
  location: {
    lat: number;
    lon: number;
  };
};
```

---

# 6. Recommendation engine — core technical heart

## Critical design rule

Use a deterministic rules / knowledge engine for safety-critical recommendations.

Use LLMs only for:
- explanation,
- summarization,
- conversational refinement,
- natural-language presentation.

Do NOT allow an LLM to decide safety policy directly.

## Recommendation schema

Every generated recommendation should have:

```ts
type Recommendation = {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  timeHorizon: "now" | "before_next_event" | "long_term";
  trigger: string[];
  reason: string;
  source: string;
  confidence: "high" | "medium" | "low";
  estimatedCostClass?: "free" | "low" | "medium" | "high";
};
```

## Priority hierarchy

Use this conceptual hierarchy:

1. Official evacuation order / instruction
2. Official hazard warning
3. Official local emergency-management guidance
4. StormReady personalized preparation recommendations
5. General educational / long-term mitigation suggestions

An official evacuation instruction always overrides discretionary preparation suggestions.

---

# 7. Initial deterministic rules

Implement at least 20–30 testable rules across the initial three hazard families.

Important baseline rules:

### Hurricane / severe wind
- If an official evacuation order applies → evacuation/instruction is the top priority.
- If manufactured/mobile home + high-wind threat → prioritize official evacuation/shelter guidance; do not imply that last-minute structural work makes the home safe.
- If high-wind threat + older user-reported roof → recommend professional roof assessment as preparation/mitigation, not as a prediction of failure.
- If high-wind threat + unprotected windows → recommend appropriate window/door protection or official preparedness guidance.
- If high-wind threat + loose outdoor items → secure them when it is safe.
- If household has no backup power and power disruption is plausible → prioritize charging / backup-power readiness.
- If transportation is limited → elevate evacuation transportation readiness.

### Flood
- If elevated flood exposure + basement → prioritize flood preparation and protecting important items/equipment.
- If flood exposure + critical equipment on low levels → recommend moving/protecting items when safe.
- If flood conditions + no transportation → prioritize local official shelter/transportation guidance.

### Wildfire
- If evacuation warning/order applies → evacuation dominates discretionary home projects.
- If wildfire threat + limited transportation → prioritize transportation readiness.
- If wildfire threat + pets → include pet evacuation preparedness.

### Winter storm
- If winter storm + outage risk → prioritize power/heating readiness.
- If winter storm + no backup power → elevate charging and communication preparedness.
- If vulnerable household constraints exist → prioritize relevant readiness actions.

### No hazard
- Do not invent urgency.
- Show routine preparedness / long-term mitigation actions instead.

---

# 8. Budget-aware planning

Budget should prioritize the order of actions. It must not falsely claim that a specific expenditure makes a home “safe”.

Use broad cost classes, not exact contractor estimates:

- `$0`
- `Low`
- `Medium`
- `High`

Examples:
- $0 → make a plan, secure loose objects, monitor official alerts
- Low → emergency/charging supplies
- Medium → professional inspection or basic protective work
- High → major retrofit / roof replacement

For the MVP, show approximate ranges only when defensible and label them as planning ranges.

The ranking logic should favor:
- high-priority,
- actionable,
- feasible-within-budget,
- low-cost/high-impact actions.

Do not implement fake precision.

---

# 9. Personalized Plan screen

This is the most important screen.

Show:

## Current Conditions & Risk
- Location
- current official hazard
- alert severity
- issue/updated timestamp
- official alert card when applicable
- compact map/visual when available

## Top Priority Actions

Show 3–5 actions only.

Each action should include:
- number / priority
- action title
- urgency
- short explanation
- time horizon
- cost class/range
- source or rule
- optional `Why?` interaction

Example:

```text
1  Evacuation / official instructions
   CRITICAL
   NOW

2  Protect windows
   HIGH
   NOW

3  Secure outdoor objects
   HIGH
   NOW

4  Prepare emergency supplies
   MEDIUM
   NOW
```

Do not bury users in 15–30 recommendations.

---

# 10. Time-horizon system

Every action must belong to one of:

## NOW
Actionable before/during the immediate threat.

Examples:
- follow official instructions
- prepare supplies
- secure loose objects when safe

## BEFORE NEXT EVENT
Requires more time or planning.

Examples:
- roof inspection
- tree maintenance
- window protection

## LONG TERM
Major resilience project.

Examples:
- roof replacement
- structural retrofit
- flood mitigation

This is a required product-quality control.

Do not recommend a major capital project as though it were a last-minute preparation action.

---

# 11. Local Help screen

Create a local resource experience inspired by the supplied reference image, but do not copy the UI exactly.

Sections:

## Local Help
Possible categories:
- roofing
- tree removal
- HVAC
- remediation
- emergency supplies
- other hazard-relevant services

For MVP:
- use a places API if practical,
- show distance,
- address,
- phone,
- hours,
- website/directions where available.

Important:
- discovery only,
- never label a contractor “trusted”, “best”, or “verified” unless independently verified,
- do not imply endorsement.

## Financial Assistance
Show official assistance resources and government programs when relevant.

Use wording such as:
- “You may be able to apply for…”
- “Check eligibility through the official program.”
- “Apply through the official site.”

Never guarantee:
- eligibility,
- approval,
- funding.

---

# 12. Government/official resource layer

Include cards for:
- relevant disaster-assistance programs,
- local emergency-management information,
- shelters or recovery centers where official data is available,
- official preparedness guidance.

Each critical resource should visibly indicate:
- source,
- last update,
- external official link.

---

# 13. LLM integration

## General principle

The structured rule engine produces the truth.

The LLM turns that structured result into understandable language.

Use Grok for:

### Natural-language profile intake
Example:
> “We live in an old one-story house, have no generator, and my mother has mobility issues.”

Convert into structured candidate fields, but validate before persisting.

### Explanation
Example:
> “Because your home is a single-story structure with an older roof and a high-wind warning is active, roof assessment appears as a preparedness action. This does not mean the roof will fail.”

### Conversational refinement
Allow:
> “What should I do first?”

and answer from the existing structured recommendation set.

Do not allow the LLM to silently create unsupported safety recommendations.

---

# 14. Voice

Implement voice as an enhancement, not a dependency.

## Grok Voice
Possible flow:
- user verbally describes household situation,
- transcript populates the same profile fields,
- user confirms before saving.

## ElevenLabs
Read the final top-priority plan aloud.

The voice output should use the already-approved structured recommendations.

Example:
> “Your top priority is to follow the official evacuation instruction. Next, prepare your emergency supplies and secure outdoor objects if it is safe.”

Provide a text fallback if voice is unavailable.

---

# 15. AI image / visual enhancement

Use Grok Imagine only as a non-critical visual enhancement.

Possible output:
- friendly personalized preparation card,
- simple hazard illustration,
- printable household action card.

Never let generated imagery imply:
- exact structural damage,
- engineering safety,
- official evacuation geography.

The visual should support comprehension, not act as evidence.

---

# 16. Authentication and user roles

Use Auth0.

Initial roles:

### Household User
- create/manage own profile
- view own plans
- view resources

### Admin / Resource Manager
- manage non-sensitive resource records
- inspect system state as allowed

### AI Agent
A scoped machine identity with limited permissions.

The AI agent must not be able to:
- override official alerts,
- change safety rules,
- approve consequential actions,
- access unnecessary sensitive user data.

Use least privilege.

---

# 17. Database

Keep the schema simple.

Preferred entities:

```text
User
HomeProfile
HouseholdProfile
HazardAlert
RecommendationRule
GeneratedRecommendation
Resource
AuditLog
```

Use provenance fields wherever relevant:

```ts
provenance: "user_reported" | "external_source" | "unknown"
```

Critical recommendations should retain:
- rule ID,
- source,
- generation timestamp.

Supabase/Postgres is sufficient for the MVP core relational data.

MongoDB can be added only where it provides meaningful geospatial/time-series value. Do not create unnecessary dual-database complexity.

---

# 18. Maps and geospatial layer

Do not build a custom GIS platform.

Use an existing map layer and keep it simple.

MVP map content:
- user's approximate location,
- hazard/alert area when available,
- relevant local resource markers,
- optional evacuation/shelter information if available.

Avoid:
- full custom geographic analysis,
- engineering-grade flood modeling,
- nationwide evacuation aggregation.

---

# 19. Mobile-first UI direction

The attached reference image should guide information hierarchy, not be copied literally.

Desired characteristics:
- polished blue/white emergency-preparedness aesthetic,
- clear cards,
- large readable actions,
- strong hierarchy,
- calm but urgent visual language,
- bottom navigation or similarly simple mobile navigation,
- minimal clutter.

Reference information architecture to adapt:
1. Welcome / location
2. Home profile
3. Current conditions
4. Personalized plan
5. Help
6. Financial assistance

Improve the flow where appropriate rather than reproducing it exactly.

Desktop should also work, but mobile-first is the priority.

---

# 20. Navigation

Suggested MVP navigation:

```text
Home
Plan
Map
Help
Profile
```

Avoid building too many screens.

The home screen should summarize:
- current alert,
- top action,
- plan status,
- last updated.

---

# 21. Data provenance and trust

Every safety-critical data item must make provenance visible.

Examples:

```text
Source: National Weather Service
Updated: 9:41 AM
```

or:

```text
Roof age
User reported
```

or:

```text
Roof age
Unknown
```

Never turn uncertainty into certainty.

Provide a subtle but clear:
> Official guidance takes priority.

---

# 22. Privacy

Collect the minimum necessary information.

Do not request:
- government IDs,
- financial account credentials,
- unnecessary sensitive information.

Do not store sensitive household details unless actually needed.

For the MVP:
- user profile data,
- location,
- home characteristics,
- household constraints,
- plan history.

---

# 23. Graceful degradation

Every external integration must fail safely.

Examples:

If NWS unavailable:
> “Current official alert data is temporarily unavailable.”

If geocoding fails:
> “We couldn't determine the location. Please verify the address.”

If LLM unavailable:
- deterministic recommendation engine still works.

If voice unavailable:
- text plan remains available.

If places search unavailable:
- show official/local resource links where possible.

Never fabricate live status.

---

# 24. Validation requirements

Do not consider the MVP complete because the interface looks good.

Create automated tests for at least 20–30 representative recommendation scenarios.

Required test cases include:

- no hazard → no false emergency recommendations
- official evacuation order → evacuation is top priority
- high wind + older roof → roof assessment appears without predicting failure
- manufactured home + high wind → evacuation/shelter guidance is elevated
- flood + basement → flood preparedness is elevated
- wildfire + evacuation → evacuation dominates
- winter storm + outage risk → power/heating readiness appears
- budget = $0 → zero-cost/high-impact actions dominate
- unknown roof age → no inference
- API failure → clear unavailable state, no fabricated data

Additional acceptance criteria:

- Changing hazard changes the plan predictably.
- Changing home type changes recommendations predictably.
- Changing household constraints changes recommendations predictably.
- Changing budget changes prioritization, not safety-critical facts.
- LLM text cannot override official alerts.
- Critical recommendations are traceable to a rule/source.
- No UI claims engineering-grade safety or exact damage prediction.

---

# 25. Sponsor/advanced integrations — only after core flow works

Do not let sponsor integrations block the primary user journey.

Priority order:

### Tier 1 — Core
- Next.js
- NWS
- geocoding
- deterministic rules
- Supabase
- Auth0
- polished plan UI

### Tier 2 — High-value
- Grok explanation
- Gemini document ingestion
- local resources / places search
- ElevenLabs audio

### Tier 3 — Demonstration enhancements
- Grok Voice
- Grok Imagine
- K2 long-context document reasoning
- MongoDB geospatial/time-series where useful
- Vultr compute service
- Solana demonstration transaction

If time runs short, Tier 1 must remain complete.

---

# 26. Architecture principles

Prefer a simple architecture.

```text
Next.js App Router
        |
        +---- API routes / server actions
        |
        +---- Supabase/Postgres
        |
        +---- External data adapters
        |       |
        |       +---- NWS
        |       +---- Geocoding
        |       +---- Places
        |
        +---- Recommendation engine
        |       |
        |       +---- deterministic rules
        |
        +---- LLM explanation layer
        |       |
        |       +---- Grok
        |       +---- Gemini / K2 as available
        |
        +---- Voice / media
        |       |
        |       +---- Grok Voice
        |       +---- ElevenLabs
        |
        +---- Optional advanced services
                |
                +---- MongoDB
                +---- Vultr
                +---- Solana
```

Avoid microservices unless a sponsor integration genuinely requires isolation.

Keep the recommendation engine independent of UI and LLM providers.

---

# 27. Suggested repository structure

```text
app/
  page.tsx
  onboarding/
  conditions/
  plan/
  help/
  profile/
  api/
    geocode/
    alerts/
    recommendations/
    resources/
    ai/
    voice/

components/
  home/
  onboarding/
  plan/
  conditions/
  help/
  shared/

lib/
  rules/
    index.ts
    hurricane.ts
    wildfire.ts
    winter-storm.ts
  hazards/
    normalize.ts
    types.ts
  recommendations/
    engine.ts
    ranking.ts
    budget.ts
  integrations/
    nws.ts
    geocoding.ts
    grok.ts
    gemini.ts
    elevenlabs.ts
    auth0.ts
    places.ts
    solana.ts
    vultr.ts
    mongodb.ts
  db/
    supabase.ts

data/
  rules/
  seed/

tests/
  rules/
  recommendations/
  api/
```

---

# 28. Implementation phases

## Phase 1 — Functional spine

Must achieve:

```text
Create profile
→ geocode
→ fetch hazard
→ run rules
→ show plan
```

Do not move on until this works end-to-end.

## Phase 2 — Product quality

Add:
- budget prioritization,
- time horizons,
- source explanations,
- better cards,
- loading/error states,
- persistence.

## Phase 3 — Help

Add:
- local services,
- official resources,
- assistance cards.

## Phase 4 — AI/voice

Add:
- Grok explanation,
- Grok conversational refinement,
- ElevenLabs readout,
- optional Grok Voice.

## Phase 5 — sponsor enhancements

Add only those that can be shown cleanly in the demo:
- Gemini,
- K2,
- MongoDB,
- Vultr,
- Solana,
- Imagine.

## Phase 6 — polish

- responsive/mobile-first UI,
- visual consistency,
- performance,
- accessibility,
- demo scenario,
- deployment,
- test pass.

---

# 29. Do not build in this MVP

Explicitly reject scope creep into:

- AI roof/house inspection from photos
- engineering-grade structural safety scores
- exact damage prediction
- exact repair-price estimates
- nationwide evacuation normalization
- nationwide hazard modeling
- automatic government-benefit eligibility
- insurance claims automation
- contractor quality/licensing guarantees
- custom GIS platform
- full disaster simulation engine
- sophisticated predictive ML
- emergency dispatch/control systems

These can be future roadmap items, not current implementation.

---

# 30. Future product direction

The architecture should allow the product to expand later into:

### Advanced resilience mode
- scenario simulation,
- household dependency graphs,
- “what if?” stress testing,
- community-level resilience analysis,
- budget-constrained preparedness optimization.

### Example future interaction
> “What if we lose power for 12 hours during a hurricane?”

Then simulate how the household/community is affected.

But this is NOT required for the first state of the product.

---

# 31. Definition of done

The MVP is successful when a judge can:

1. Open StormReady.
2. Enter a realistic home/household profile.
3. Get a real official hazard/alert result.
4. See a materially personalized plan.
5. Understand why the top 3–5 actions were recommended.
6. See budget-aware prioritization.
7. See the difference between NOW / BEFORE NEXT EVENT / LONG TERM.
8. Open a local help/official resource path.
9. See source + timestamp for safety-critical information.
10. Change one major input and visibly get a different plan.

The product should feel useful before any advanced AI/simulation layer is demonstrated.

---

# 32. Demo scenario

Use a controlled demo profile that highlights personalization.

Example:

```text
Location: Tampa, FL
Home: Older single-family home
Year built: 1975
Stories: 1
Roof: Asphalt shingles, older
Windows: Older / no known protection
Basement: No
Generator: No
Transportation: Limited
Budget: $500
```

Then retrieve a controlled storm/hazard scenario or use a prepared fallback dataset if live conditions are not appropriate.

Show:

```text
CURRENT CONDITIONS
↓
Official alert
↓
Top Priority
↓
3–5 personalized actions
↓
Why these actions?
↓
Budget plan
↓
Local help
```

Then change one property, such as:
- manufactured home,
- high-rise apartment,
- newer elevated masonry home,

and show that the action priorities change.

---

# 33. Development instructions for the coding agent

Before writing code:

1. Inspect the existing repository and determine what already exists.
2. Do not overwrite working code unnecessarily.
3. Produce a concise implementation plan and identify dependencies.
4. Identify which requirements require external API credentials.
5. Flag any ambiguity before making a major architectural choice.
6. Prefer the smallest implementation that satisfies the requirement.
7. Keep safety-critical logic deterministic.
8. Add tests alongside the recommendation rules.
9. Keep all external API clients behind small adapter modules.
10. Make the application runnable even when optional sponsor APIs are unavailable.

When a task can be solved with a simpler implementation, choose the simpler implementation.

---

# 34. Development priority rule

At all times prioritize:

```text
Correctness
> Safety / trust
> Core user value
> Demo clarity
> Sponsor depth
> Extra features
```

A beautiful feature that makes the core flow less reliable is not an improvement.

---

# Final product thesis

StormReady is not trying to tell someone whether their home will survive a disaster.

It is trying to answer a simpler and more actionable question:

> **Given what is happening, where I live, what my home is like, what my household needs, and what I can afford, what should I do next?**

That is the MVP.
