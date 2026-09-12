import { isRecord, readString } from "@/lib/integrations/http";
import { k2Complete } from "@/lib/integrations/k2";
import { documentById, loadPreparednessDocuments } from "./documents";
import { getK2Env } from "./env";
import { isDisallowedInferredFact } from "./grounding";
import { K2_SYSTEM_PROMPT, k2UserPrompt, parseModelJson } from "./prompts";
import { INSPECT_DISCLAIMER, type InferredFact, type InspectResult } from "./types";
import { aiUnavailable } from "./unavailable";

function factsFromModel(text: string): InferredFact[] {
  const parsed = parseModelJson(text);
  const rawFacts = parsed && Array.isArray(parsed.facts) ? parsed.facts : [];
  const facts: InferredFact[] = [];

  for (const [index, item] of rawFacts.entries()) {
    if (!isRecord(item)) continue;
    const claim = readString(item.claim);
    const sourceDocId = readString(item.sourceDocId);
    if (!claim || !sourceDocId) continue;
    if (isDisallowedInferredFact(claim)) continue;
    const doc = documentById(sourceDocId);
    if (!doc) continue;
    facts.push({
      id: readString(item.id) ?? `${sourceDocId}-${index}`,
      claim,
      sourceDocId,
      source: doc.source,
      sourceUrl: doc.sourceUrl,
      topic: readString(item.topic) ?? doc.title,
      provenance: "ai_inferred",
      official: false,
      modeled: true,
      forecast: false,
    });
  }

  return facts;
}

export async function inspectPreparednessDocuments(): Promise<InspectResult> {
  if (!getK2Env()) {
    return aiUnavailable(
      "k2",
      "k2_not_configured",
      "K2_API_KEY, K2_API_BASE_URL, and K2_MODEL must all be set. FaultLine will not invent a K2 host or inferred facts.",
    );
  }

  const documents = loadPreparednessDocuments();
  const completion = await k2Complete([
    { role: "system", content: K2_SYSTEM_PROMPT },
    {
      role: "user",
      content: k2UserPrompt(
        documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          source: doc.source,
          sourceUrl: doc.sourceUrl,
          excerpt: doc.excerpt,
        })),
      ),
    },
  ]);

  if (!completion.ok) return completion;

  return {
    ok: true,
    status: "ok",
    service: "k2",
    facts: factsFromModel(completion.text),
    documentIds: documents.map((doc) => doc.id),
    inventedPolicy: false,
    disclaimer: INSPECT_DISCLAIMER,
  };
}
