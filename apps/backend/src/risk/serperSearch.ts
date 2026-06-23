import axios from "axios";
import { logger } from "../lib/logger";

// a single news article returned by Serper
export interface NewsArticle {
  title: string;
  snippet: string;
  link: string;
  date: string;
  source: string;
}

// searches Google News via Serper for recent supplier-related articles
export async function searchSupplierNews(
  supplierName: string,
  supplierCountry: string,
): Promise<NewsArticle[]> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    logger.warn("SERPER_API_KEY not set — skipping news search");

    return [];
  }

  const query = `"${supplierName}" supply chain ${supplierCountry}`;

  try {
    const response = await axios.post(
      "https://google.serper.dev/news",
      {
        q: query,
        num: 10,
        tbs: "qdr:w", // last 7 days
      },
      {
        timeout: 10_000,
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
      },
    );

    const articles: NewsArticle[] = (response.data?.news ?? []).map(
      (item: Record<string, unknown>) => ({
        title: String(item.title ?? ""),
        snippet: String(item.snippet ?? ""),
        link: String(item.link ?? ""),
        date: String(item.date ?? ""),
        source: String(item.source ?? ""),
      }),
    );

    logger.info(
      {
        supplierName,
        articleCount: articles.length,
        query,
      },
      "Serper news search completed",
    );

    return articles;
  } catch (err) {
    logger.error(
      { err, supplierName },
      "Serper news search failed — continuing without search results",
    );

    return [];
  }
}

// formats articles into a text block the LLM can analyze
export function formatArticlesForPrompt(articles: NewsArticle[]): string {
  if (articles.length === 0) {
    return "No recent news articles were found for this supplier.";
  }

  return articles
    .map(
      (article, i) =>
        `[${i + 1}] ${article.title}\n` +
        `    Source: ${article.source}\n` +
        `    URL: ${article.link}\n` +
        `    Date: ${article.date}\n` +
        `    Snippet: ${article.snippet}`,
    )
    .join("\n\n");
}
