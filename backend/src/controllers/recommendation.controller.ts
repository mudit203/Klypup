import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { updateStorePrice } from '../lib/mockStore';
import { RecommendationStatus, AuditAction, PriceChangeSource } from '@prisma/client';
import { ModifyPriceSchema, RejectSchema } from '@klypup/shared';

/**
 * GET /api/v1/recommendations
 * Lists recommendations scoped to the tenant, sorted by confidence score DESC.
 * Supports status filtering via query parameter: ?status=PENDING
 */
export async function getRecommendations(req: Request, res: Response) {
  try {
    const orgId = req.orgId;
    const { status } = req.query;

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context is missing' });
    }

    const recommendations = await prisma.recommendation.findMany({
      where: {
        product: {
          org_id: orgId,
          is_active: true
        },
        status: status ? (status as RecommendationStatus) : undefined
      },
      include: {
        product: true
      },
      orderBy: {
        confidence_score: 'desc'
      }
    });

    res.status(200).json({ recommendations });
  } catch (err: any) {
    console.error('getRecommendations error:', err);
    res.status(500).json({ error: 'Failed to fetch recommendations list' });
  }
}

/**
 * GET /api/v1/recommendations/:id
 * Retrieves a single recommendation by ID, including its agent outputs.
 */
export async function getRecommendationById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.orgId;

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context is missing' });
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        product: {
          org_id: orgId
        }
      },
      include: {
        product: true,
        agent_outputs: {
          orderBy: {
            run_order: 'asc'
          }
        }
      }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.status(200).json({ recommendation });
  } catch (err: any) {
    console.error('getRecommendationById error:', err);
    res.status(500).json({ error: 'Failed to fetch recommendation details' });
  }
}

/**
 * POST /api/v1/recommendations/:id/approve
 * Approves a pending recommendation, applying the AI suggested price.
 */
export async function approveRecommendation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.orgId;
    const userId = req.user?.userId;

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context is missing' });
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        product: {
          org_id: orgId
        }
      },
      include: {
        product: true
      }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    if (recommendation.status !== RecommendationStatus.PENDING) {
      return res.status(400).json({ error: 'Only pending recommendations can be approved' });
    }

    const product = recommendation.product;
    const finalPrice = recommendation.recommended_price;

    // Trigger the mock storefront price update
    const storeUpdate = await updateStorePrice(product.id, finalPrice);

    if (storeUpdate.success) {
      // Transaction to apply the approved price and history
      const updatedRec = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product.id },
          data: { current_price: finalPrice }
        });

        await tx.priceHistory.create({
          data: {
            product_id: product.id,
            old_price: recommendation.current_price,
            new_price: finalPrice,
            change_source: PriceChangeSource.ANALYST_APPROVED,
            recommendation_id: recommendation.id
          }
        });

        return tx.recommendation.update({
          where: { id: recommendation.id },
          data: {
            status: RecommendationStatus.APPROVED,
            store_update_ok: true
          }
        });
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          org_id: orgId,
          user_id: userId || null,
          recommendation_id: recommendation.id,
          action: AuditAction.PRICE_APPROVED,
          old_price: recommendation.current_price,
          new_price: finalPrice,
          product_id: product.id,
          product_name: product.name,
          notes: `AI price recommendation ($${finalPrice.toFixed(2)}) approved manually by analyst.`
        }
      });

      return res.status(200).json({
        message: 'Recommendation approved successfully',
        recommendation: updatedRec
      });
    } else {
      // Store update failed
      const updatedRec = await prisma.recommendation.update({
        where: { id: recommendation.id },
        data: {
          status: RecommendationStatus.FAILED,
          store_update_ok: false
        }
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          org_id: orgId,
          user_id: userId || null,
          recommendation_id: recommendation.id,
          action: AuditAction.STORE_UPDATE_FAILED,
          old_price: recommendation.current_price,
          new_price: finalPrice,
          product_id: product.id,
          product_name: product.name,
          notes: 'Analyst approval aborted: external storefront API price update failed.'
        }
      });

      return res.status(500).json({
        error: 'Storefront price update failed',
        recommendation: updatedRec
      });
    }
  } catch (err: any) {
    console.error('approveRecommendation error:', err);
    res.status(500).json({ error: 'Failed to approve recommendation' });
  }
}

