import prisma from '../lib/prisma';
import { updateStorePrice } from '../lib/mockStore';
import { runMarketIntelligenceAgent } from './agents/marketIntelligence';
import { runDemandForecastingAgent } from './agents/demandForecasting';
import { runInventoryCostAgent } from './agents/inventoryCost';
import { runPricingStrategyAgent } from './agents/pricingStrategy';
import { runExecutionComplianceAgent } from './agents/executionCompliance';
import { RecommendationStatus, RecommendationTrigger, AgentName, AuditAction, PriceChangeSource } from '@prisma/client';

export async function runOrchestratorPipeline(
  productId: string,
  trigger: RecommendationTrigger,
  orgId: string,
  userId?: string
) {
  // 1. Fetch Product details
  const product = await prisma.product.findFirst({
    where: { id: productId, org_id: orgId, is_active: true }
  });

  if (!product) {
    throw new Error('Product not found or access denied');
  }

  // 2. Fetch last 30 days of market timelines
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const competitorPrices = await prisma.competitorPrice.findMany({
    where: { product_id: productId, recorded_at: { gte: thirtyDaysAgo } },
    orderBy: { recorded_at: 'desc' }
  });

  const demandHistory = await prisma.demandSignal.findMany({
    where: { product_id: productId, recorded_at: { gte: thirtyDaysAgo } },
    orderBy: { recorded_at: 'desc' }
  });

  const latestInventory = await prisma.inventorySnapshot.findFirst({
    where: { product_id: productId },
    orderBy: { recorded_at: 'desc' }
  });

  // 3. Fetch Organization settings and category margin floor
  const orgSettings = await prisma.orgSettings.findFirst({
    where: { org_id: orgId },
    include: { margin_floors: true }
  });

  if (!orgSettings) {
    throw new Error('Organization settings not found');
  }

  const categoryMarginFloor = orgSettings.margin_floors.find(
    (mf) => mf.category.toLowerCase() === product.category.toLowerCase()
  );
  const minMarginFloor = categoryMarginFloor ? categoryMarginFloor.min_margin : 0.0;

  // 4. Create Recommendation in PENDING state
  const recommendation = await prisma.recommendation.create({
    data: {
      product_id: productId,
      current_price: product.current_price,
      recommended_price: product.current_price, // fallback
      confidence_score: 0.0,
      status: RecommendationStatus.PENDING,
      trigger: trigger,
      rationale: 'Analysis is currently running...'
    }
  });

  // Helper to persist agent outputs on the fly matching the DB schema
  const saveAgentOutput = async (
    name: AgentName,
    order: number,
    summary: string,
    output: any,
    dataUsed: any
  ) => {
    return prisma.agentOutput.create({
      data: {
        recommendation_id: recommendation.id,
        agent_name: name,
        run_order: order,
        summary: summary,
        output: output || {},
        data_used: dataUsed || {}
      }
    });
  };

  try {
    // ==========================================
    // RUN AGENTS 1, 2, AND 3 IN PARALLEL
    // ==========================================
    const [agent1Data, agent2Data, agent3Data] = await Promise.all([
      // AGENT 1: Market Intelligence
      runMarketIntelligenceAgent(competitorPrices).then(async (data) => {
        await saveAgentOutput(
          AgentName.MARKET_INTELLIGENCE,
          1,
          data.summary,
          data,
          competitorPrices
        );
        return data;
      }),

      // AGENT 2: Demand Forecasting
      runDemandForecastingAgent(demandHistory, product.category).then(async (data) => {
        await saveAgentOutput(
          AgentName.DEMAND_FORECASTING,
          2,
          data.summary,
          data,
          demandHistory
        );
        return data;
      }),

      // AGENT 3: Inventory & Cost
      runInventoryCostAgent(
        latestInventory,
        product.cost_of_goods,
        product.current_price,
        minMarginFloor
      ).then(async (data) => {
        const agent3InputSnapshot = {
          latest_inventory: latestInventory,
          cost_of_goods: product.cost_of_goods,
          current_price: product.current_price,
          min_margin_floor: minMarginFloor
        };
        await saveAgentOutput(
          AgentName.INVENTORY_COST,
          3,
          data.summary,
          data,
          agent3InputSnapshot
        );
        return data;
      })
    ]);

    // ==========================================
    // AGENT 4: Pricing Strategy (Sequential)
    // ==========================================
    const agent4Data = await runPricingStrategyAgent(
      product.name,
      product.current_price,
      agent1Data,
      agent2Data,
      agent3Data
    );
    const agent4InputSnapshot = {
      current_price: product.current_price,
      agent1: agent1Data,
      agent2: agent2Data,
      agent3: agent3Data
    };
    await saveAgentOutput(
      AgentName.PRICING_STRATEGY,
      4,
      agent4Data.summary,
      agent4Data,
      agent4InputSnapshot
    );

    // ==========================================
    // AGENT 5: Execution Compliance (Sequential)
    // ==========================================
    const agent5Data = runExecutionComplianceAgent(
      agent4Data,
      orgSettings.confidence_threshold,
      agent3Data.margin_floor_violated
    );
    const agent5InputSnapshot = {
      confidence_threshold: orgSettings.confidence_threshold,
      margin_floor_violated: agent3Data.margin_floor_violated,
      strategy_recommendation: agent4Data
    };
    await saveAgentOutput(
      AgentName.EXECUTION_COMPLIANCE,
      5,
      agent5Data.summary,
      agent5Data,
      agent5InputSnapshot
    );

    // ==========================================
    // UPDATE RECOMMENDATION DETAILS & COMPLY
    // ==========================================
    const finalPrice = agent4Data.recommended_price;
    const finalConfidence = agent4Data.confidence_score;
    const finalRationale = agent4Data.rationale;

    let finalStatus: RecommendationStatus = RecommendationStatus.PENDING;
    let storeUpdateOk: boolean | null = null;

    if (agent5Data.decision === 'BLOCK') {
      finalStatus = RecommendationStatus.FAILED;
      
      const updatedRec = await prisma.recommendation.update({
        where: { id: recommendation.id },
        data: {
          recommended_price: finalPrice,
          confidence_score: finalConfidence,
          status: finalStatus,
          rationale: `${finalRationale} (Blocked: ${agent5Data.decision_reason})`
        }
      });

      // Write Audit Log for rejection
      await prisma.auditLog.create({
        data: {
          org_id: orgId,
          user_id: userId || null,
          recommendation_id: recommendation.id,
          action: AuditAction.PRICE_REJECTED,
          old_price: product.current_price,
          new_price: finalPrice,
          product_id: productId,
          product_name: product.name,
          notes: `Analysis run resulted in BLOCK. Reason: ${agent5Data.decision_reason}`
        }
      });

      return updatedRec;
    }

    if (agent5Data.decision === 'QUEUE_FOR_REVIEW') {
      finalStatus = RecommendationStatus.PENDING;

      const updatedRec = await prisma.recommendation.update({
        where: { id: recommendation.id },
        data: {
          recommended_price: finalPrice,
          confidence_score: finalConfidence,
          status: finalStatus,
          rationale: finalRationale
        }
      });

      // Write Audit Log for triggered human review
      await prisma.auditLog.create({
        data: {
          org_id: orgId,
          user_id: userId || null,
          recommendation_id: recommendation.id,
          action: AuditAction.ANALYSIS_TRIGGERED,
          old_price: product.current_price,
          new_price: finalPrice,
          product_id: productId,
          product_name: product.name,
          notes: `Recommendation queued for review. Confidence: ${finalConfidence}% (threshold is ${orgSettings.confidence_threshold * 100}%)`
        }
      });

      return updatedRec;
    }

    if (agent5Data.decision === 'AUTO_EXECUTE') {
      // Connect to the storefront simulator
      const storeUpdate = await updateStorePrice(productId, finalPrice);
      storeUpdateOk = storeUpdate.success;

      if (storeUpdateOk) {
        finalStatus = RecommendationStatus.AUTO_EXECUTED;

        // Transaction: update product current price, save price history, update recommendation
        const updatedRec = await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id: productId },
            data: { current_price: finalPrice }
          });

          await tx.priceHistory.create({
            data: {
              product_id: productId,
              old_price: product.current_price,
              new_price: finalPrice,
              change_source: PriceChangeSource.AI_AUTO_EXECUTED,
              recommendation_id: recommendation.id
            }
          });

          return tx.recommendation.update({
            where: { id: recommendation.id },
            data: {
              recommended_price: finalPrice,
              confidence_score: finalConfidence,
              status: finalStatus,
              rationale: finalRationale,
              store_update_ok: true
            }
          });
        });

        // Write Audit Log for successful auto execution
        await prisma.auditLog.create({
          data: {
            org_id: orgId,
            user_id: userId || null,
            recommendation_id: recommendation.id,
            action: AuditAction.PRICE_AUTO_EXECUTED,
            old_price: product.current_price,
            new_price: finalPrice,
            product_id: productId,
            product_name: product.name,
            notes: `Price automatically updated to $${finalPrice.toFixed(2)}. Confidence: ${finalConfidence}%`
          }
        });

        return updatedRec;
      } else {
        finalStatus = RecommendationStatus.FAILED;

        const updatedRec = await prisma.recommendation.update({
          where: { id: recommendation.id },
          data: {
            recommended_price: finalPrice,
            confidence_score: finalConfidence,
            status: finalStatus,
            rationale: `${finalRationale} (Store update failed)`,
            store_update_ok: false
          }
        });

        // Write Audit Log for failed storefront update
        await prisma.auditLog.create({
          data: {
            org_id: orgId,
            user_id: userId || null,
            recommendation_id: recommendation.id,
            action: AuditAction.STORE_UPDATE_FAILED,
            old_price: product.current_price,
            new_price: finalPrice,
            product_id: productId,
            product_name: product.name,
            notes: `Auto-execution aborted: external storefront API price update failed.`
          }
        });

        return updatedRec;
      }
    }

    throw new Error('Compliance agent returned an invalid execution decision');

  } catch (err: any) {
    console.error('Orchestrator run crash:', err);

    // Save error state in AgentOutput to notify frontend
    const orderIndex = await prisma.agentOutput.count({
      where: { recommendation_id: recommendation.id }
    });
    
    await saveAgentOutput(
      AgentName.EXECUTION_COMPLIANCE,
      orderIndex + 1,
      `AI pipeline execution failed: ${err.message}`,
      { error: true, message: err.message },
      {}
    ).catch(() => {});

    // Update recommendation as FAILED
    await prisma.recommendation.update({
      where: { id: recommendation.id },
      data: { status: RecommendationStatus.FAILED }
    }).catch(() => {});

    // Write Audit Log for analysis failure
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        user_id: userId || null,
        recommendation_id: recommendation.id,
        action: AuditAction.ANALYSIS_FAILED,
        old_price: product.current_price,
        new_price: product.current_price,
        product_id: productId,
        product_name: product.name,
        notes: `AI agent execution failed: ${err.message}`
      }
    }).catch(() => {});

    throw err;
  }
}
