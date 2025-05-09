/*
  Warnings:

  - You are about to drop the column `secret` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `tempSecret` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "secret",
DROP COLUMN "tempSecret",
ADD COLUMN     "twoFAStatus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFAsecret" TEXT,
ADD COLUMN     "twoFAtempSecret" TEXT;
