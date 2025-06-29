import { PrismaClient } from '@prisma/client';
import readline from 'readline';
import { readFileSync } from 'fs';
import { ProblemsService } from '@/client-api/problems/problems.service';
import { UsersService } from '@/client-api/users/users.service';
import { PrismaService } from '@/prisma/prisma.service';

const prisma = new PrismaClient();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function create() {
  await prisma.$connect();
  const problemId = await ask('Enter the ID of the problem: ');
  const authorUsername = await ask('Enter the username of the author: ');
  const codeFileName =
    (await ask(
      'Enter the file name of the code (stored inside tmp folder - default: a.cpp)',
    )) || 'a.cpp';
  const language =
    (await ask(
      'Enter the coding language used by the submission (default: cpp)',
    )) || 'cpp';
  if (
    typeof problemId != 'string' || // ts doesn't allow me to use arrays
    typeof authorUsername != 'string' ||
    typeof codeFileName != 'string' ||
    typeof language != 'string'
  ) {
    console.log('Invalid option');
    process.exit(1);
  }
  const pId = parseInt(problemId);
  const extractedCode = readFileSync(`./tmp/${codeFileName}`, 'utf-8');
  const problem = await new ProblemsService(
    new PrismaService(),
  ).findProblemWithId(pId, false);
  if (!problem) throw new Error('No problem with the provided ID found');
  const authorId = (
    await new UsersService(new PrismaService()).findUser(
      { username: authorUsername },
      false,
      false,
    )
  )?.id;
  if (!authorId) throw new Error('No user with the provided username found');
  await prisma.submission.create({
    data: {
      problemId: pId,
      authorId,
      code: extractedCode,
      language,
    },
  });
  rl.write('Submission created');
  rl.close();
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length == 0) {
    console.log(`This is an emergency/development script to modify submissions only. If you want to modify further, please edit directly in the database or the admin page.\n
Help options:
    --help, -h        Show this help message
    --create          Create a submission
    `);
    process.exit(0);
  }
  if (args.includes('--create')) create().catch((err) => console.error(err));
}

main();
