// src/services/geminiService.ts
// Production-oriented Gemini (Google Generative Language) service:
// - Auto-discovers available models (avoids 404 model-not-found)
// - Fallback across multiple candidate models
// - Retries on transient errors + handles 401/403/429 cleanly
// - Supports JSON-mode output (schema-lite) and plain text
//
// Works in browser (Vite) and Node (SSR) as long as fetch is available.

export type GeminiRole = "user" | "model";

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }; // base64

export type GeminiContent = {
  role: GeminiRole;
  parts: GeminiPart[];
};

export type GeminiGenerationConfig = {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  // When you want JSON output:
  responseMimeType?: "application/json" | "text/plain";
};

export type GeminiSafetySetting = {
  category:
    | "HARM_CATEGORY_DANGEROUS_CONTENT"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT";
  threshold:
    | "BLOCK_NONE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_LOW_AND_ABOVE";
};

export type GeminiRequest = {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
};

type ListModelsResponse = {
  models?: Array<{
    name: string; // e.g. "models/gemini-1.5-flash"
    supportedGenerationMethods?: string[]; // e.g. ["generateContent"]
  }>;
};

type GenerateContentResponse = {
  candidates?: Array<{
    content?: { role?: string; parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: unknown;
  usageMetadata?: unknown;
  error?: { code?: number; message?: string; status?: string };
};

export type GeminiServiceConfig = {
  apiKey: string;
  // Prefer v1 first. If your key only supports v1beta, we fallback.
  baseUrls?: string[]; // default: ["https://generativelanguage.googleapis.com/v1", "https://generativelanguage.googleapis.com/v1beta"]
  // Optional: force specific model(s). If empty => auto-discover.
  preferredModels?: string[]; // can be "models/..." or short like "gemini-1.5-flash"
  // Optional: enable console debug
  debug?: boolean;
  // Optional: request timeout (ms)
  timeoutMs?: number;
};

function normalizeModelName(m: string): string {
  const trimmed = (m || "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("models/")) return trimmed;
  // allow "gemini-1.5-flash" -> "models/gemini-1.5-flash"
  return `models/${trimmed}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function pickText(resp: GenerateContentResponse): string {
  const t = resp?.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? "").join("") ?? "";
  return t.trim();
}

function safeJsonParse<T = any>(s: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const v = JSON.parse(s);
    return { ok: true, value: v as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid JSON" };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function httpJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<{ status: number; json: T | null; text: string }> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    // keep json null
  }
  return { status: res.status, json, text };
}

export class GeminiService {
  private apiKey: string;
  private baseUrls: string[];
  private preferredModels: string[];
  private debug: boolean;
  private timeoutMs: number;

  // Cache
  private discoveredModels: string[] | null = null;
  private lastDiscoveryAt = 0;

  constructor(cfg: GeminiServiceConfig) {
    if (!cfg?.apiKey) throw new Error("GeminiService: Missing apiKey");
    this.apiKey = cfg.apiKey;
    this.baseUrls = cfg.baseUrls?.length
      ? cfg.baseUrls
      : ["https://generativelanguage.googleapis.com/v1", "https://generativelanguage.googleapis.com/v1beta"];
    this.preferredModels = (cfg.preferredModels ?? []).map(normalizeModelName);
    this.debug = !!cfg.debug;
    this.timeoutMs = Math.max(3000, cfg.timeoutMs ?? 25000);
  }

  private log(...args: any[]) {
    if (this.debug) console.log("[GeminiService]", ...args);
  }

  /**
   * Discover models that support generateContent.
   * Cache for 10 minutes to reduce calls.
   */
  async listGenerateContentModels(force = false): Promise<{ baseUrl: string; models: string[] }> {
    const now = Date.now();
    const cacheValid = this.discoveredModels && now - this.lastDiscoveryAt < 10 * 60 * 1000;
    if (!force && cacheValid) {
      // We don't know which baseUrl worked previously; re-try quickly by probing v1 then v1beta.
      return { baseUrl: this.baseUrls[0], models: this.discoveredModels! };
    }

    let lastErr = "";
    for (const baseUrl of this.baseUrls) {
      const url = `${baseUrl}/models?key=${encodeURIComponent(this.apiKey)}`;
      const { status, json, text } = await httpJson<ListModelsResponse>(url, { method: "GET" }, this.timeoutMs);

      if (status === 200 && json?.models?.length) {
        const models = (json.models || [])
          .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map((m) => m.name)
          .filter(Boolean);

        if (models.length) {
          this.discoveredModels = models;
          this.lastDiscoveryAt = now;
          this.log("Discovered models via", baseUrl, models.slice(0, 8));
          return { baseUrl, models };
        }
        lastErr = `No generateContent models returned from ${baseUrl}`;
        continue;
      }

      lastErr = `listModels failed: ${status} ${text}`;
      // If unauthorized, no point trying other baseUrl
      if (status === 401 || status === 403) break;
    }

    throw new Error(lastErr || "Unable to list models");
  }

  /**
   * Choose a model:
   * 1) Use preferredModels if provided and available
   * 2) Else choose a reasonable default among discovered models
   */
  private chooseModel(discovered: string[]): string {
    if (this.preferredModels.length) {
      const set = new Set(discovered);
      for (const m of this.preferredModels) {
        if (set.has(m)) return m;
      }
      // If user forced models but none match discovered, still try the first preferred (maybe listModels is restricted).
      return this.preferredModels[0];
    }

    const priorities = [
      // Prefer fast & cheap first for app UX:
      "models/gemini-2.0-flash",
      "models/gemini-2.0-flash-lite",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-flash-latest",
      // Then higher quality:
      "models/gemini-1.5-pro",
      "models/gemini-1.5-pro-latest",
    ];

    const set = new Set(discovered);
    for (const p of priorities) if (set.has(p)) return p;

    // Fallback: first discovered
    return discovered[0] || "models/gemini-1.5-flash";
  }

  /**
   * Core call:
   * - Auto model discovery
   * - Retries on transient errors
   * - Fallback across baseUrls (v1 -> v1beta) and across models if needed
   */
  async generateContent<TJson = any>(req: GeminiRequest, opts?: { expectJson?: boolean; retries?: number }): Promise<{
    modelUsed: string;
    baseUrlUsed: string;
    text: string;
    json?: TJson;
    usageMetadata?: unknown;
  }> {
    const expectJson = !!opts?.expectJson || req.generationConfig?.responseMimeType === "application/json";
    const retries = Math.min(4, Math.max(0, opts?.retries ?? 2));

    // Step 1: discover models/baseUrl
    let baseUrlUsed = this.baseUrls[0];
    let discovered: string[] = [];
    try {
      const disc = await this.listGenerateContentModels(false);
      baseUrlUsed = disc.baseUrl;
      discovered = disc.models;
    } catch (e: any) {
      // If listModels fails (some org policies), we still try with known endpoints
      this.log("listModels failed, continue with fallback models. Err:", e?.message || e);
      discovered = [];
    }

    // Step 2: build model candidates
    const candidates: string[] = [];
    if (this.preferredModels.length) {
      candidates.push(...this.preferredModels);
    } else if (discovered.length) {
      candidates.push(this.chooseModel(discovered));
      // Add a couple of alternates
      candidates.push(
        "models/gemini-2.0-flash",
        "models/gemini-1.5-flash",
        "models/gemini-1.5-pro",
        "models/gemini-1.5-flash-latest",
        "models/gemini-1.5-pro-latest"
      );
    } else {
      candidates.push(
        "models/gemini-2.0-flash",
        "models/gemini-1.5-flash",
        "models/gemini-1.5-pro",
        "models/gemini-1.5-flash-latest",
        "models/gemini-1.5-pro-latest"
      );
    }

    // de-dup while keeping order
    const seen = new Set<string>();
    const modelCandidates = candidates.map(normalizeModelName).filter((m) => (seen.has(m) ? false : seen.add(m)));

    // Step 3: attempt calls across baseUrls & models
    let lastErr = "";
    for (const baseUrl of this.baseUrls) {
      for (const model of modelCandidates) {
        const url = `${baseUrl}/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const body = JSON.stringify(req);

        for (let attempt = 0; attempt <= retries; attempt++) {
          const backoffMs = attempt === 0 ? 0 : 400 * Math.pow(2, attempt - 1);

          if (backoffMs) await sleep(backoffMs);

          const { status, json, text } = await httpJson<GenerateContentResponse>(
            url,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            },
            this.timeoutMs
          );

          // Success
          if (status === 200 && json) {
            const outText = pickText(json);
            if (!outText) {
              // Sometimes safety blocks return empty candidates
              lastErr = `Gemini returned empty output (finishReason=${json?.candidates?.[0]?.finishReason ?? "unknown"})`;
              continue;
            }

            // JSON expected?
            if (expectJson) {
              const parsed = safeJsonParse<TJson>(outText);
              if (parsed.ok) {
                return {
                  modelUsed: model,
                  baseUrlUsed: baseUrl,
                  text: outText,
                  json: parsed.value,
                  usageMetadata: json.usageMetadata,
                };
              }

              // If JSON parse fails, we can try one auto-repair round by re-asking (one extra internal attempt)
              // without infinite loops.
              const repairReq: GeminiRequest = {
                ...req,
                generationConfig: {
                  ...(req.generationConfig || {}),
                  responseMimeType: "application/json",
                  temperature: 0,
                },
                contents: [
                  ...(req.contents || []),
                  {
                    role: "user",
                    parts: [
                      {
                        text:
                          "Output MUST be valid strict JSON only (no markdown, no comments, no trailing commas). Return exactly one JSON object.",
                      },
                    ],
                  },
                ],
              };

              const repairBody = JSON.stringify(repairReq);
              const repair = await httpJson<GenerateContentResponse>(
                url,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: repairBody },
                this.timeoutMs
              );

              if (repair.status === 200 && repair.json) {
                const repairText = pickText(repair.json);
                const repairParsed = safeJsonParse<TJson>(repairText);
                if (repairParsed.ok) {
                  return {
                    modelUsed: model,
                    baseUrlUsed: baseUrl,
                    text: repairText,
                    json: repairParsed.value,
                    usageMetadata: repair.json.usageMetadata,
                  };
                }
                lastErr = `JSON parse failed after repair: ${repairParsed.ok ? "" : repairParsed.error}`;
                continue;
              }

              lastErr = `JSON expected but repair failed: ${repair.status} ${repair.text}`;
              continue;
            }

            // Plain text
            return {
              modelUsed: model,
              baseUrlUsed: baseUrl,
              text: outText,
              usageMetadata: json.usageMetadata,
            };
          }

          // Handle known errors
          if (status === 401 || status === 403) {
            lastErr = `Auth error (${status}). Check API key / restrictions. Body: ${text}`;
            // auth errors won't succeed on retry/model; stop early
            throw new Error(lastErr);
          }

          // If model not found / not supported, switch model (don’t waste retries)
          if (status === 404) {
            lastErr = `Model/endpoint not found (${status}) at ${baseUrl}/${model}. Body: ${text}`;
            break;
          }

          // Retry transient
          if (isTransientStatus(status)) {
            lastErr = `Transient error (${status}). Attempt ${attempt + 1}/${retries + 1}. Body: ${text}`;
            continue;
          }

          // Other non-transient
          lastErr = `Gemini error (${status}) at ${baseUrl}/${model}. Body: ${text}`;
          break;
        }
      }
    }

    throw new Error(lastErr || "Gemini generateContent failed");
  }
}

/** Convenience singleton factory */
let _singleton: GeminiService | null = null;

export function getGeminiService(): GeminiService {
  if (_singleton) return _singleton;

  // IMPORTANT:
  // - In Vite, you should use VITE_GEMINI_API_KEY in .env
  // - Never hardcode keys in code.
  const apiKey =
    (import.meta as any)?.env?.VITE_GEMINI_API_KEY ||
    (import.meta as any)?.env?.VITE_GOOGLE_API_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "Missing VITE_GEMINI_API_KEY (or VITE_GOOGLE_API_KEY). Add it to your .env and restart dev server."
    );
  }

  _singleton = new GeminiService({
    apiKey,
    debug: false,
    // Optional: you can force preferredModels if you want:
    // preferredModels: ["gemini-2.0-flash", "gemini-1.5-flash-latest"],
  });

  return _singleton;
}

/** Small helper: call and return either json or text */
export async function geminiGenerate<TJson = any>(
  req: GeminiRequest,
  opts?: { expectJson?: boolean; retries?: number }
) {
  const svc = getGeminiService();
  return svc.generateContent<TJson>(req, opts);
}
