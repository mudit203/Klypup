import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { OrgSettingsSchema, MarginFloorSchema } from '@klypup/shared';
import { AuditAction, Role } from '@prisma/client';

// Custom validation schema for user invites/creation
const InviteUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'ANALYST']),
});

/**
 * GET /api/v1/admin/settings
 * Retrieves confidence threshold and category margin floors for the org.
 */
export async function getOrgSettings(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const settings = await prisma.orgSettings.findUnique({
      where: { org_id: orgId },
      include: { margin_floors: true },
    });

    if (!settings) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }

    return res.json(settings);
  } catch (err: any) {
    console.error('getOrgSettings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/v1/admin/settings
 * Updates the organization's pricing AI confidence threshold.
 */
export async function updateConfidenceThreshold(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const parseResult = OrgSettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failure',
        details: parseResult.error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`),
      });
    }

    const { confidence_threshold } = parseResult.data;

    const settings = await prisma.orgSettings.update({
      where: { org_id: orgId },
      data: { confidence_threshold },
    });

    // Log the configuration change
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        user_id: req.user!.userId,
        action: AuditAction.SETTINGS_UPDATED,
        notes: `Confidence threshold updated to ${(confidence_threshold * 100).toFixed(0)}%.`,
      },
    });

    return res.json(settings);
  } catch (err: any) {
    console.error('updateConfidenceThreshold error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/v1/admin/settings/margin-floors
 * Adds a minimum gross margin percentage rule for a specific product category.
 */
export async function addMarginFloor(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const parseResult = MarginFloorSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failure',
        details: parseResult.error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`),
      });
    }

    const { category, min_margin } = parseResult.data;

    const settings = await prisma.orgSettings.findUnique({
      where: { org_id: orgId },
    });

    if (!settings) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }

    // Prevent duplicate margin floors for the same category name (case-insensitive)
    const existing = await prisma.marginFloor.findFirst({
      where: {
        org_settings_id: settings.id,
        category: {
          equals: category,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        error: `A margin floor already exists for category "${category}". Please delete the existing floor first.`,
      });
    }

    const marginFloor = await prisma.marginFloor.create({
      data: {
        org_settings_id: settings.id,
        category,
        min_margin,
      },
    });

    // Log the margin floor creation
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        user_id: req.user!.userId,
        action: AuditAction.SETTINGS_UPDATED,
        notes: `Added margin floor of ${(min_margin * 100).toFixed(0)}% for category "${category}".`,
      },
    });

    return res.status(201).json(marginFloor);
  } catch (err: any) {
    console.error('addMarginFloor error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/v1/admin/settings/margin-floors/:id
 * Removes a custom margin floor category threshold.
 */
export async function deleteMarginFloor(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const { id } = req.params;

    const marginFloor = await prisma.marginFloor.findUnique({
      where: { id },
      include: { org_settings: true },
    });

    if (!marginFloor || marginFloor.org_settings.org_id !== orgId) {
      return res.status(404).json({ error: 'Margin floor not found' });
    }

    await prisma.marginFloor.delete({
      where: { id },
    });

    // Log the deletion
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        user_id: req.user!.userId,
        action: AuditAction.SETTINGS_UPDATED,
        notes: `Removed margin floor rule for category "${marginFloor.category}".`,
      },
    });

    return res.json({ success: true, message: 'Margin floor deleted successfully' });
  } catch (err: any) {
    console.error('deleteMarginFloor error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/v1/admin/users
 * Returns list of all team members inside the tenant.
 */
export async function getOrgUsers(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const users = await prisma.user.findMany({
      where: { org_id: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return res.json(users);
  } catch (err: any) {
    console.error('getOrgUsers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/v1/admin/users/invite
 * Invites (creates) a new analyst or administrator.
 */
export async function inviteOrgUser(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const parseResult = InviteUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failure',
        details: parseResult.error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`),
      });
    }

    const { name, email, password, role } = parseResult.data;

    // Check email availability globally
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Encrypt password
    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        org_id: orgId,
        name,
        email,
        password_hash: passwordHash,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
    });

    // Log the user invite action
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        user_id: req.user!.userId,
        action: AuditAction.USER_INVITED,
        notes: `Created/Invited user "${name}" (${email}) as role ${role}.`,
      },
    });

    return res.status(201).json(newUser);
  } catch (err: any) {
    console.error('inviteOrgUser error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/v1/admin/users/:id/role
 * Changes user permission role level.
 */
export async function changeUserRole(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;

    if (role !== Role.ADMIN && role !== Role.ANALYST) {
      return res.status(400).json({ error: 'Invalid role value' });
    }

    // Self change protection
    if (targetUserId === req.user!.userId) {
      return res.status(400).json({ error: 'Self-authorization block: You cannot alter your own role.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.org_id !== orgId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
    });

    // Log the role change
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        user_id: req.user!.userId,
        action: AuditAction.USER_ROLE_CHANGED,
        notes: `Modified user "${targetUser.name}" (${targetUser.email}) role from ${targetUser.role} to ${role}.`,
      },
    });

    return res.json(updatedUser);
  } catch (err: any) {
    console.error('changeUserRole error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/v1/admin/users/:id
 * Removes a user from the organization tenant.
 */
export async function removeOrgUser(req: Request, res: Response) {
  const orgId = req.orgId!;
  try {
    const targetUserId = req.params.id;

    // Self deletion block
    if (targetUserId === req.user!.userId) {
      return res.status(400).json({ error: 'Self-deletion block: You cannot delete your own account.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.org_id !== orgId) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({
      where: { id: targetUserId },
    });

    // Log the deletion
    await prisma.auditLog.create({
      data: {
        org_id: orgId,
        user_id: req.user!.userId,
        action: AuditAction.SETTINGS_UPDATED,
        notes: `Removed user "${targetUser.name}" (${targetUser.email}) from tenant.`,
      },
    });

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('removeOrgUser error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
