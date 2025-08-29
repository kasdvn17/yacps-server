-- DropForeignKey
ALTER TABLE "public"."Contestant" DROP CONSTRAINT "Contestant_contestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Contestant" DROP CONSTRAINT "Contestant_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."JudgeToken" DROP CONSTRAINT "JudgeToken_judgeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PrimaryContestToProblem" DROP CONSTRAINT "PrimaryContestToProblem_contestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PrimaryContestToProblem" DROP CONSTRAINT "PrimaryContestToProblem_problemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Problem" DROP CONSTRAINT "Problem_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProblemLanguageTestEnvironment" DROP CONSTRAINT "ProblemLanguageTestEnvironment_problemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProblemTestEnvironment" DROP CONSTRAINT "ProblemTestEnvironment_problemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Submission" DROP CONSTRAINT "Submission_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Submission" DROP CONSTRAINT "Submission_contestantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Submission" DROP CONSTRAINT "Submission_judgeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Submission" DROP CONSTRAINT "Submission_problemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SubmissionQueue" DROP CONSTRAINT "SubmissionQueue_assignedJudgeId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contestant" ADD CONSTRAINT "Contestant_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "public"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contestant" ADD CONSTRAINT "Contestant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "public"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_contestantId_fkey" FOREIGN KEY ("contestantId") REFERENCES "public"."Contestant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "public"."Judge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Problem" ADD CONSTRAINT "Problem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProblemTestEnvironment" ADD CONSTRAINT "ProblemTestEnvironment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "public"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProblemLanguageTestEnvironment" ADD CONSTRAINT "ProblemLanguageTestEnvironment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "public"."ProblemTestEnvironment"("problemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrimaryContestToProblem" ADD CONSTRAINT "PrimaryContestToProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "public"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrimaryContestToProblem" ADD CONSTRAINT "PrimaryContestToProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "public"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JudgeToken" ADD CONSTRAINT "JudgeToken_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "public"."Judge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissionQueue" ADD CONSTRAINT "SubmissionQueue_assignedJudgeId_fkey" FOREIGN KEY ("assignedJudgeId") REFERENCES "public"."Judge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
