-- AlterTable
ALTER TABLE "public"."Problem" ADD COLUMN     "hasTestData" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."ProblemArchive" (
    "id" SERIAL NOT NULL,
    "problemId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hasInit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemArchive_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ProblemArchive" ADD CONSTRAINT "ProblemArchive_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "public"."Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
