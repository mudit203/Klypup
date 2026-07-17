import { MarketIntelligenceOutput } from './marketIntelligence';
import { DemandForecastingOutput } from './demandForecasting';
import { InventoryCostOutput } from './inventoryCost';
import { callGroqAgent } from '../../lib/groq';

export interface PricingStrategyOutput {
  summary: string;
  recommended_price: number;
  confidence_score: number;
  rationale: string;
  reasoning_factors: string[];
}

export async function runPricingStrategyAgent(
  productName: string,
  currentPrice: number,
  agent1Output: MarketIntelligenceOutput,
  agent2Output: DemandForecastingOutput,
  agent3Output: InventoryCostOutput
): Promise<PricingStrategyOutput> {
  const systemPrompt = `You are a Pricing Strategy Director AI Agent.
Synthesize the intelligence reports from:
1. Agent 1 (Competitor Market pricing trends)
2. Agent 2 (Demand forecasting and interest signals)
3. Agent 3 (Inventory levels and cost margin boundaries)

Based on these inputs and the current price of the product, recommend the optimal new retail price and state your confidence score (0 to 100).
Rules:
- If Agent 3 says the margin floor is violated, you must recommend a price that keeps the margin safe and above the floor.
- If demand is rising and inventory is low, consider a price increase.
- If competitor prices have dropped significantly and margins allow, consider a price drop to match them.

You MUST respond with a JSON object matching this schema exactly:
{
  "summary": "A 2-3 sentence overview of the pricing strategy.",
  "recommended_price": 149.99,
  "confidence_score": 85,
  "rationale": "A 2-4 sentence plain-English explanation of your recommendation.",
  "reasoning_factors": ["Competitor prices decreased", "Healthy stock margins allowed price match"]
}
Return ONLY valid JSON. Do not include markdown blocks, code wrappers, or conversational text.`;

  const userPrompt = `Product: "${productName}"
Current Price: $${currentPrice.toFixed(2)}

Agent 1 Report (Competitor Market):
${JSON.stringify(agent1Output, null, 2)}

Agent 2 Report (Demand):
${JSON.stringify(agent2Output, null, 2)}

Agent 3 Report (Inventory & Margin):
${JSON.stringify(agent3Output, null, 2)}`;

  const responseText = await callGroqAgent(systemPrompt, userPrompt);
  try {
    return JSON.parse(responseText.trim()) as PricingStrategyOutput;
  } catch (err) {
    console.error('Failed to parse Agent 4 output JSON:', responseText, err);
    throw new Error('Agent 4 Pricing Strategy output parsing failed');
  }
}
