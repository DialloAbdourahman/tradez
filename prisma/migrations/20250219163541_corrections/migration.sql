/*
  Warnings:

  - You are about to drop the column `twoFAStatus` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `twoFAsecret` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `twoFAtempSecret` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "twoFAStatus",
DROP COLUMN "twoFAsecret",
DROP COLUMN "twoFAtempSecret",
ADD COLUMN     "twoFAEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFASecret" TEXT,
ADD COLUMN     "twoFATempSecret" TEXT;
