import { Router } from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getPriceHistory,
  getCompetitorPrices,
  getDemandSignals 
} from '../controllers/product.controller';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { requireRole } from '../middleware/requireRole';
import { Role } from '@prisma/client';

const router = Router();

// Apply authentication and tenant isolation to all product catalog endpoints
router.use(authenticate, tenantScope);

// Common reader routes (available to both ADMIN and ANALYST)
router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/:id/price-history', getPriceHistory);
router.get('/:id/competitor-prices', getCompetitorPrices);
router.get('/:id/demand-signals', getDemandSignals);

// Catalog management routes (Guarded: strictly requires ADMIN clearance)
router.post('/', requireRole(Role.ADMIN), createProduct);
router.patch('/:id', requireRole(Role.ADMIN), updateProduct);
router.delete('/:id', requireRole(Role.ADMIN), deleteProduct);

export default router;
