/*
  Warnings:

  - The values [SuperAdmin] on the enum `UserType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserType_new" AS ENUM ('Admin', 'TradingMaestro', 'SupportHero', 'SecuritySentinel', 'Trader', 'Affiliate', 'Investor', 'Developer', 'Marketer', 'Auditor', 'Client', 'Broker');
ALTER TABLE "User" ALTER COLUMN "type" TYPE "UserType_new" USING ("type"::text::"UserType_new");
ALTER TYPE "UserType" RENAME TO "UserType_old";
ALTER TYPE "UserType_new" RENAME TO "UserType";
DROP TYPE "UserType_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activateAccountToken" TEXT,
ADD COLUMN     "forgotPasswordToken" TEXT;
