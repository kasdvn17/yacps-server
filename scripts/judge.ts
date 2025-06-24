import { JwtService } from '@nestjs/jwt';
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
  const name = await ask('Enter the name of the judge: ');
  const host = await ask('Enter the FQDN host of the judge: ');
  const ip = await ask(
    'Enter the IP Address of the judge (optional - press enter to skip): ',
  );
  const haveIp = ip == '' ? false : true;
  if (
    typeof name != 'string' ||
    typeof host != 'string' ||
    typeof ip != 'string'
  ) {
    console.log('Invalid option.');
    process.exit(1);
  }
  const judge = await prisma.judge.create({
    data: {
      name: name,
      host,
      ip: haveIp ? ip : undefined,
      lastActive: new Date(0),
    },
  });
  const judgeToken = await prisma.judgeToken.create({
    data: {
      judgeId: judge.id,
    },
  });
  const payloadToken = {
    id: judgeToken.id,
    createdAt: judgeToken.createdAt,
  };
  const token = await new JwtService().signAsync(payloadToken, {
    secret: process.env.JWT_JUDGE_TOKEN,
  });
  rl.write('Token generated: ' + token);
  rl.close();
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length == 0) {
    console.log(`Help options:
    --help, -h        Show this help message
    --create          Create a custom judge, including judge token
    `);
    process.exit(0);
  }
  if (args.includes('--create')) create().catch((err) => console.error(err));
}

main();
