export function readTrimmedEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function isGrokConfigured(): boolean {
  return Boolean(readTrimmedEnv("XAI_API_KEY"));
}

export function getXaiApiKey(): string | null {
  return readTrimmedEnv("XAI_API_KEY") || null;
}

/**
 * K2 is env-configured only. Missing base URL or model is fail-closed -
 * this client will not invent a host or model name.
 */
export function isK2Configured(): boolean {
  return Boolean(
    readTrimmedEnv("K2_API_KEY") &&
      readTrimmedEnv("K2_API_BASE_URL") &&
      readTrimmedEnv("K2_MODEL"),
  );
}

export type K2Env = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function getK2Env(): K2Env | null {
  const apiKey = readTrimmedEnv("K2_API_KEY");
  const baseUrl = readTrimmedEnv("K2_API_BASE_URL");
  const model = readTrimmedEnv("K2_MODEL");
  if (!apiKey || !baseUrl || !model) return null;
  return { apiKey, baseUrl, model };
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(readTrimmedEnv("ELEVENLABS_API_KEY"));
}

export function getElevenLabsApiKey(): string | null {
  return readTrimmedEnv("ELEVENLABS_API_KEY") || null;
}

export function getElevenLabsVoiceId(): string | null {
  return readTrimmedEnv("ELEVENLABS_VOICE_ID") || null;
}
