import prisma from '../lib/prisma';
import { runOrchestratorPipeline } from './orchestrator';
import { CompetitorPriceEvent, DemandTrend, RecommendationTrigger } from '@prisma/client';

/**
 * runSimulationCycle
 * Simulates a single "Market Day" across all active products.
 * Updates competitor price timelines, category demand, and stock counts.
 * Automatically runs AI analysis if triggerAi parameter is set to true.
 */
export async function runSimulationCycle(triggerAi: boolean = false) {
  console.log(`[Simulation Engine] Starting market simulation cycle (triggerAi=${triggerAi})...`);

  try {
    // 1. Fetch all active products
    const products = await prisma.product.findMany({
      where: { is_active: true }
    });

    const month = new Date().getMonth();

    for (const product of products) {
      try {
        // =============================================================
        // STEP 1: Competitor Price Update (weighted random walk)
        // =============================================================
        const latestCompetitors = await prisma.competitorPrice.findMany({
          where: { product_id: product.id },
          orderBy: { recorded_at: 'desc' }
        });

        // Find the latest price for each unique competitor
        const competitorLatestMap = new Map<string, number>();
        for (const cp of latestCompetitors) {
          if (!competitorLatestMap.has(cp.competitor)) {
            competitorLatestMap.set(cp.competitor, cp.price);
          }
        }

        // If no competitor price records exist yet, seed baseline defaults
        if (competitorLatestMap.size === 0) {
          const isTechMart = product.category === 'Electronics' || product.category === 'Sports & Outdoors';
          const defaultCompetitors = isTechMart ? ['Amazon', 'BestBuy'] : ["Macy's", 'Target'];
          for (const comp of defaultCompetitors) {
            competitorLatestMap.set(comp, product.current_price);
          }
        }

        // Loop through each competitor to roll the price event
        for (const [competitorName, currentPrice] of competitorLatestMap.entries()) {
          const roll = Math.random();
          let eventType: CompetitorPriceEvent = CompetitorPriceEvent.NO_CHANGE;
          let newPrice = currentPrice;

          if (roll < 0.50) {
            // 50% NO_CHANGE
            eventType = CompetitorPriceEvent.NO_CHANGE;
          } else if (roll < 0.70) {
            // 20% SMALL_FLUCTUATION (±3%)
            eventType = CompetitorPriceEvent.SMALL_FLUCTUATION;
            const drift = (Math.random() * 6 - 3) / 100; // -3% to +3%
            newPrice = parseFloat((currentPrice * (1 + drift)).toFixed(2));
          } else if (roll < 0.85) {
            // 15% PRICE_DROP (-5% to -20%)
            eventType = CompetitorPriceEvent.PRICE_DROP;
            const drop = (5 + Math.random() * 15) / 100; // 5% to 20%
            newPrice = parseFloat((currentPrice * (1 - drop)).toFixed(2));
          } else if (roll < 0.95) {
            // 10% PRICE_INCREASE (+5% to +15%)
            eventType = CompetitorPriceEvent.PRICE_INCREASE;
            const increase = (5 + Math.random() * 10) / 100; // 5% to 15%
            newPrice = parseFloat((currentPrice * (1 + increase)).toFixed(2));
          } else {
            // 5% NEW_COMPETITOR
            eventType = CompetitorPriceEvent.NEW_COMPETITOR;
            const drift = (Math.random() * 20 - 10) / 100; // -10% to +10%
            newPrice = parseFloat((product.current_price * (1 + drift)).toFixed(2));
          }

          if (newPrice < 0.50) newPrice = 0.50; // Price boundary floor

          await prisma.competitorPrice.create({
            data: {
              product_id: product.id,
              competitor: competitorName,
              price: newPrice,
              event_type: eventType
            }
          });

          // Handle NEW_COMPETITOR entry
          if (eventType === CompetitorPriceEvent.NEW_COMPETITOR) {
            const isTechMart = product.category === 'Electronics' || product.category === 'Sports & Outdoors';
            const newStoreName = isTechMart ? 'Walmart' : 'Nordstrom';
            
            // Register new competitor listing if not already present
            if (!competitorLatestMap.has(newStoreName)) {
              const entryPrice = parseFloat((product.current_price * (1 + (Math.random() * 10 - 5) / 100)).toFixed(2));
              await prisma.competitorPrice.create({
                data: {
                  product_id: product.id,
                  competitor: newStoreName,
                  price: entryPrice,
                  event_type: CompetitorPriceEvent.NEW_COMPETITOR
                }
              });
            }
          }
        }

        // =============================================================
        // STEP 2: Demand Signal Update (seasonality modulated)
        // =============================================================
        let multiplier = 1.0;
        const categoryLower = product.category.toLowerCase();

        if (categoryLower === 'electronics') {
          // Peaks in Q4 (Oct, Nov, Dec), dips in Q1-Q2 (Jan-Jun)
          if (month >= 9 && month <= 11) multiplier = 1.35;
          else if (month >= 0 && month <= 5) multiplier = 0.80;
        } else if (categoryLower === 'clothing') {
          // Peaks in Spring (Mar-May) and Fall (Sept-Nov)
          if ((month >= 2 && month <= 4) || (month >= 8 && month <= 10)) multiplier = 1.30;
          else multiplier = 0.85;
        } else if (categoryLower === 'sports & outdoors') {
          // Peaks in Spring/Summer (Apr-Aug)
          if (month >= 3 && month <= 7) multiplier = 1.30;
          else multiplier = 0.80;
        }

        const baseDemand = 50;
        const noise = (Math.random() * 20 - 10) / 100; // -10% to +10% noise
        let demandIndex = Math.round(baseDemand * multiplier * (1 + noise));

        // Clamp demand index
        if (demandIndex < 10) demandIndex = 10;
        if (demandIndex > 100) demandIndex = 100;

        let trend: DemandTrend = DemandTrend.STABLE;
        if (multiplier > 1.1) {
          trend = DemandTrend.SEASONAL_PEAK;
        } else if (multiplier < 0.9) {
          trend = DemandTrend.SEASONAL_DIP;
        } else if (noise > 0.05) {
          trend = DemandTrend.RISING;
        } else if (noise < -0.05) {
          trend = DemandTrend.FALLING;
        }

        await prisma.demandSignal.create({
          data: {
            product_id: product.id,
            demand_index: demandIndex,
            trend: trend,
            notes: `Simulated daily demand index: ${demandIndex} for ${product.category} in month index ${month}.`
          }
        });

        // =============================================================
        // STEP 3: Inventory Update (sales depletion & restock)
        // =============================================================
        const latestInventory = await prisma.inventorySnapshot.findFirst({
          where: { product_id: product.id },
          orderBy: { recorded_at: 'desc' }
        });

        const currentStock = latestInventory ? latestInventory.stock_level : 100;

        // Sales decrement based on demand index
        const unitsSold = Math.round((demandIndex / 10) * (Math.random() * 0.8 + 0.6));
        let newStock = Math.max(0, currentStock - unitsSold);

        // 10% chance of a restock shipment
        const isRestock = Math.random() < 0.10;
        if (isRestock) {
          const restockAmount = Math.floor(100 + Math.random() * 401); // Adds 100 to 500 units
          newStock += restockAmount;
        }

        await prisma.inventorySnapshot.create({
          data: {
            product_id: product.id,
            stock_level: newStock,
            restock_event: isRestock
          }
        });

        console.log(`[Simulation Engine] Updated ${product.name} (${product.sku}): Stock=${newStock}, Demand=${demandIndex}`);

        // =============================================================
        // STEP 4: Trigger AI Analysis (Optional)
        // =============================================================
        if (triggerAi) {
          // Fire and forget runOrchestratorPipeline, catching errors to avoid blocking other products
          runOrchestratorPipeline(product.id, RecommendationTrigger.MARKET_SIMULATION, product.org_id)
            .then((rec) => {
              console.log(`[Simulation AI Trigger] Finished AI pricing for ${product.name}. Status: ${rec.status}`);
            })
            .catch((err) => {
              console.error(`[Simulation AI Trigger] AI execution failed for ${product.name}:`, err.message);
            });
        }
      } catch (prodErr) {
        console.error(`[Simulation Engine] Product ${product.name} simulation error:`, prodErr);
      }
    }

    console.log('[Simulation Engine] Market simulation cycle finished.');
  } catch (globalErr) {
    console.error('[Simulation Engine] Global simulation cycle failure:', globalErr);
  }
}
