-- AlterTable
ALTER TABLE "Judge" ADD COLUMN     "currentSubmissionId" INTEGER,
ADD COLUMN     "isJudging" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "compileTime" DOUBLE PRECISION,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "isPretest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "judgeId" TEXT,
ADD COLUMN     "judgingEndedAt" TIMESTAMP(3),
ADD COLUMN     "judgingStartedAt" TIMESTAMP(3),
ADD COLUMN     "maxMemory" INTEGER,
ADD COLUMN     "maxTime" DOUBLE PRECISION,
ADD COLUMN     "points" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "queuedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubmissionTestCase" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "batchNumber" INTEGER,
    "verdict" "SubmissionVerdict" NOT NULL,
    "time" DOUBLE PRECISION,
    "memory" INTEGER,
    "points" DOUBLE PRECISION DEFAULT 0,
    "maxPoints" DOUBLE PRECISION DEFAULT 0,
    "input" TEXT,
    "output" TEXT,
    "expected" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionQueue" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "assignedJudgeId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionTestCase_submissionId_idx" ON "SubmissionTestCase"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionTestCase_submissionId_caseNumber_idx" ON "SubmissionTestCase"("submissionId", "caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionTestCase_submissionId_caseNumber_key" ON "SubmissionTestCase"("submissionId", "caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionQueue_submissionId_key" ON "SubmissionQueue"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionQueue_priority_createdAt_idx" ON "SubmissionQueue"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "SubmissionQueue_assignedJudgeId_idx" ON "SubmissionQueue"("assignedJudgeId");

-- CreateIndex
CREATE INDEX "Submission_judgeId_idx" ON "Submission"("judgeId");

-- CreateIndex
CREATE INDEX "Submission_verdict_idx" ON "Submission"("verdict");

-- CreateIndex
CREATE INDEX "Submission_queuedAt_idx" ON "Submission"("queuedAt");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTestCase" ADD CONSTRAINT "SubmissionTestCase_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionQueue" ADD CONSTRAINT "SubmissionQueue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionQueue" ADD CONSTRAINT "SubmissionQueue_assignedJudgeId_fkey" FOREIGN KEY ("assignedJudgeId") REFERENCES "Judge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
