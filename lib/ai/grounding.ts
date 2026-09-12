const LIVE_PRODUCT = /\b(watch|warning|advisory|emergency)\b.*\b(issued|in effect|until)\b/i;
const ALL_CLEAR = /\ball[-\s]?clear\b/i;
const EVAC_NOW = /\bevacuate now\b/i;
const NEW_RULE = /\b(you must|new rule|this is an official alert)\b/i;

export function looksLikeInventedPolicy(text: string): boolean {
  return (
    LIVE_PRODUCT.test(text) ||
    ALL_CLEAR.test(text) ||
    EVAC_NOW.test(text) ||
    NEW_RULE.test(text)
  );
}

export function isDisallowedInferredFact(claim: string): boolean {
  return looksLikeInventedPolicy(claim);
}
