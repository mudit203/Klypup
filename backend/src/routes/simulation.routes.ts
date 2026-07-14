import { Router, Request, Response } from 'express';
import { runSimulationCycle } from '../services/simulation.service';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { requireRole } from '../middleware/requireRole';
import { Role } from '@prisma/client';

const router = Router();

// Apply auth, tenant scoping, and restrict manually triggered simulation strictly to ADMINs
router.use(authenticate, tenantScope, requireRole(Role.ADMIN));

/**
 * POST /api/v1/simulation/run
 * Manually triggers a single "Market Day" simulation cycle.
 * Accepts optional query parameter: ?triggerAi=true
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const triggerAi = req.query.triggerAi === 'true';

    // Run simulation
    await runSimulationCycle(triggerAi);

    res.status(200).json({
      success: true,
      message: 'Market simulation day cycle completed successfully.'
    });
  } catch (err: any) {
    console.error('Simulation run endpoint error:', err);
    res.status(500).json({
      error: 'Failed to execute market simulation day',
      details: [err.message]
    });
  }
});

export default router;
