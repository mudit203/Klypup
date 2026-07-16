import { Router } from 'express';
import {
  getOrgSettings,
  updateConfidenceThreshold,
  addMarginFloor,
  deleteMarginFloor,
  getOrgUsers,
  inviteOrgUser,
  changeUserRole,
  removeOrgUser
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { requireRole } from '../middleware/requireRole';
import { Role } from '@prisma/client';

const router = Router();

// Force auth, tenant scoping, and strictly require the ADMIN role globally
router.use(authenticate, tenantScope, requireRole(Role.ADMIN));

// Settings and Margin Floors Endpoints
router.get('/settings', getOrgSettings);
router.patch('/settings', updateConfidenceThreshold);
router.post('/settings/margin-floors', addMarginFloor);
router.delete('/settings/margin-floors/:id', deleteMarginFloor);

// User Management Endpoints
router.get('/users', getOrgUsers);
router.post('/users/invite', inviteOrgUser);
router.patch('/users/:id/role', changeUserRole);
router.delete('/users/:id', removeOrgUser);

export default router;
