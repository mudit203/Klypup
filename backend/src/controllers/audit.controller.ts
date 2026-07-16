import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * GET /api/v1/audit
 * Retrieves paginated, sorted, and filtered audit logs for the organization.
 */
export async function getAuditLogs(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const skip = (page - 1) * limit;

    const productId = req.query.product_id as string || undefined;
    const action = req.query.action as string || undefined;
    const fromDate = req.query.from as string || undefined;
    const toDate = req.query.to as string || undefined;

    // Build query filters scoped to tenant
    const where: any = {
      org_id: orgId,
    };

    if (productId) {
      where.product_id = productId;
    }

    if (action) {
      where.action = action;
    }

    if (fromDate || toDate) {
      where.created_at = {};
      if (fromDate) {
        where.created_at.gte = new Date(fromDate);
      }
      if (toDate) {
        where.created_at.lte = new Date(toDate);
      }
    }

    // Query logs and total count in parallel
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error('getAuditLogs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
