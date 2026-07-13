import { DemandSignal } from '@prisma/client';
import { callGroqAgent } from '../../lib/groq';

export interface DemandForecastingOutput {
  summary: string;
  demand_direction: 'UP' | 'DOWN' | 'STABLE';
  seasonality_factor: 'PEAK' | 'DIP' | 'NEUTRAL';
  pricing_implication: 'INCREASE' | 'DECREASE' | 'HOLD';
}

export async function runDemandForecastingAgent(
  demandHistory: DemandSignal[],
  category: string
): Promise<DemandForecastingOutput> {
  const systemPrompt = `You are a Demand Forecasting AI Agent.
Analyze the demand signal indexes and seasonality logs over the last 30 days for a product.
Consider the product's category: "${category}".
You MUST respond with a JSON object matching this schema exactly:
{
  "summary": "A 2-3 sentence plain-English summary of recent traffic/interest movements.",
  "demand_direction": "UP" | "DOWN" | "STABLE",
  "seasonality_factor": "PEAK" | "DIP" | "NEUTRAL",
  "pricing_implication": "INCREASE" | "DECREASE" | "HOLD"
}
Return ONLY valid JSON. Do not include markdown blocks, code wrappers, or conversational text.`;

  const userPrompt = `Product Category: ${category}
Demand Signal logs:
${JSON.stringify(
    demandHistory.map((d) => ({
      demand_index: d.demand_index,
      trend: d.trend,
      notes: d.notes,
      recorded_at: d.recorded_at,
    })),
    null,
    2
  )}`;

  const responseText = await callGroqAgent(systemPrompt, userPrompt);
  try {
    return JSON.parse(responseText.trim()) as DemandForecastingOutput;
  } catch (err) {
    console.error('Failed to parse Agent 2 output JSON:', responseText, err);
    throw new Error('Agent 2 Demand Forecasting output parsing failed');
  }
}
