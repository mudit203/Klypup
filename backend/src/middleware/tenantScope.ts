import { Request, Response, NextFunction } from 'express';

export function tenantScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.orgId) {
    return res.status(400).json({
      error: 'Tenant context is missing',
      details: ['User session does not contain a valid organization ID']
    });
  }

  req.orgId = req.user.orgId;
  return next();
}
