import { z } from 'zod';
import { SignupSchema, LoginSchema } from './schemas/auth.schema';
import { CreateProductSchema } from './schemas/product.schema';
import { ModifyPriceSchema, RejectSchema } from './schemas/recommendation.schema';
import { OrgSettingsSchema, MarginFloorSchema } from './schemas/admin.schema';

// Export schemas
export * from './schemas/auth.schema';
export * from './schemas/product.schema';
export * from './schemas/recommendation.schema';
export * from './schemas/admin.schema';

// Export inferred types
export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type ModifyPriceInput = z.infer<typeof ModifyPriceSchema>;
export type RejectInput = z.infer<typeof RejectSchema>;
export type OrgSettingsInput = z.infer<typeof OrgSettingsSchema>;
export type MarginFloorInput = z.infer<typeof MarginFloorSchema>;
