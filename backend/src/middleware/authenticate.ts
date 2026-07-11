import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

interface DecodedToken {
  sub: string;
  orgId: string;
  role: Role;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthenticated',
      details: ['Authorization token is missing or invalid']
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured on the server');
    }

    const decoded = jwt.verify(token, secret) as DecodedToken;

    // Attach decoded details to request context
    req.user = {
      userId: decoded.sub,
      orgId: decoded.orgId,
      role: decoded.role
    };

    return next();
  } catch (error: any) {
    let message = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') {
      message = 'Token has expired';
    }

    return res.status(401).json({
      error: 'Unauthenticated',
      details: [message]
    });
  }
}
