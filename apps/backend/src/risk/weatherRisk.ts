import axios from "axios";
import { logger } from "../lib/logger";

// OpenWeatherMap API key.
const API_KEY = process.env.OPENWEATHERMAP_API_KEY;

if (!API_KEY) {
  throw new Error("OPENWEATHERMAP_API_KEY is required");
}

/**
 * Coordinates representing a complete supply-chain route:
 *
 * Supplier → Export Port → Import Port → Warehouse
 */
export interface RouteCoordinates {
  originLat: number;
  originLng: number;
  exportPortLat: number;
  exportPortLng: number;
  importPortLat: number;
  importPortLng: number;
  warehouseLat: number;
  warehouseLng: number;
}

/**
 * Weather risk score for a single forecast day.
 *
 * Scores are normalized to a 0–100 scale.
 */
export interface DailyWeatherScore {
  date: string;

  // Score 0–100
  score: number;

  condition: string;
}

/**
 * Current weather risk assessment for a route.
 *
 * The score represents the highest-risk location along the route.
 */
export interface WeatherRiskResult {
  // Score 0–100 — worst weather point on this route
  score: number;

  // Breakdown per coordinate
  breakdown: {
    label: string;
    condition: string;
    score: number;
  }[];
}

/**
 * Five-day weather outlook for a route.
 *
 * OpenWeatherMap's free forecast API provides up to five days
 * of weather data in three-hour intervals.
 */
export interface WeatherForecastResult {
  daily: DailyWeatherScore[];
}

/**
 * Maps weather conditions to operational disruption severity.
 *
 * Values reflect relative supply-chain impact rather than
 * meteorological intensity.
 */
const WEATHER_SEVERITY: Record<string, number> = {
  clear: 0.0,
  clouds: 0.1,
  drizzle: 0.2,
  rain: 0.3,
  snow: 0.4,
  mist: 0.2,
  fog: 0.3,
  haze: 0.2,
  dust: 0.3,
  sand: 0.3,
  ash: 0.6,
  squall: 0.5,
  thunderstorm: 0.6,
  extreme: 0.9,
  tornado: 1.0,
};

function mapCondition(main: string): number {
  return WEATHER_SEVERITY[main.toLowerCase()] ?? 0.1;
}

/**
 * Retrieves current weather conditions for a location.
 */
async function fetchCurrentAt(
  lat: number,
  lng: number,
): Promise<{
  main: string;
}> {
  const response = await axios.get(
    "https://api.openweathermap.org/data/2.5/weather",
    {
      params: {
        lat,
        lon: lng,
        appid: API_KEY,
      },
      timeout: 30_000,
    },
  );

  const weather = response.data.weather?.[0];

  return {
    main: weather?.main ?? "Clear",
  };
}

/**
 * Evaluates current weather risk across the entire route.
 *
 * The highest-risk location determines the route score because
 * a single severe weather event can disrupt the supply chain.
 */
export async function scoreCurrentWeather(
  coords: RouteCoordinates,
): Promise<WeatherRiskResult> {
  const points = [
    {
      label: "Supplier Origin",
      lat: coords.originLat,
      lng: coords.originLng,
    },
    {
      label: "Export Port",
      lat: coords.exportPortLat,
      lng: coords.exportPortLng,
    },
    {
      label: "Import Port",
      lat: coords.importPortLat,
      lng: coords.importPortLng,
    },
    {
      label: "Destination Warehouse",
      lat: coords.warehouseLat,
      lng: coords.warehouseLng,
    },
  ];

  const results = await Promise.all(
    points.map(async (point) => {
      try {
        const { main } = await fetchCurrentAt(point.lat, point.lng);

        return {
          label: point.label,
          condition: main,
          score: Math.round(mapCondition(main) * 100),
        };
      } catch (err) {
        logger.warn(
          {
            err,
            label: point.label,
          },
          "Weather fetch failed for point",
        );

        return {
          label: point.label,
          condition: "Unknown",
          score: 10,
        };
      }
    }),
  );

  const score = Math.max(...results.map((r) => r.score));

  logger.info(
    {
      score,
      breakdown: results,
    },
    "Current weather scored",
  );

  return {
    score,
    breakdown: results,
  };
}

/**
 * Converts OpenWeatherMap's 3-hour forecast data into
 * daily worst-case weather conditions.
 */
async function fetchForecastAt(
  lat: number,
  lng: number,
): Promise<
  Map<
    string,
    {
      severity: number;
      condition: string;
    }
  >
> {
  const response = await axios.get(
    "https://api.openweathermap.org/data/2.5/forecast",
    {
      params: {
        lat,
        lon: lng,
        appid: API_KEY,
        cnt: 40,
      },
      timeout: 30_000,
    },
  );

  const byDay = new Map<
    string,
    {
      severity: number;
      condition: string;
    }
  >();

  for (const item of response.data.list ?? []) {
    const date = (item.dt_txt as string).split(" ")[0];

    const condition = item.weather?.[0]?.main ?? "Clear";

    const severity = mapCondition(condition);

    const existing = byDay.get(date);

    if (!existing || severity > existing.severity) {
      byDay.set(date, {
        severity,
        condition,
      });
    }
  }

  return byDay;
}

/**
 * Produces a five-day route forecast using the highest-risk
 * weather condition observed at any route location per day.
 */
export async function scoreWeatherForecast(
  coords: RouteCoordinates,
): Promise<WeatherForecastResult> {
  const points = [
    {
      lat: coords.originLat,
      lng: coords.originLng,
    },
    {
      lat: coords.exportPortLat,
      lng: coords.exportPortLng,
    },
    {
      lat: coords.importPortLat,
      lng: coords.importPortLng,
    },
    {
      lat: coords.warehouseLat,
      lng: coords.warehouseLng,
    },
  ];

  const forecasts = await Promise.allSettled(
    points.map((point) => fetchForecastAt(point.lat, point.lng)),
  );

  const successfulForecasts = forecasts.filter(
    (forecast) => forecast.status === "fulfilled",
  );

  if (successfulForecasts.length === 0) {
    logger.error("All weather forecast fetches failed");
  }

  const allDates = new Set<string>();

  for (const forecast of forecasts) {
    if (forecast.status === "fulfilled") {
      for (const date of forecast.value.keys()) {
        allDates.add(date);
      }
    }
  }

  const sortedDates = [...allDates].sort().slice(0, 5);

  const daily: DailyWeatherScore[] = sortedDates.map((date) => {
    let worstSeverity = 0;
    let worstCondition = "Clear";

    for (const forecast of forecasts) {
      if (forecast.status !== "fulfilled") {
        continue;
      }

      const entry = forecast.value.get(date);

      if (entry && entry.severity > worstSeverity) {
        worstSeverity = entry.severity;

        worstCondition = entry.condition;
      }
    }

    return {
      date,
      score: Math.round(worstSeverity * 100),
      condition: worstCondition,
    };
  });

  logger.info(
    {
      days: daily.length,
    },
    "Weather forecast scored",
  );

  return {
    daily,
  };
}
