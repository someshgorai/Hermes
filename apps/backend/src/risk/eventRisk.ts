import axios from "axios";
import { readFileSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";
import {
  searchSupplierNews,
  formatArticlesForPrompt,
} from "./serperSearch";

// supply-chain risk categories — must stay in sync with the OpenRouter prompt output
export type RiskType =
  | "financial"
  | "labor"
  | "geopolitical"
  | "logistics"
  | "esg";

// a validated risk event pulled from external news
export interface RiskEvent {
  risk_type: RiskType;
  severity: number;
  summary: string;
  source: string;
  headline: string;
}

// event risk result — score is 0–100
export interface EventRiskResult {
  score: number;
  events: RiskEvent[];
}

// category weights for the final event score
// financial & geopolitical get more weight since they hit supplier continuity harder
const EVENT_WEIGHTS: Record<RiskType, number> = {
  financial: 0.3,
  geopolitical: 0.25,
  labor: 0.2,
  logistics: 0.15,
  esg: 0.1,
};

const VALID_RISK_TYPES = new Set<RiskType>([
  "financial",
  "labor",
  "geopolitical",
  "logistics",
  "esg",
]);

// cached at startup so we don't re-read the file every time
const PROMPT_TEMPLATE = readFileSync(
  path.join(__dirname, "prompts", "riskAnalysis.txt"),
  "utf-8",
);

const FALLBACK_PROMPT_TEMPLATE = readFileSync(
  path.join(__dirname, "prompts", "riskAnalysisFallback.txt"),
  "utf-8",
);

// builds the supplier-specific prompt with Serper search results injected
function buildPrompt(
  supplierName: string,
  supplierCountry: string,
  newsArticles: string,
): string {
  const currentDate = new Date().toISOString().split("T")[0];

  return PROMPT_TEMPLATE.replaceAll("{{supplier_name}}", supplierName)
    .replaceAll("{{supplier_country}}", supplierCountry)
    .replaceAll("{{current_date}}", currentDate)
    .replaceAll("{{news_articles}}", newsArticles);
}

// builds the knowledge-based fallback prompt (no search results)
function buildFallbackPrompt(
  supplierName: string,
  supplierCountry: string,
): string {
  const currentDate = new Date().toISOString().split("T")[0];

  return FALLBACK_PROMPT_TEMPLATE.replaceAll(
    "{{supplier_name}}",
    supplierName,
  )
    .replaceAll("{{supplier_country}}", supplierCountry)
    .replaceAll("{{current_date}}", currentDate);
}

// cleans up LLM output — filters to known categories, clamps severity to 0–1, fills empty strings
function normalizeRiskEvents(input: unknown): RiskEvent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .filter(
      (
        item,
      ): item is Record<string, unknown> & {
        risk_type: RiskType;
      } => VALID_RISK_TYPES.has(item.risk_type as RiskType),
    )
    .map((item) => ({
      risk_type: item.risk_type as RiskType,

      severity: Math.min(1, Math.max(0, Number(item.severity) || 0)),

      summary: String(item.summary ?? ""),

      source: String(item.source ?? ""),

      headline: String(item.headline ?? ""),
    }));
}

// Keep rate-limit retries conservative: one retry after a 4-minute cooldown.
const MAX_RETRIES = 2;
const RATE_LIMIT_RETRY_AFTER_SECONDS = 4 * 60;

// waits for the specified number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(value: unknown): number | undefined {
  const headerValue = Array.isArray(value) ? value[0] : value;

  if (typeof headerValue !== "string") {
    return undefined;
  }

  const numericValue = Number(headerValue);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue;
  }

  const retryAt = Date.parse(headerValue);

  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.ceil((retryAt - Date.now()) / 1000);
}

function getRetryAfterSeconds(value: unknown): number {
  const retryAfterSeconds =
    parseRetryAfterSeconds(value) ?? RATE_LIMIT_RETRY_AFTER_SECONDS;

  return Math.min(
    RATE_LIMIT_RETRY_AFTER_SECONDS,
    Math.max(1, retryAfterSeconds),
  );
}

function getCompactAxiosError(err: unknown) {
  if (!axios.isAxiosError(err)) {
    return { message: err instanceof Error ? err.message : String(err) };
  }

  return {
    message: err.message,
    code: err.code,
    status: err.response?.status,
    statusText: err.response?.statusText,
    url: err.config?.url,
    response: err.response?.data,
  };
}

