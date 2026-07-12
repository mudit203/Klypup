import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { CreateProductSchema } from '@klypup/shared';

// Helper to determine stock status from stock level
function getStockStatusLabel(stockLevel: number): 'in-stock' | 'low-stock' | 'out-of-stock' {
  if (stockLevel === 0) return 'out-of-stock';
  if (stockLevel <= 20) return 'low-stock';
  return 'in-stock';
}

/**
 * 1. getProducts
 * Fetches the list of products for the organization, with support for search, category filter, 
 * stock status filter, sorting, and pagination.
 */
export async function getProducts(req: Request, res: Response) {
  const orgId = req.orgId!;
  
  // Extract query parameters
  const search = req.query.search as string | undefined;
  const category = req.query.category as string | undefined;
  const stockStatus = req.query.stockStatus as string | undefined;
  const sortBy = (req.query.sortBy as string) || 'name';
  const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';
  
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  try {
    // 1. Build database where clause
    const whereClause: any = {
      org_id: orgId,
      is_active: true,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      whereClause.category = category;
    }

    // 2. Query products from DB (including latest inventory snapshot to calculate stock status)
    let products = await prisma.product.findMany({
      where: whereClause,
      include: {
        inventory_snapshots: {
          orderBy: { recorded_at: 'desc' },
          take: 1,
        },
      },
      orderBy: sortBy === 'stock' ? undefined : { [sortBy]: sortOrder },
    });

    // 3. Map products to include their current stock level and calculated stock status
    let mappedProducts = products.map((product) => {
      const latestSnapshot = product.inventory_snapshots[0];
      const stock = latestSnapshot ? latestSnapshot.stock_level : 0;
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        cost_of_goods: product.cost_of_goods,
        current_price: product.current_price,
        stock_level: stock,
        stock_status: getStockStatusLabel(stock),
        updated_at: product.updated_at,
      };
    });

    // 4. Apply stock status filter in memory (since stock level resides in snapshots table)
    if (stockStatus) {
      mappedProducts = mappedProducts.filter(p => p.stock_status === stockStatus);
    }

    // 5. Apply custom sorting for stock level if requested
    if (sortBy === 'stock') {
      mappedProducts.sort((a, b) => {
        return sortOrder === 'asc' ? a.stock_level - b.stock_level : b.stock_level - a.stock_level;
      });
    }

    // 6. Pagination
    const totalCount = mappedProducts.length;
    const paginatedProducts = mappedProducts.slice(skip, skip + limit);

    return res.json({
      products: paginatedProducts,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error('getProducts error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve products list',
      details: [error.message],
    });
  }
}

/**
 * 2. getProductById
 * Retrieves details for a specific product, including its latest market state (latest competitor prices and latest demand)
 */
export async function getProductById(req: Request, res: Response) {
  const { id } = req.params;
  const orgId = req.orgId!;

  try {
    const product = await prisma.product.findFirst({
      where: {
        id,
        org_id: orgId,
        is_active: true,
      },
      include: {
        inventory_snapshots: {
          orderBy: { recorded_at: 'desc' },
          take: 1,
        },
        competitor_prices: {
          orderBy: { recorded_at: 'desc' },
          take: 5, // Return recent competitor updates
        },
        demand_signals: {
          orderBy: { recorded_at: 'desc' },
          take: 1, // Return latest demand index
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        details: ['The requested product does not exist inside your organization'],
      });
    }

    const latestInventory = product.inventory_snapshots[0];
    const latestDemand = product.demand_signals[0];

    return res.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        cost_of_goods: product.cost_of_goods,
        current_price: product.current_price,
        stock_level: latestInventory ? latestInventory.stock_level : 0,
        stock_status: getStockStatusLabel(latestInventory ? latestInventory.stock_level : 0),
        latest_demand: latestDemand ? {
          demand_index: latestDemand.demand_index,
          trend: latestDemand.trend,
          updated_at: latestDemand.recorded_at,
        } : null,
        recent_competitors: product.competitor_prices.map(cp => ({
          competitor: cp.competitor,
          price: cp.price,
          event_type: cp.event_type,
          recorded_at: cp.recorded_at,
        })),
        updated_at: product.updated_at,
      },
    });
  } catch (error: any) {
    console.error('getProductById error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve product details',
      details: [error.message],
    });
  }
}

/**
 * 3. createProduct (Admin Only)
 * Registers a new product in the organization catalog and seeds an initial inventory snapshot.
 */
