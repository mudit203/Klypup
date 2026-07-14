import { Router } from 'express';
import { 
  getRecommendations, 
  getRecommendationById, 
  approveRecommendation, 
  modifyRecommendation, 
  rejectRecommendation 
} from '../controllers/recommendation.controller';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';

const router = Router();

// Apply auth and tenant scoping globally to all recommendation endpoints
router.use(authenticate, tenantScope);

router.get('/', getRecommendations);
router.get('/:id', getRecommendationById);
router.post('/:id/approve', approveRecommendation);
router.post('/:id/modify', modifyRecommendation);
router.post('/:id/reject', rejectRecommendation);

export default router;
