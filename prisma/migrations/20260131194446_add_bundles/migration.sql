-- CreateTable
CREATE TABLE "Bundle" (
    "id" SERIAL NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "folderLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleChannel" (
    "id" SERIAL NOT NULL,
    "bundleId" INTEGER NOT NULL,
    "channelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundlePlan" (
    "id" SERIAL NOT NULL,
    "bundleId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "durationDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BundlePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "bundleId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "inviteLinks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleTransaction" (
    "id" TEXT NOT NULL,
    "bundleSubId" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "providerFee" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "creatorShare" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bundle_creatorId_idx" ON "Bundle"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleChannel_bundleId_channelId_key" ON "BundleChannel"("bundleId", "channelId");

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleChannel" ADD CONSTRAINT "BundleChannel_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleChannel" ADD CONSTRAINT "BundleChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundlePlan" ADD CONSTRAINT "BundlePlan_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleSubscription" ADD CONSTRAINT "BundleSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleSubscription" ADD CONSTRAINT "BundleSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BundlePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleSubscription" ADD CONSTRAINT "BundleSubscription_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleTransaction" ADD CONSTRAINT "BundleTransaction_bundleSubId_fkey" FOREIGN KEY ("bundleSubId") REFERENCES "BundleSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
