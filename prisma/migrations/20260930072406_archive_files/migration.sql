-- CreateEnum
CREATE TYPE "ArchiveKind" AS ENUM ('THEORY', 'PRACTICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ArchiveSource" AS ENUM ('WEB', 'TELEGRAM');

-- CreateTable
CREATE TABLE "ArchiveFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pathname" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "kind" "ArchiveKind" NOT NULL DEFAULT 'OTHER',
    "source" "ArchiveSource" NOT NULL DEFAULT 'WEB',
    "subjectId" TEXT,
    "assignmentId" TEXT,
    "projectId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveFile_pathname_key" ON "ArchiveFile"("pathname");

-- CreateIndex
CREATE INDEX "ArchiveFile_userId_createdAt_idx" ON "ArchiveFile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ArchiveFile_userId_subjectId_idx" ON "ArchiveFile"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "ArchiveFile_userId_kind_idx" ON "ArchiveFile"("userId", "kind");

-- CreateIndex
CREATE INDEX "ArchiveFile_assignmentId_idx" ON "ArchiveFile"("assignmentId");

-- CreateIndex
CREATE INDEX "ArchiveFile_projectId_idx" ON "ArchiveFile"("projectId");

-- AddForeignKey
ALTER TABLE "ArchiveFile" ADD CONSTRAINT "ArchiveFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveFile" ADD CONSTRAINT "ArchiveFile_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveFile" ADD CONSTRAINT "ArchiveFile_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveFile" ADD CONSTRAINT "ArchiveFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
