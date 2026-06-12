import axios from "axios";
import { readFileSync } from "fs";
import { logger } from "../lib/logger";

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
  new URL("./prompts/riskAnalysis.txt", import.meta.url),
  "utf-8",
);

// builds the supplier-specific prompt for OpenRouter
function buildPrompt(supplierName: string, supplierCountry: string): string {
  const currentDate = new Date().toISOString().split("T")[0];

  return PROMPT_TEMPLATE.replaceAll("{{supplier_name}}", supplierName)
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

// hits OpenRouter for recent supplier events and returns validated RiskEvent[]
async function fetchRiskEvents(
  supplierName: string,
  supplierCountry: string,
): Promise<RiskEvent[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const model = process.env.OPENROUTER_MODEL;

  const website = process.env.WEBSITE;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  if (!model) {
    throw new Error("OPENROUTER_MODEL is required");
  }

  const prompt = buildPrompt(supplierName, supplierCountry);

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
      timeout: 30_000,
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
    // Models occasionally wrap JSON in markdown code fences.
    const clean = content
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
        supplierName,
        content,
      },
      "Failed to parse OpenRouter JSON response",
    );

    return [];
  }
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

/**
 * Performs external event-risk analysis for a supplier.
 *
 * Failures return a zero score so route analysis can continue
 * even when the AI provider is unavailable.
 */
export async function scoreEventRisk(
  supplierName: string,
  supplierCountry: string,
): Promise<EventRiskResult> {
  try {
    logger.info({ supplierName }, "Fetching event risk via OpenRouter");

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
        err,
        supplierName,
      },
      "Event risk fetch failed — returning 0",
    );

    // Preserve system availability if the AI provider fails.
    return {
      score: 0,
      events: [],
    };
  }
}
