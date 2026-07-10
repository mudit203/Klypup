import { z } from 'zod';

export const ModifyPriceSchema = z.object({
  new_price: z.number().positive(),
});

export const RejectSchema = z.object({
  reason: z.string().min(5).max(500),
});
