import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { SignupSchema, LoginSchema } from '@klypup/shared';
import { Role } from '@prisma/client';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export function generateAccessToken(userId: string, orgId: string, role: Role): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: userId, orgId, role }, secret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(userId: string, jti: string): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
  return jwt.sign({ sub: userId, jti }, secret, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

// Helper to set refresh token in cookie and save its bcrypt hash in DB
export async function setRefreshTokenCookieAndSave(res: Response, userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  const rawToken = generateRefreshToken(userId, jti);

  // Hash the refresh token with bcrypt
  const tokenHash = await bcrypt.hash(rawToken, 10);

  // Save to DB
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      id: jti,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
  });

  // Set HTTP-only cookie
  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
  });

  return rawToken;
}

export async function signup(req: Request, res: Response) {
  const parseResult = SignupSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failure',
      details: parseResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
    });
  }

  const { orgName, name, email, password } = parseResult.data;

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Email already registered',
        details: ['This email address is already associated with an account'],
      });
    }

    // Hash user password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create org, settings, and user inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.org.create({
        data: {
          name: orgName,
          settings: {
            create: {
              confidence_threshold: 0.80,
            },
          },
        },
      });

      const user = await tx.user.create({
        data: {
          org_id: org.id,
          email,
          password_hash: passwordHash,
          name,
          role: Role.ADMIN, // First user is Admin
        },
      });

      return { org, user };
    });

    // Generate tokens
    const accessToken = generateAccessToken(result.user.id, result.org.id, result.user.role);
    await setRefreshTokenCookieAndSave(res, result.user.id);

    return res.status(201).json({
      accessToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        orgId: result.org.id,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({
      error: 'Signup failed',
      details: [error.message],
    });
  }
}

export async function login(req: Request, res: Response) {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failure',
      details: parseResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
    });
  }

  const { email, password } = parseResult.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        details: ['The email or password you entered is incorrect'],
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
        details: ['The email or password you entered is incorrect'],
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.org_id, user.role);
    await setRefreshTokenCookieAndSave(res, user.id);

    return res.json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.org_id,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Login failed',
      details: [error.message],
    });
  }
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({
      error: 'Unauthenticated',
      details: ['Refresh token is missing']
    });
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    // Decode and verify the token
    const decoded = jwt.verify(refreshToken, secret) as { sub: string; jti: string };
    const userId = decoded.sub;
    const jti = decoded.jti;

    // Check in database
    const dbToken = await prisma.refreshToken.findUnique({
      where: { id: jti }
    });

    if (!dbToken || dbToken.revoked || dbToken.expires_at < new Date()) {
      return res.status(401).json({
        error: 'Unauthenticated',
        details: ['Refresh token is invalid, expired, or revoked']
      });
    }

    // Check if the hashed token in database matches
    const isValidHash = await bcrypt.compare(refreshToken, dbToken.token_hash);
    if (!isValidHash) {
      return res.status(401).json({
        error: 'Unauthenticated',
        details: ['Refresh token verification failed']
      });
    }

    // Rotate refresh token: revoke old one
    await prisma.refreshToken.update({
      where: { id: jti },
      data: { revoked: true }
    });

    // Get user details to sign access token
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthenticated',
        details: ['User not found']
      });
    }

    // Issue new pair
    const newAccessToken = generateAccessToken(user.id, user.org_id, user.role);
    await setRefreshTokenCookieAndSave(res, user.id);

    return res.json({
      accessToken: newAccessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.org_id
      }
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return res.status(401).json({
      error: 'Unauthenticated',
      details: [error.message]
    });
  }
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      const secret = process.env.JWT_REFRESH_SECRET;
      if (secret) {
        // Decode to find jti and revoke it in the database
        const decoded = jwt.decode(refreshToken) as { jti?: string };
        if (decoded && decoded.jti) {
          await prisma.refreshToken.update({
            where: { id: decoded.jti },
            data: { revoked: true }
          }).catch(() => {
            // ignore if already deleted or doesn't exist
          });
        }
      }
    } catch (err) {
      console.error('Logout revocation error:', err);
    }
  }

  // Clear cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  return res.json({ message: 'Logged out successfully' });
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthenticated',
      details: ['User session is missing']
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: ['Your user account could not be found']
      });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.org_id
      }
    });
  } catch (error: any) {
    console.error('Me error:', error);
    return res.status(500).json({
      error: 'Failed to fetch user context',
      details: [error.message]
    });
  }
}

