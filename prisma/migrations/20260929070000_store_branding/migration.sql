-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "brandColor" TEXT NOT NULL DEFAULT '#059669',
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "logo" BYTEA,
ADD COLUMN     "logoMime" TEXT,
ADD COLUMN     "logoUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "ntn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "setupCompletedAt" TIMESTAMP(3),
ADD COLUMN     "showLogoOnReceipt" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tagline" TEXT NOT NULL DEFAULT '';
