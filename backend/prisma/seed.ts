import { PrismaClient, Role, CompetitorPriceEvent, DemandTrend, PriceChangeSource, RecommendationStatus, RecommendationTrigger, AgentName, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'process';


const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('Cleaning database...');
  await prisma.auditLog.deleteMany();
  await prisma.agentOutput.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.inventorySnapshot.deleteMany();
  await prisma.demandSignal.deleteMany();
  await prisma.competitorPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.marginFloor.deleteMany();
  await prisma.orgSettings.deleteMany();
  await prisma.org.deleteMany();
  console.log('Database cleaned.');
}

async function main() {
  await cleanDatabase();

  console.log('Seeding baseline data...');

  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  // 1. TechMart Inc. Organization Setup
  const techMart = await prisma.org.create({
    data: {
      name: 'TechMart Inc.',
      settings: {
        create: {
          confidence_threshold: 0.80,
          margin_floors: {
            createMany: {
              data: [
                { category: 'Electronics', min_margin: 0.15 },
                { category: 'Sports & Outdoors', min_margin: 0.20 }
              ]
            }
          }
        }
      }
    },
    include: {
      settings: {
        include: {
          margin_floors: true
        }
      }
    }
  });

  // TechMart Users
  const techMartAdmin = await prisma.user.create({
    data: {
      org_id: techMart.id,
      email: 'admin@techmart.com',
      password_hash: passwordHash,
      name: 'TechMart Admin',
      role: Role.ADMIN
    }
  });

  const techMartAnalyst = await prisma.user.create({
    data: {
      org_id: techMart.id,
      email: 'analyst@techmart.com',
      password_hash: passwordHash,
      name: 'TechMart Analyst',
      role: Role.ANALYST
    }
  });

  // 2. StyleZone Organization Setup
  const styleZone = await prisma.org.create({
    data: {
      name: 'StyleZone',
      settings: {
        create: {
          confidence_threshold: 0.75,
          margin_floors: {
            createMany: {
              data: [
                { category: 'Clothing', min_margin: 0.25 },
                { category: 'Home & Kitchen', min_margin: 0.18 }
              ]
            }
          }
        }
      }
    },
    include: {
      settings: {
        include: {
          margin_floors: true
        }
      }
    }
  });

  // StyleZone Users
  const styleZoneAdmin = await prisma.user.create({
    data: {
      org_id: styleZone.id,
      email: 'admin@stylezone.com',
      password_hash: passwordHash,
      name: 'StyleZone Admin',
      role: Role.ADMIN
    }
  });

  const styleZoneAnalyst = await prisma.user.create({
    data: {
      org_id: styleZone.id,
      email: 'analyst@stylezone.com',
      password_hash: passwordHash,
      name: 'StyleZone Analyst',
      role: Role.ANALYST
    }
  });

  console.log('Organizations and users seeded.');

  // 3. Products Catalog Setup
  // TechMart Products
  const sonyHeadphones = await prisma.product.create({
    data: {
      org_id: techMart.id,
      name: 'Sony WH-1000XM5',
      sku: 'SONY-WH1000XM5',
      category: 'Electronics',
      cost_of_goods: 250.0,
      current_price: 399.0
    }
  });

  const cheapCable = await prisma.product.create({
    data: {
      org_id: techMart.id,
      name: 'Cheap USB Cable',
      sku: 'USB-C-CHEAP',
      category: 'Electronics',
      cost_of_goods: 2.0,
      current_price: 3.50
    }
  });

  const runningShoes = await prisma.product.create({
    data: {
      org_id: techMart.id,
      name: 'Running Shoes X-100',
      sku: 'RUN-SHOES-X100',
      category: 'Sports & Outdoors',
      cost_of_goods: 60.0,
      current_price: 100.0
    }
  });

  const fitbitTracker = await prisma.product.create({
    data: {
      org_id: techMart.id,
      name: 'FitBit Charge 6',
      sku: 'FITBIT-CH6',
      category: 'Electronics',
      cost_of_goods: 90.0,
      current_price: 159.99
    }
  });

  const campingTent = await prisma.product.create({
    data: {
      org_id: techMart.id,
      name: 'Camping Tent 4-Person',
      sku: 'CAMP-TENT-4P',
      category: 'Sports & Outdoors',
      cost_of_goods: 120.0,
      current_price: 199.99
    }
  });

  // StyleZone Products
  const seasonalJacket = await prisma.product.create({
    data: {
      org_id: styleZone.id,
      name: 'Seasonal Jacket Warmth',
      sku: 'SZ-JACKET-WARM',
      category: 'Clothing',
      cost_of_goods: 80.0,
      current_price: 150.0
    }
  });

  const cottonTshirt = await prisma.product.create({
    data: {
      org_id: styleZone.id,
      name: 'Cotton T-Shirt Basic',
      sku: 'SZ-TSHIRT-BASIC',
      category: 'Clothing',
      cost_of_goods: 8.0,
      current_price: 24.99
    }
  });

  const denimJeans = await prisma.product.create({
    data: {
      org_id: styleZone.id,
      name: 'Denim Jeans Premium',
      sku: 'SZ-JEANS-PREM',
      category: 'Clothing',
      cost_of_goods: 25.0,
      current_price: 59.99
    }
  });

  const coffeeMug = await prisma.product.create({
    data: {
      org_id: styleZone.id,
      name: 'Smart Coffee Mug',
      sku: 'SZ-MUG-SMART',
      category: 'Home & Kitchen',
      cost_of_goods: 5.0,
      current_price: 14.99
    }
  });

  const fryingPan = await prisma.product.create({
    data: {
      org_id: styleZone.id,
      name: 'Non-Stick Frying Pan',
      sku: 'SZ-PAN-NONSTICK',
      category: 'Home & Kitchen',
      cost_of_goods: 30.0,
      current_price: 59.99
    }
  });

  const productsList = [
    sonyHeadphones, cheapCable, runningShoes, fitbitTracker, campingTent,
    seasonalJacket, cottonTshirt, denimJeans, coffeeMug, fryingPan
  ];

  console.log('Products catalog seeded.');

  // 4. Generating 30 Days of Historical Data (Competitors, Demand, Inventory)
  console.log('Generating 30 days of historical data (this may take a few seconds)...');
  const now = new Date();

  for (const product of productsList) {
    const isTechMart = product.org_id === techMart.id;
    const competitors = isTechMart ? ['Amazon', 'BestBuy'] : ['Macy\'s', 'Target'];

    for (let i = 30; i >= 1; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);

      // Inventory snapshots (decrementing stock, periodic restocks)
      const isRestockDay = i % 10 === 0;
      let stockLevel = Math.max(10, 200 - (30 - i) * 5 + (Math.sin(i) * 15));
      if (isRestockDay) stockLevel += 100;
      
      // Override for the specific "low stock" scenario later
      if (product.sku === 'RUN-SHOES-X100' && i === 1) {
        stockLevel = 12; // Scenario 4 requires stock < 20
      }

      await prisma.inventorySnapshot.create({
        data: {
          product_id: product.id,
          stock_level: Math.round(stockLevel),
          restock_event: isRestockDay,
          recorded_at: date
        }
      });

      // Demand Signals
      let demandIndex = 50 + (Math.sin(i / 2) * 20) + (Math.random() * 10);
      let trend: DemandTrend = DemandTrend.STABLE;

      if (product.category === 'Clothing' && i < 10) {
        // Simulating falling season demand change
        demandIndex -= 15;
        trend = DemandTrend.SEASONAL_DIP;
      } else if (product.sku === 'RUN-SHOES-X100' && i < 5) {
        // Scenario 4 requires rising demand
        demandIndex += 25;
        trend = DemandTrend.RISING;
      }

      await prisma.demandSignal.create({
        data: {
          product_id: product.id,
          demand_index: parseFloat(demandIndex.toFixed(2)),
          trend: trend,
          notes: i < 5 ? 'High traffic anomaly detected' : null,
          recorded_at: date
        }
      });

      // Competitor Prices
      for (const competitor of competitors) {
        let variance = (Math.sin(i) * 0.03) + (Math.random() * 0.02 - 0.01); // baseline fluctuation ± 4%
        let competitorPrice = product.current_price * (1 + variance);
        let event: CompetitorPriceEvent = CompetitorPriceEvent.NO_CHANGE;

        if (Math.abs(variance) > 0.03) {
          event = CompetitorPriceEvent.SMALL_FLUCTUATION;
        }

        // Specific drop for Sony Headphones on last day
        if (product.sku === 'SONY-WH1000XM5' && i === 1 && competitor === 'Amazon') {
          competitorPrice = product.current_price * 0.78; // -22% drop
          event = CompetitorPriceEvent.PRICE_DROP;
        }

        await prisma.competitorPrice.create({
          data: {
            product_id: product.id,
            competitor: competitor,
            price: parseFloat(competitorPrice.toFixed(2)),
            event_type: event,
            recorded_at: date
          }
        });
      }
    }
  }

  console.log('Historical timelines generated.');

  // 5. Seeding Specific Demo Scenarios

  console.log('Seeding Demo Scenario 1: Amazon Price Drop (Sony WH-1000XM5)...');
  // Scenario 1: Auto-executed drop
  const rec1 = await prisma.recommendation.create({
    data: {
      product_id: sonyHeadphones.id,
      current_price: 399.0,
      recommended_price: 327.18, // -18%
      confidence_score: 0.87,
      status: RecommendationStatus.AUTO_EXECUTED,
      trigger: RecommendationTrigger.MARKET_SIMULATION,
      rationale: 'Amazon dropped price by 22%. Matching with 18% reduction to preserve margins and stay competitive while beating the 15% margin floor.',
      store_update_ok: true,
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
    }
  });

  await prisma.agentOutput.createMany({
    data: [
      {
        recommendation_id: rec1.id,
        agent_name: AgentName.MARKET_INTELLIGENCE,
        summary: 'Detected a notable price drop event of -22% by Amazon. Competitor pricing trend is downward.',
        data_used: { current_price: 399.0, competitor: 'Amazon', competitor_price: 311.22, change: '-22%' },
        output: { competitor_trend: 'DOWN', biggest_competitor: 'Amazon', biggest_price_delta_pct: -22.0, notable_event: true },
        run_order: 1
      },
      {
        recommendation_id: rec1.id,
        agent_name: AgentName.DEMAND_FORECASTING,
        summary: 'Demand is stable with minor seasonal fluctuations. Price elasticity allows a defensive markdown.',
        data_used: { trend: 'STABLE', average_demand_index: 55.4 },
        output: { demand_direction: 'STABLE', seasonality_factor: 'NEUTRAL', pricing_implication: 'HOLD' },
        run_order: 2
      },
      {
        recommendation_id: rec1.id,
        agent_name: AgentName.INVENTORY_COST,
        summary: 'Stock status is normal. Margin floor is 15%. A markdown to $327.18 yields a 30.8% margin, which is safe.',
        data_used: { cost_of_goods: 250.0, recommended_price: 327.18, min_margin: 0.15 },
        output: { stock_status: 'NORMAL', current_margin_pct: 37.3, recommended_margin_pct: 30.8, margin_floor_violated: false },
        run_order: 3
      },
      {
        recommendation_id: rec1.id,
        agent_name: AgentName.PRICING_STRATEGY,
        summary: 'Recommend price adjustment to $327.18 with high confidence (87%). Helps maintain market share without violating profit limits.',
        data_used: { input_price: 399.0, margin_check: 'PASS', competitor_drop: 'Amazon -22%' },
        output: { recommended_price: 327.18, confidence_score: 87.0 },
        run_order: 4
      },
      {
        recommendation_id: rec1.id,
        agent_name: AgentName.EXECUTION_COMPLIANCE,
        summary: 'Confidence score (87%) is above the OrgSettings threshold of 80%. No margin floor violation detected. Automatically executing storefront price update.',
        data_used: { confidence_score: 87, threshold: 80, margin_violated: false },
        output: { decision: 'AUTO_EXECUTE', margin_check_passed: true, confidence_check_passed: true },
        run_order: 5
      }
    ]
  });

  // Apply actual price history record and update product current price
  await prisma.priceHistory.create({
    data: {
      product_id: sonyHeadphones.id,
      old_price: 399.0,
      new_price: 327.18,
      change_source: PriceChangeSource.AI_AUTO_EXECUTED,
      recommendation_id: rec1.id
    }
  });

  await prisma.product.update({
    where: { id: sonyHeadphones.id },
    data: { current_price: 327.18 }
  });

  await prisma.auditLog.create({
    data: {
      org_id: techMart.id,
      action: AuditAction.PRICE_AUTO_EXECUTED,
      recommendation_id: rec1.id,
      old_price: 399.0,
      new_price: 327.18,
      product_id: sonyHeadphones.id,
      product_name: sonyHeadphones.name,
      notes: 'AI auto-executed price drop of 18% in response to Amazon -22% drop.'
    }
  });

  console.log('Seeding Demo Scenario 2: Margin Floor Violation (Cheap USB Cable)...');
  // Scenario 2: Blocked price drop
  const rec2 = await prisma.recommendation.create({
    data: {
      product_id: cheapCable.id,
      current_price: 3.50,
      recommended_price: 2.10, // Cost is 2.0, so this margin is (2.1 - 2.0)/2.0 = 5% which is < 15% floor (min price is 2.3)
      confidence_score: 0.92,
      status: RecommendationStatus.FAILED,
      trigger: RecommendationTrigger.MARKET_SIMULATION,
      rationale: 'Competitor price drops to $2.00 suggest lowering to $2.10, but this violates our 15% category margin floor.',
      store_update_ok: false,
      created_at: new Date(now.getTime() - 90 * 60 * 1000) // 1.5 hours ago
    }
  });

  await prisma.agentOutput.createMany({
    data: [
      {
        recommendation_id: rec2.id,
        agent_name: AgentName.MARKET_INTELLIGENCE,
        summary: 'Competitors have dropped prices to $2.00 for similar generic cables.',
        data_used: { competitor_price: 2.00 },
        output: { competitor_trend: 'DOWN', biggest_competitor: 'BestBuy', biggest_price_delta_pct: -30.0, notable_event: true },
        run_order: 1
      },
      {
        recommendation_id: rec2.id,
        agent_name: AgentName.DEMAND_FORECASTING,
        summary: 'Demand for cables remains high.',
        data_used: {},
        output: { demand_direction: 'STABLE', seasonality_factor: 'NEUTRAL', pricing_implication: 'HOLD' },
        run_order: 2
      },
      {
        recommendation_id: rec2.id,
        agent_name: AgentName.INVENTORY_COST,
        summary: 'Margin check failed. A price of $2.10 yields a 5% margin, which is below the category floor of 15% ($2.30). Violation detected!',
        data_used: { cost_of_goods: 2.0, recommended_price: 2.10, min_margin: 0.15 },
        output: { stock_status: 'NORMAL', current_margin_pct: 75.0, recommended_margin_pct: 5.0, margin_floor_violated: true },
        run_order: 3
      },
      {
        recommendation_id: rec2.id,
        agent_name: AgentName.PRICING_STRATEGY,
        summary: 'Match competitor at $2.10 to prevent inventory buildup, but mark for compliance check.',
        data_used: {},
        output: { recommended_price: 2.10, confidence_score: 92.0 },
        run_order: 4
      },
      {
        recommendation_id: rec2.id,
        agent_name: AgentName.EXECUTION_COMPLIANCE,
        summary: 'COMPLIANCE VIOLATION: Execution blocked because the recommended price ($2.10) breaks the category margin floor of 15%.',
        data_used: { confidence_score: 92, threshold: 80, margin_violated: true },
        output: { decision: 'BLOCK', margin_check_passed: false, confidence_check_passed: true },
        run_order: 5
      }
    ]
  });

  await prisma.auditLog.create({
    data: {
      org_id: techMart.id,
      action: AuditAction.ANALYSIS_FAILED,
      recommendation_id: rec2.id,
      product_id: cheapCable.id,
      product_name: cheapCable.name,
      notes: 'AI analysis failed: Price change blocked by margin compliance checks.'
    }
  });

  console.log('Seeding Demo Scenario 3: Human Review Required (Seasonal Jacket)...');
  // Scenario 3: Queued for human review
  const rec3 = await prisma.recommendation.create({
    data: {
      product_id: seasonalJacket.id,
      current_price: 150.0,
      recommended_price: 145.0,
      confidence_score: 0.55, // StyleZone threshold is 75%
      status: RecommendationStatus.PENDING,
      trigger: RecommendationTrigger.MARKET_SIMULATION,
      rationale: 'Mixed signals: Competitor price rises slightly (+3%), but overall demand index is falling (-15%) due to seasonal transition. Recommending mild markdown to clear stock.',
      created_at: new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
    }
  });

  await prisma.agentOutput.createMany({
    data: [
      {
        recommendation_id: rec3.id,
        agent_name: AgentName.MARKET_INTELLIGENCE,
        summary: 'Competitors have raised prices slightly to $155.',
        data_used: { competitor_price: 155.0 },
        output: { competitor_trend: 'UP', biggest_competitor: 'Macy\'s', biggest_price_delta_pct: 3.33, notable_event: false },
        run_order: 1
      },
      {
        recommendation_id: rec3.id,
        agent_name: AgentName.DEMAND_FORECASTING,
        summary: 'Seasonality shift detected: Demand index fell by 15% this week.',
        data_used: { demand_trend: 'FALLING' },
        output: { demand_direction: 'DOWN', seasonality_factor: 'DIP', pricing_implication: 'DECREASE' },
        run_order: 2
      },
      {
        recommendation_id: rec3.id,
        agent_name: AgentName.INVENTORY_COST,
        summary: 'Inventory level normal, margin remains high (44%).',
        data_used: { cost_of_goods: 80.0, recommended_price: 145.0, min_margin: 0.25 },
        output: { stock_status: 'NORMAL', current_margin_pct: 87.5, recommended_margin_pct: 81.25, margin_floor_violated: false },
        run_order: 3
      },
      {
        recommendation_id: rec3.id,
        agent_name: AgentName.PRICING_STRATEGY,
        summary: 'Conflicting inputs (competitor price UP vs demand DOWN) results in low confidence recommendation of $145.',
        data_used: {},
        output: { recommended_price: 145.0, confidence_score: 55.0 },
        run_order: 4
      },
      {
        recommendation_id: rec3.id,
        agent_name: AgentName.EXECUTION_COMPLIANCE,
        summary: 'AI confidence score (55%) is below StyleZone threshold (75%). Queued for human review.',
        data_used: { confidence_score: 55, threshold: 75, margin_violated: false },
        output: { decision: 'QUEUE_FOR_REVIEW', margin_check_passed: true, confidence_check_passed: false },
        run_order: 5
      }
    ]
  });

  await prisma.auditLog.create({
    data: {
      org_id: styleZone.id,
      action: AuditAction.ANALYSIS_TRIGGERED,
      recommendation_id: rec3.id,
      product_id: seasonalJacket.id,
      product_name: seasonalJacket.name,
      notes: 'AI analysis generated recommendation. Queued for human review (confidence 55% < threshold 75%).'
    }
  });

  console.log('Seeding Demo Scenario 4: High Demand / Low Stock (Running Shoes)...');
  // Scenario 4: Low stock and high demand
  const rec4 = await prisma.recommendation.create({
    data: {
      product_id: runningShoes.id,
      current_price: 100.0,
      recommended_price: 115.0, // +15% price increase
      confidence_score: 0.72, // TechMart threshold is 80%
      status: RecommendationStatus.PENDING,
      trigger: RecommendationTrigger.MARKET_SIMULATION,
      rationale: 'Critical stock alert (only 12 units remaining) combined with rising demand signals (+25%). Recommending 15% price increase to optimize margin and slow sales velocity until restock.',
      created_at: new Date(now.getTime() - 30 * 60 * 1000) // 30 mins ago
    }
  });

  await prisma.agentOutput.createMany({
    data: [
      {
        recommendation_id: rec4.id,
        agent_name: AgentName.MARKET_INTELLIGENCE,
        summary: 'Competitor pricing is stable at $100.',
        data_used: { competitor_price: 100.0 },
        output: { competitor_trend: 'STABLE', biggest_competitor: 'Amazon', biggest_price_delta_pct: 0.0, notable_event: false },
        run_order: 1
      },
      {
        recommendation_id: rec4.id,
        agent_name: AgentName.DEMAND_FORECASTING,
        summary: 'Strong demand signals (+25% views).',
        data_used: { demand_trend: 'RISING' },
        output: { demand_direction: 'UP', seasonality_factor: 'PEAK', pricing_implication: 'INCREASE' },
        run_order: 2
      },
      {
        recommendation_id: rec4.id,
        agent_name: AgentName.INVENTORY_COST,
        summary: 'CRITICAL WARNING: Stock is low (12 units). Increase price to conserve inventory.',
        data_used: { cost_of_goods: 60.0, stock_level: 12 },
        output: { stock_status: 'LOW', current_margin_pct: 66.67, recommended_margin_pct: 91.67, margin_floor_violated: false },
        run_order: 3
      },
      {
        recommendation_id: rec4.id,
        agent_name: AgentName.PRICING_STRATEGY,
        summary: 'Synthesizing inventory shortage and high demand. Recommend raising price to $115 with 72% confidence.',
        data_used: {},
        output: { recommended_price: 115.0, confidence_score: 72.0 },
        run_order: 4
      },
      {
        recommendation_id: rec4.id,
        agent_name: AgentName.EXECUTION_COMPLIANCE,
        summary: 'AI confidence score (72%) is below TechMart threshold (80%). Queued for human review.',
        data_used: { confidence_score: 72, threshold: 80, margin_violated: false },
        output: { decision: 'QUEUE_FOR_REVIEW', margin_check_passed: true, confidence_check_passed: false },
        run_order: 5
      }
    ]
  });

  await prisma.auditLog.create({
    data: {
      org_id: techMart.id,
      action: AuditAction.ANALYSIS_TRIGGERED,
      recommendation_id: rec4.id,
      product_id: runningShoes.id,
      product_name: runningShoes.name,
      notes: 'AI analysis generated recommendation. Queued for human review (confidence 72% < threshold 80%).'
    }
  });

  console.log('Seeding completed successfully! All baseline organizations, users, products, timelines, and demo scenarios are live.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
