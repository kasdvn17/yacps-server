-- AlterTable
ALTER TABLE "public"."Problem" ADD COLUMN     "short_circuit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."PrimaryContestToProblem" (
    "contestId" INTEGER NOT NULL,
    "problemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrimaryContestToProblem_pkey" PRIMARY KEY ("problemId")
);

-- AddForeignKey
ALTER TABLE "public"."PrimaryContestToProblem" ADD CONSTRAINT "PrimaryContestToProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "public"."Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrimaryContestToProblem" ADD CONSTRAINT "PrimaryContestToProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "public"."Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
