import { z } from 'zod';

// Validation schemas for the application
export const telegramIdSchema = z.union([
  z.number().int().positive(),
  z.bigint().gte(BigInt(1)),
]);

export const channelIdSchema = z.union([
  z.number().int().negative(), // Telegram channel IDs are negative
  z.bigint().lt(BigInt(0)),
]);

export const planIdSchema = z.number().int().positive();

export const amountSchema = z.number().int().positive().min(1000); // Minimum amount in UZS

export const durationSchema = z.number().int().positive().max(365); // Max 1 year

export const cardNumberSchema = z
  .string()
  .regex(/^\d{16}$/, 'Card number must be 16 digits');

export const deepLinkSchema = z
  .string()
  .regex(/^c_\d+$/, 'Invalid deep link format');

export const subscriptionValidationSchema = z.object({
  userId: telegramIdSchema,
  planId: planIdSchema,
  amount: amountSchema,
  duration: durationSchema,
});

export const paymentVerificationSchema = z.object({
  transactionId: z.string().min(1),
  amount: amountSchema,
});

export const creatorRegistrationSchema = z.object({
  telegramId: telegramIdSchema,
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const channelRegistrationSchema = z.object({
  telegramId: channelIdSchema,
  title: z.string().min(1).max(255),
});

export const subscriptionPlanSchema = z.object({
  name: z.string().min(1).max(100),
  price: amountSchema,
  durationDay: durationSchema,
});

// Validation function
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(issue => issue.message);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
}

// Type guards
export function isValidTelegramId(id: unknown): id is number | bigint {
  return telegramIdSchema.safeParse(id).success;
}

export function isValidChannelId(id: unknown): id is number | bigint {
  return channelIdSchema.safeParse(id).success;
}

export function isValidAmount(amount: unknown): amount is number {
  return amountSchema.safeParse(amount).success;
}
