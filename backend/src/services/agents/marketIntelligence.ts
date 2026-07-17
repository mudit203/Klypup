import { CompetitorPrice } from '@prisma/client';
import { callGroqAgent } from '../../lib/groq';

export interface MarketIntelligenceOutput {
  summary: string;
  notable_event: boolean;
  competitor_trend: 'DOWN' | 'UP' | 'STABLE' | 'MIXED';
  biggest_competitor: string;
  biggest_price_delta_pct: number;
}

export async function runMarketIntelligenceAgent(
  competitorPrices: CompetitorPrice[]
): Promise<MarketIntelligenceOutput> {
  const systemPrompt = `You are a Market Intelligence AI Agent.
Analyze the competitor price history over the last 30 days and identify trends, notable price drops, or price increases.

Rules for output fields:
- notable_event: Set to true if there is a significant price drop or increase of >= 5% in the logs. Otherwise false.
- competitor_trend: Must be one of "DOWN", "UP", "STABLE", or "MIXED".
- biggest_competitor: Name of the competitor with the largest price change, or "None".
- biggest_price_delta_pct: The percentage price change as a number, e.g. -22.0 or 15.5.

You MUST respond with a JSON object matching this schema exactly:
{
  "summary": "A 2-3 sentence plain-English summary of recent competitor price movements.",
  "notable_event": false,
  "competitor_trend": "STABLE",
  "biggest_competitor": "None",
  "biggest_price_delta_pct": 0.0
}
Return ONLY valid JSON. Do not include markdown blocks, code wrappers, or conversational text.`;

  const userPrompt = `Competitor Price logs for the last 30 days:
${JSON.stringify(
    competitorPrices.map((cp) => ({
      competitor: cp.competitor,
      price: cp.price,
      event_type: cp.event_type,
      recorded_at: cp.recorded_at,
    })),
    null,
    2
  )}`;

  const responseText = await callGroqAgent(systemPrompt, userPrompt);
  try {
    return JSON.parse(responseText.trim()) as MarketIntelligenceOutput;
  } catch (err) {
    console.error('Failed to parse Agent 1 output JSON:', responseText, err);
    throw new Error('Agent 1 Market Intelligence output parsing failed');
  }
}
