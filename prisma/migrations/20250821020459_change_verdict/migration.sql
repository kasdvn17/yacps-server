/*
  Warnings:

  - The values [RE] on the enum `SubmissionVerdict` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."SubmissionVerdict_new" AS ENUM ('RN', 'AC', 'WA', 'AB', 'QU', 'IR', 'CE', 'RTE', 'OLE', 'TLE', 'MLE', 'ISE', 'SK');
ALTER TABLE "public"."Submission" ALTER COLUMN "verdict" DROP DEFAULT;
ALTER TABLE "public"."Submission" ALTER COLUMN "verdict" TYPE "public"."SubmissionVerdict_new" USING ("verdict"::text::"public"."SubmissionVerdict_new");
ALTER TABLE "public"."SubmissionTestCase" ALTER COLUMN "verdict" TYPE "public"."SubmissionVerdict_new" USING ("verdict"::text::"public"."SubmissionVerdict_new");
ALTER TYPE "public"."SubmissionVerdict" RENAME TO "SubmissionVerdict_old";
ALTER TYPE "public"."SubmissionVerdict_new" RENAME TO "SubmissionVerdict";
DROP TYPE "public"."SubmissionVerdict_old";
ALTER TABLE "public"."Submission" ALTER COLUMN "verdict" SET DEFAULT 'QU';
COMMIT;
