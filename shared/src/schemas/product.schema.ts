import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  category: z.string().min(1).max(100),
  cost_of_goods: z.number().positive(),
  current_price: z.number().positive(),
});
