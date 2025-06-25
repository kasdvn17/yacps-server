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
  const name = await ask(
    'Enter the name of the type (only alphabets and numeric characters): ',
  );
  if (typeof name != 'string' || !new RegExp('^[a-zA-Z0-9 ]*$').test(name)) {
    console.log('Invalid option.');
    process.exit(1);
  }
  const type = await prisma.type.create({
    data: {
      name,
    },
  });
  rl.write('Type created: ' + type.name);
  rl.close();
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length == 0) {
    console.log(`This is an emergency script to modify categories only. If you want to modify further, please edit directly in the database or the admin page.\n
Help options:
    --help, -h        Show this help message
    --create          Create a type
    `);
    process.exit(0);
  }
  if (args.includes('--create')) create().catch((err) => console.error(err));
}

main();