/**
 * POST /api/v1/recommendations/:id/modify
 * Overrides the AI recommendation with an analyst-specified price.
 */
export async function modifyRecommendation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.orgId;
    const userId = req.user?.userId;

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context is missing' });
    }

    const parseResult = ModifyPriceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: parseResult.error.errors.map((e) => e.message)
      });
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        product: {
          org_id: orgId
        }
      },
      include: {
        product: true
      }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    if (recommendation.status !== RecommendationStatus.PENDING) {
      return res.status(400).json({ error: 'Only pending recommendations can be modified' });
    }

    const product = recommendation.product;
    const customPrice = parseResult.data.new_price;

    // Trigger mock storefront price update with custom price
    const storeUpdate = await updateStorePrice(product.id, customPrice);

    if (storeUpdate.success) {
      // Transaction to apply custom price, history, and status
      const updatedRec = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product.id },
          data: { current_price: customPrice }
        });

        await tx.priceHistory.create({
          data: {
            product_id: product.id,
            old_price: recommendation.current_price,
            new_price: customPrice,
            change_source: PriceChangeSource.ANALYST_MODIFIED,
            recommendation_id: recommendation.id
          }
        });

        return tx.recommendation.update({
          where: { id: recommendation.id },
          data: {
            status: RecommendationStatus.MODIFIED,
            final_price: customPrice,
            store_update_ok: true
          }
        });
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          org_id: orgId,
          user_id: userId || null,
          recommendation_id: recommendation.id,
          action: AuditAction.PRICE_MODIFIED,
          old_price: recommendation.current_price,
          new_price: customPrice,
          product_id: product.id,
          product_name: product.name,
          notes: `Price overridden and modified manually by analyst to $${customPrice.toFixed(2)}.`
        }
      });

      return res.status(200).json({
        message: 'Recommendation modified and applied successfully',
        recommendation: updatedRec
      });
    } else {
      // Store update failed
      const updatedRec = await prisma.recommendation.update({
        where: { id: recommendation.id },
        data: {
          status: RecommendationStatus.FAILED,
          final_price: customPrice,
          store_update_ok: false
        }
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          org_id: orgId,
          user_id: userId || null,
          recommendation_id: recommendation.id,
          action: AuditAction.STORE_UPDATE_FAILED,
          old_price: recommendation.current_price,
          new_price: customPrice,
          product_id: product.id,
          product_name: product.name,
          notes: `Analyst modification override failed: external storefront API price update failed.`
        }
      });

      return res.status(500).json({
        error: 'Storefront price update failed',
        recommendation: updatedRec
      });
    }
  } catch (err: any) {
    console.error('modifyRecommendation error:', err);
    res.status(500).json({ error: 'Failed to modify recommendation' });
  }
}

/**
 * POST /api/v1/recommendations/:id/reject
 * Rejects a pending recommendation with a reason note.
 */
export async function rejectRecommendation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.orgId;
    const userId = req.user?.userId;

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context is missing' });
    }

    const parseResult = RejectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: parseResult.error.errors.map((e) => e.message)
      });
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        product: {
          org_id: orgId
        }
      },
      include: {
        product: true
      }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    if (recommendation.status !== RecommendationStatus.PENDING) {
      return res.status(400).json({ error: 'Only pending recommendations can be rejected' });
    }

    const product = recommendation.product;
    const reason = parseResult.data.reason;

    // Reject recommendation, update status and analyst note
    const updatedRec = await prisma.recommendation.update({
      where: { id: recommendation.id },
      data: {
        status: RecommendationStatus.REJECTED,
        analyst_note: reason
      }
    });

    // Write Audit Log
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        user_id: userId || null,
        recommendation_id: recommendation.id,
        action: AuditAction.PRICE_REJECTED,
        old_price: recommendation.current_price,
        new_price: recommendation.current_price,
        product_id: product.id,
        product_name: product.name,
        notes: `Price recommendation rejected by analyst. Reason: ${reason}`
      }
    });

    res.status(200).json({
      message: 'Recommendation rejected successfully',
      recommendation: updatedRec
    });
  } catch (err: any) {
    console.error('rejectRecommendation error:', err);
    res.status(500).json({ error: 'Failed to reject recommendation' });
  }
}
