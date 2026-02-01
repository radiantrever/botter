-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "freePlanId" INTEGER,
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false;
