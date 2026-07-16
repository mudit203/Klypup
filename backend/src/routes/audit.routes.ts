import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';

const router = Router();

// Apply token auth and tenant scoping globally to all audit endpoints
router.use(authenticate, tenantScope);

router.get('/', getAuditLogs);

export default router;
