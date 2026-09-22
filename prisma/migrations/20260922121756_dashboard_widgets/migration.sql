-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dashboardWidgets" TEXT[] DEFAULT ARRAY[]::TEXT[];
