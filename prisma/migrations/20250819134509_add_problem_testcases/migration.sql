-- CreateTable
CREATE TABLE "ProblemTestCase" (
    "id" SERIAL NOT NULL,
    "problemId" INTEGER NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "batchNumber" INTEGER,
    "input" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "points" DOUBLE PRECISION DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemTestCase_problemId_idx" ON "ProblemTestCase"("problemId");

-- CreateIndex
CREATE INDEX "ProblemTestCase_problemId_caseNumber_idx" ON "ProblemTestCase"("problemId", "caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemTestCase_problemId_caseNumber_key" ON "ProblemTestCase"("problemId", "caseNumber");

-- AddForeignKey
ALTER TABLE "ProblemTestCase" ADD CONSTRAINT "ProblemTestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
