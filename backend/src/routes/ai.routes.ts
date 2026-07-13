import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { runOrchestratorPipeline } from '../services/orchestrator';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { RecommendationTrigger } from '@prisma/client';

const router = Router();

// Apply auth and tenant scoping globally
router.use(authenticate, tenantScope);

/**
 * POST /api/v1/ai-analysis/:productId/run
 * Triggers the 5-agent AI dynamic pricing analysis pipeline.
 */
router.post('/:productId/run', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const orgId = req.orgId;
    const userId = req.user?.userId;

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context is missing' });
    }

    // Run the pipeline (synchronously awaits completion, allowing parallel GET polls to read updates)
    const recommendation = await runOrchestratorPipeline(
      productId,
      RecommendationTrigger.MANUAL,
      orgId,
      userId
    );

    res.status(200).json({
      message: 'AI analysis completed successfully',
      recommendation
    });
  } catch (err: any) {
    console.error('AI analysis route crash:', err);
    res.status(500).json({
      error: 'AI analysis failed',
      message: err.message,
      retryable: true
    });
  }
});

/**
 * GET /api/v1/ai-analysis/:productId/latest
 * Retrieves the most recent pricing analysis recommendation and its agent outputs.
 */
router.get('/:productId/latest', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const orgId = req.orgId;

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context is missing' });
    }

    const latestRecommendation = await prisma.recommendation.findFirst({
      where: {
        product_id: productId,
        product: {
          org_id: orgId
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      include: {
        agent_outputs: {
          orderBy: {
            run_order: 'asc'
          }
        }
      }
    });

    res.status(200).json({
      recommendation: latestRecommendation
    });
  } catch (err: any) {
    console.error('Fetch latest analysis failed:', err);
    res.status(500).json({
      error: 'Failed to fetch latest analysis details'
    });
  }
});

export default router;
