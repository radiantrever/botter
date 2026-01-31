-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "previewDurationMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "previewEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PreviewAccess" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "channelId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "inviteLink" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreviewAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreviewAccess_userId_channelId_idx" ON "PreviewAccess"("userId", "channelId");

-- CreateIndex
CREATE INDEX "PreviewAccess_status_endDate_idx" ON "PreviewAccess"("status", "endDate");

-- AddForeignKey
ALTER TABLE "PreviewAccess" ADD CONSTRAINT "PreviewAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewAccess" ADD CONSTRAINT "PreviewAccess_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
