import { InventorySnapshot } from '@prisma/client';
import { callGroqAgent } from '../../lib/groq';

export interface InventoryCostOutput {
  summary: string;
  stock_status: 'LOW' | 'NORMAL' | 'HIGH';
  current_margin_pct: number;
  margin_floor_pct: number;
  margin_floor_violated: boolean;
  pricing_implication: 'INCREASE' | 'DECREASE' | 'HOLD';
}

export async function runInventoryCostAgent(
  latestSnapshot: InventorySnapshot | null,
  costOfGoods: number,
  currentPrice: number,
  minMarginFloor: number
): Promise<InventoryCostOutput> {
  const stockLevel = latestSnapshot ? latestSnapshot.stock_level : 0;
  
  // Calculate profit margin percentages
  const currentMargin = (currentPrice - costOfGoods) / currentPrice;
  const currentMarginPct = parseFloat((currentMargin * 100).toFixed(2));
  const marginFloorPct = parseFloat((minMarginFloor * 100).toFixed(2));
  const marginFloorViolated = currentMargin < minMarginFloor;

  // Evaluate stock status as per specs (< 20 is LOW, > 200 is HIGH)
  let stockStatus: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL';
  if (stockLevel < 20) {
    stockStatus = 'LOW';
  } else if (stockLevel > 200) {
    stockStatus = 'HIGH';
  }

  // Determine inventory-based pricing implication
  let pricingImplication: 'INCREASE' | 'DECREASE' | 'HOLD' = 'HOLD';
  if (stockStatus === 'LOW') {
    pricingImplication = 'INCREASE';
  } else if (stockStatus === 'HIGH') {
    pricingImplication = 'DECREASE';
  }

  const systemPrompt = `You are an Inventory & Cost Analyst AI Agent.
Review the following inventory details and margin constraints. Write a 2-sentence plain English summary of these metrics.
You MUST respond with a JSON object matching this schema exactly:
{
  "summary": "A 2-sentence plain-English summary of inventory levels and margin compliance."
}
Return ONLY valid JSON. Do not include markdown blocks, code wrappers, or conversational text.`;

  const userPrompt = `Inventory and Margin Details:
- Current Stock Level: ${stockLevel} units
- Stock Status category: ${stockStatus}
- Cost of Goods: $${costOfGoods.toFixed(2)}
- Current Retail Price: $${currentPrice.toFixed(2)}
- Current Profit Margin: ${currentMarginPct}%
- Category Minimum Margin Floor: ${marginFloorPct}%
- Margin Floor Violated: ${marginFloorViolated}`;

  let summary = `Stock levels are currently ${stockStatus.toLowerCase()} at ${stockLevel} units, and the current profit margin of ${currentMarginPct}% is in compliance with the required ${marginFloorPct}% margin floor.`;
  
  try {
    const responseText = await callGroqAgent(systemPrompt, userPrompt);
    const json = JSON.parse(responseText.trim());
    if (json.summary) {
      summary = json.summary;
    }
  } catch (err) {
    console.error('Failed to parse Agent 3 summary JSON, falling back to default:', err);
  }

  return {
    summary,
    stock_status: stockStatus,
    current_margin_pct: currentMarginPct,
    margin_floor_pct: marginFloorPct,
    margin_floor_violated: marginFloorViolated,
    pricing_implication: pricingImplication,
  };
}
