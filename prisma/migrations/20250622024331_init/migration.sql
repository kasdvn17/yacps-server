-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'RATHER_NOT_SAY');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'BANNED', 'CONF_AWAITING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullname" TEXT,
    "perms" BIGINT NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'CONF_AWAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "perms" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "UserOnRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "userId" TEXT NOT NULL,
    "countContests" INTEGER NOT NULL DEFAULT 0,
    "totalContestPoints" BIGINT NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "mean" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Contestant" (
    "contestId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Contestant_pkey" PRIMARY KEY ("contestId","userId")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "minRating" INTEGER NOT NULL DEFAULT 0,
    "maxRating" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "authorId" TEXT NOT NULL,
    "problemSlug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemOnContest" (
    "contestId" INTEGER NOT NULL,
    "problemSlug" TEXT NOT NULL,

    CONSTRAINT "ProblemOnContest_pkey" PRIMARY KEY ("contestId","problemSlug")
);

-- CreateTable
CREATE TABLE "Problem" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "statement" TEXT NOT NULL,
    "category" TEXT[],
    "points" INTEGER NOT NULL,
    "curators" TEXT[],
    "authors" TEXT[],
    "pdfUuid" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "ProblemTestEnvironment" (
    "problemSlug" TEXT NOT NULL,
    "allowedLangs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timeLimit" INTEGER NOT NULL DEFAULT 1,
    "memoryLimit" INTEGER NOT NULL DEFAULT 256,

    CONSTRAINT "ProblemTestEnvironment_pkey" PRIMARY KEY ("problemSlug")
);

-- CreateTable
CREATE TABLE "ProblemLanguageTestEnvironment" (
    "problemSlug" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "timeLimit" INTEGER NOT NULL DEFAULT 1,
    "memoryLimit" INTEGER NOT NULL DEFAULT 256,

    CONSTRAINT "ProblemLanguageTestEnvironment_pkey" PRIMARY KEY ("problemSlug","lang")
);

-- CreateTable
CREATE TABLE "ProblemSubmissionsStats" (
    "problemSlug" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "AC" INTEGER NOT NULL DEFAULT 0,
    "WA" INTEGER NOT NULL DEFAULT 0,
    "RTE" INTEGER NOT NULL DEFAULT 0,
    "OLE" INTEGER NOT NULL DEFAULT 0,
    "IR" INTEGER NOT NULL DEFAULT 0,
    "TLE" INTEGER NOT NULL DEFAULT 0,
    "MLE" INTEGER NOT NULL DEFAULT 0,
    "RE" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProblemSubmissionsStats_pkey" PRIMARY KEY ("problemSlug")
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "ip" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "lastActive" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Judge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeToken" (
    "id" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_pdfUuid_key" ON "Problem"("pdfUuid");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemLanguageTestEnvironment_problemSlug_key" ON "ProblemLanguageTestEnvironment"("problemSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemLanguageTestEnvironment_lang_key" ON "ProblemLanguageTestEnvironment"("lang");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_name_key" ON "Judge"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_host_key" ON "Judge"("host");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeToken_judgeId_key" ON "JudgeToken"("judgeId");

-- AddForeignKey
ALTER TABLE "UserOnRole" ADD CONSTRAINT "UserOnRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnRole" ADD CONSTRAINT "UserOnRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contestant" ADD CONSTRAINT "Contestant_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contestant" ADD CONSTRAINT "Contestant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemSlug_fkey" FOREIGN KEY ("problemSlug") REFERENCES "Problem"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemOnContest" ADD CONSTRAINT "ProblemOnContest_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemOnContest" ADD CONSTRAINT "ProblemOnContest_problemSlug_fkey" FOREIGN KEY ("problemSlug") REFERENCES "Problem"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemTestEnvironment" ADD CONSTRAINT "ProblemTestEnvironment_problemSlug_fkey" FOREIGN KEY ("problemSlug") REFERENCES "Problem"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemLanguageTestEnvironment" ADD CONSTRAINT "ProblemLanguageTestEnvironment_problemSlug_fkey" FOREIGN KEY ("problemSlug") REFERENCES "ProblemTestEnvironment"("problemSlug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSubmissionsStats" ADD CONSTRAINT "ProblemSubmissionsStats_problemSlug_fkey" FOREIGN KEY ("problemSlug") REFERENCES "Problem"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeToken" ADD CONSTRAINT "JudgeToken_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
