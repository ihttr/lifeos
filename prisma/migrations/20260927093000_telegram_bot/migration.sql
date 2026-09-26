-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "TelegramSent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- CreateIndex
CREATE INDEX "TelegramSent_userId_sentAt_idx" ON "TelegramSent"("userId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSent_userId_key_key" ON "TelegramSent"("userId", "key");

-- AddForeignKey
ALTER TABLE "TelegramSent" ADD CONSTRAINT "TelegramSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
