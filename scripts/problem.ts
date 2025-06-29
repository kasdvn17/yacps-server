#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client';
import readline from 'readline';

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
  //   const oldT = Date.now();
  const slug = await ask(
    'Enter the slug of the problem (only alphabets and numeric characters): ',
  );
  const name = await ask('Enter the name of the problem: ');
  const description = await ask(
    'Enter the description of the problem (optional): ',
  );
  const points =
    (await ask('Enter the points of the problem (default 1): ')) || '1';
  if (
    typeof slug != 'string' ||
    typeof name != 'string' ||
    typeof description != 'string' ||
    typeof points != 'string' ||
    isNaN(parseFloat(points)) ||
    !new RegExp('^[a-zA-Z0-9_.-]*$').test(slug)
  ) {
    console.log('Invalid option.');
    process.exit(1);
  }
  const parseFloatPoints = parseFloat(points);
  const problem = await prisma.problem.create({
    data: {
      slug,
      name,
      description,
      points: parseFloatPoints,
      testEnvironments: {
        create: {},
      },
    },
  });
  rl.write('Problem created: ' + problem.slug);
  rl.close();
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length == 0) {
    console.log(`This is an emergency/development script to modify problems only. If you want to modify further, please edit directly in the database or the admin page.\n
Help options:
    --help, -h        Show this help message
    --create          Create a problem
    `);
    process.exit(0);
  }
  if (args.includes('--create')) create().catch((err) => console.error(err));
}

main();
