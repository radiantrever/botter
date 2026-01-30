"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionPlanSchema = exports.channelRegistrationSchema = exports.creatorRegistrationSchema = exports.paymentVerificationSchema = exports.subscriptionValidationSchema = exports.deepLinkSchema = exports.cardNumberSchema = exports.durationSchema = exports.amountSchema = exports.planIdSchema = exports.channelIdSchema = exports.telegramIdSchema = void 0;
exports.validateWithSchema = validateWithSchema;
exports.isValidTelegramId = isValidTelegramId;
exports.isValidChannelId = isValidChannelId;
exports.isValidAmount = isValidAmount;
const zod_1 = require("zod");
// Validation schemas for the application
exports.telegramIdSchema = zod_1.z.union([
    zod_1.z.number().int().positive(),
    zod_1.z.bigint().gte(BigInt(1)),
]);
exports.channelIdSchema = zod_1.z.union([
    zod_1.z.number().int().negative(), // Telegram channel IDs are negative
    zod_1.z.bigint().lt(BigInt(0)),
]);
exports.planIdSchema = zod_1.z.number().int().positive();
exports.amountSchema = zod_1.z.number().int().positive().min(1000); // Minimum amount in UZS
exports.durationSchema = zod_1.z.number().int().positive().max(365); // Max 1 year
exports.cardNumberSchema = zod_1.z
    .string()
    .regex(/^\d{16}$/, 'Card number must be 16 digits');
exports.deepLinkSchema = zod_1.z
    .string()
    .regex(/^c_\d+$/, 'Invalid deep link format');
exports.subscriptionValidationSchema = zod_1.z.object({
    userId: exports.telegramIdSchema,
    planId: exports.planIdSchema,
    amount: exports.amountSchema,
    duration: exports.durationSchema,
});
exports.paymentVerificationSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
    amount: exports.amountSchema,
});
exports.creatorRegistrationSchema = zod_1.z.object({
    telegramId: exports.telegramIdSchema,
    username: zod_1.z.string().optional(),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
});
exports.channelRegistrationSchema = zod_1.z.object({
    telegramId: exports.channelIdSchema,
    title: zod_1.z.string().min(1).max(255),
});
exports.subscriptionPlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    price: exports.amountSchema,
    durationDay: exports.durationSchema,
});
// Validation function
function validateWithSchema(schema, data) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorMessages = error.issues.map(issue => issue.message);
            throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
        }
        throw error;
    }
}
// Type guards
function isValidTelegramId(id) {
    return exports.telegramIdSchema.safeParse(id).success;
}
function isValidChannelId(id) {
    return exports.channelIdSchema.safeParse(id).success;
}
function isValidAmount(amount) {
    return exports.amountSchema.safeParse(amount).success;
}
