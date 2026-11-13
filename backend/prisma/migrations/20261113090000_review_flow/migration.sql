-- AlterEnum
BEGIN;
CREATE TYPE "DocumentStatus_new" AS ENUM ('uploading', 'parsing', 'pending_review', 'indexing', 'ready', 'failed');
ALTER TABLE "app"."document" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "document" ALTER COLUMN "status" TYPE "DocumentStatus_new" USING ("status"::text::"DocumentStatus_new");
ALTER TYPE "DocumentStatus" RENAME TO "DocumentStatus_old";
ALTER TYPE "DocumentStatus_new" RENAME TO "DocumentStatus";
DROP TYPE "app"."DocumentStatus_old";
ALTER TABLE "document" ALTER COLUMN "status" SET DEFAULT 'uploading';
COMMIT;

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT;

-- CreateTable
CREATE TABLE "document_chunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "document_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_chunk_documentId_index_key" ON "document_chunk"("documentId", "index");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunk" ADD CONSTRAINT "document_chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

