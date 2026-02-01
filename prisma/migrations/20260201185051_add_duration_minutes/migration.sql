-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "durationMin" INTEGER,
ALTER COLUMN "durationDay" DROP NOT NULL;