export async function createProduct(req: Request, res: Response) {
  const orgId = req.orgId!;
  const parseResult = CreateProductSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failure',
      details: parseResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
    });
  }

  const { name, sku, category, cost_of_goods, current_price } = parseResult.data;
  const initialStock = parseInt(req.body.initial_stock as string) || 0;

  try {
    // Check SKU duplicate within the organization
    const existingProduct = await prisma.product.findFirst({
      where: { org_id: orgId, sku },
    });

    if (existingProduct) {
      return res.status(400).json({
        error: 'Duplicate SKU',
        details: [`A product with SKU "${sku}" already exists in your organization catalog`],
      });
    }

    // Create product and seed its initial inventory snapshot in a transaction
    const newProduct = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          org_id: orgId,
          name,
          sku,
          category,
          cost_of_goods,
          current_price,
        },
      });

      await tx.inventorySnapshot.create({
        data: {
          product_id: prod.id,
          stock_level: initialStock,
          restock_event: initialStock > 0,
        },
      });

      return prod;
    });

    return res.status(201).json({
      message: 'Product created successfully',
      product: {
        ...newProduct,
        stock_level: initialStock,
        stock_status: getStockStatusLabel(initialStock),
      },
    });
  } catch (error: any) {
    console.error('createProduct error:', error);
    return res.status(500).json({
      error: 'Failed to create product',
      details: [error.message],
    });
  }
}

/**
 * 4. updateProduct (Admin Only)
 * Modifies an existing product's catalog details.
 */
export async function updateProduct(req: Request, res: Response) {
  const { id } = req.params;
  const orgId = req.orgId!;
  
  // We can validate partial updates since some fields might not be sent
  const name = req.body.name as string | undefined;
  const category = req.body.category as string | undefined;
  const cost_of_goods = req.body.cost_of_goods !== undefined ? parseFloat(req.body.cost_of_goods) : undefined;
  const current_price = req.body.current_price !== undefined ? parseFloat(req.body.current_price) : undefined;

  try {
    const product = await prisma.product.findFirst({
      where: { id, org_id: orgId, is_active: true },
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        details: ['The product to update could not be found in your organization'],
      });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name : product.name,
        category: category !== undefined ? category : product.category,
        cost_of_goods: cost_of_goods !== undefined ? cost_of_goods : product.cost_of_goods,
        current_price: current_price !== undefined ? current_price : product.current_price,
      },
    });

    return res.json({
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error: any) {
    console.error('updateProduct error:', error);
    return res.status(500).json({
      error: 'Failed to update product',
      details: [error.message],
    });
  }
}

/**
 * 5. deleteProduct (Admin Only)
 * Deletes a product logically by marking is_active = false.
 */
export async function deleteProduct(req: Request, res: Response) {
  const { id } = req.params;
  const orgId = req.orgId!;

  try {
    const product = await prisma.product.findFirst({
      where: { id, org_id: orgId, is_active: true },
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        details: ['The product to delete could not be found in your organization'],
      });
    }

    // Soft delete to protect referential integrity of audit logs/recommendations
    await prisma.product.update({
      where: { id },
      data: { is_active: false },
    });

    return res.json({
      message: 'Product deleted successfully',
      deleted_id: id,
    });
  } catch (error: any) {
    console.error('deleteProduct error:', error);
    return res.status(500).json({
      error: 'Failed to delete product',
      details: [error.message],
    });
  }
}

/**
 * 6. getPriceHistory
 * Returns our product's price history timeline for drawing charts
 */
export async function getPriceHistory(req: Request, res: Response) {
  const { id } = req.params;
  const orgId = req.orgId!;

  try {
    // Confirm product ownership
    const product = await prisma.product.findFirst({
      where: { id, org_id: orgId, is_active: true },
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        details: ['The requested product does not exist'],
      });
    }

    const history = await prisma.priceHistory.findMany({
      where: { product_id: id },
      orderBy: { changed_at: 'asc' },
    });

    return res.json({ history });
  } catch (error: any) {
    console.error('getPriceHistory error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve price history',
      details: [error.message],
    });
  }
}

/**
 * 7. getCompetitorPrices
 * Returns historical competitor prices for charting
 */
export async function getCompetitorPrices(req: Request, res: Response) {
  const { id } = req.params;
  const orgId = req.orgId!;

  try {
    const product = await prisma.product.findFirst({
      where: { id, org_id: orgId, is_active: true },
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        details: ['The requested product does not exist'],
      });
    }

    const competitorHistory = await prisma.competitorPrice.findMany({
      where: { product_id: id },
      orderBy: { recorded_at: 'asc' },
    });

    return res.json({ competitorHistory });
  } catch (error: any) {
    console.error('getCompetitorPrices error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve competitor pricing timeline',
      details: [error.message],
    });
  }
}

/**
 * 8. getDemandSignals
 * Returns demand index signals over time for charting
 */
export async function getDemandSignals(req: Request, res: Response) {
  const { id } = req.params;
  const orgId = req.orgId!;

  try {
    const product = await prisma.product.findFirst({
      where: { id, org_id: orgId, is_active: true },
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        details: ['The requested product does not exist'],
      });
    }

    const demandHistory = await prisma.demandSignal.findMany({
      where: { product_id: id },
      orderBy: { recorded_at: 'asc' },
    });

    return res.json({ demandHistory });
  } catch (error: any) {
    console.error('getDemandSignals error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve demand signals timeline',
      details: [error.message],
    });
  }
}
