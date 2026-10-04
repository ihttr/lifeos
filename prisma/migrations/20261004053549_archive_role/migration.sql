-- CreateEnum
CREATE TYPE "ArchiveRole" AS ENUM ('QUESTION', 'SOLUTION', 'OTHER');

-- AlterTable
ALTER TABLE "ArchiveFile" ADD COLUMN     "role" "ArchiveRole" NOT NULL DEFAULT 'OTHER';