// sends the prompt to OpenRouter and returns validated RiskEvent[]
// retries automatically on 429 rate-limit errors
async function callLlm(prompt: string): Promise<RiskEvent[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const model = process.env.OPENROUTER_MODEL;

  const website = process.env.WEBSITE;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  if (!model) {
    throw new Error("OPENROUTER_MODEL is required");
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.1,
        },
        {
          timeout: 60_000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": website,
            "X-Title": "Hermes Supply Chain Platform",
          },
        },
      );

      const content = response.data?.choices?.[0]?.message?.content ?? "{}";

      try {
        // Thinking models wrap output in <think>…</think> tags; strip them.
        // Models occasionally wrap JSON in markdown code fences.
        const clean = content
          .replace(/<think>[\s\S]*?<\/think>/g, "")
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        const parsed = JSON.parse(clean) as {
          risks?: unknown;
        };

        return normalizeRiskEvents(parsed.risks);
      } catch {
        logger.warn(
          {
            content,
          },
          "Failed to parse OpenRouter JSON response",
        );

        return [];
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        const retryAfter = getRetryAfterSeconds(
          err.response.headers["retry-after"],
        );

        if (attempt < MAX_RETRIES) {
          logger.warn(
            {
              attempt,
              maxAttempts: MAX_RETRIES,
              retryAfter,
              model,
            },
            "OpenRouter rate limited risk analysis; retrying",
          );

          await sleep(retryAfter * 1000);

          continue;
        }

        logger.warn(
          {
            attempt,
            maxAttempts: MAX_RETRIES,
            model,
            status: err.response.status,
          },
          "OpenRouter rate limit exhausted; continuing without event risks",
        );

        return [];
      }

      throw err;
    }
  }

  return [];
}

// fetches news via Serper, then sends to LLM for analysis
// falls back to knowledge-based prompt if Serper is unavailable
async function fetchRiskEvents(
  supplierName: string,
  supplierCountry: string,
): Promise<RiskEvent[]> {
  // Step 1: Search for real news articles
  const articles = await searchSupplierNews(supplierName, supplierCountry);

  let prompt: string;

  if (articles.length > 0) {
    // RAG path — real articles as context
    const newsBlock = formatArticlesForPrompt(articles);

    prompt = buildPrompt(supplierName, supplierCountry, newsBlock);

    logger.info(
      { supplierName, articleCount: articles.length },
      "Using Serper search results for risk analysis",
    );
  } else {
    // Fallback — LLM knowledge only
    prompt = buildFallbackPrompt(supplierName, supplierCountry);

    logger.info(
      { supplierName },
      "No search results — falling back to knowledge-based analysis",
    );
  }

  // Step 2: Send to LLM for structured analysis
  return callLlm(prompt);
}

// turns risk events into one score — only the worst event per category counts
function computeEventScore(events: RiskEvent[]): number {
  if (events.length === 0) {
    return 0;
  }

  const maxByType: Partial<Record<RiskType, number>> = {};

  for (const event of events) {
    const current = maxByType[event.risk_type] ?? 0;

    maxByType[event.risk_type] = Math.max(current, event.severity);
  }

  let weighted = 0;

  for (const [type, weight] of Object.entries(EVENT_WEIGHTS) as [
    RiskType,
    number,
  ][]) {
    weighted += (maxByType[type] ?? 0) * weight;
  }

  return Math.round(weighted * 100);
}


// Performs external event-risk analysis for a supplier.

// Failures return a zero score so route analysis can continue
// even when the AI provider is unavailable.
export async function scoreEventRisk(
  supplierName: string,
  supplierCountry: string,
): Promise<EventRiskResult> {
  try {
    logger.info({ supplierName }, "Fetching event risk via Serper + OpenRouter");

    const events = await fetchRiskEvents(supplierName, supplierCountry);

    if (events.length === 0) {
      logger.info({ supplierName }, "No risk events found");
    }

    const score = computeEventScore(events);

    logger.info(
      {
        supplierName,
        score,
        eventCount: events.length,
      },
      "Event risk scored",
    );

    return {
      score,
      events,
    };
  } catch (err) {
    logger.error(
      {
        err: getCompactAxiosError(err),
        supplierName,
      },
      "Event risk fetch failed; returning 0",
    );

    // Preserve system availability if the AI provider fails.
    return {
      score: 0,
      events: [],
    };
  }
}
