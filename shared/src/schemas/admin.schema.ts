import { z } from 'zod';

export const OrgSettingsSchema = z.object({
  confidence_threshold: z.number().min(0).max(1),
});

export const MarginFloorSchema = z.object({
  category: z.string().min(1),
  min_margin: z.number().min(0).max(1),
});
