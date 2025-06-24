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

// async function proceed() {
//   await prisma.$connect();
//   const oldT = Date.now();
//   const role_name = 'Superuser_Role_' + oldT.toString();
//   const perms = new PermissionsService().addPerms(0n, ['ADMINISTRATOR']).newBit;
//   const role = await prisma.role.create({
//     data: {
//       name: role_name,
//       color: 'ffffff',
//       perms,
//     },
//   });
//   const user_name = 'Superuser_User_' + oldT.toString();
//   const user_email = `emergency_${oldT}@script.com`;
//   const user_pwd = random(15);
//   await prisma.user.create({
//     data: {
//       email: user_email,
//       username: user_name,
//       password: await new Argon2Service().hashPassword(user_pwd),
//       perms,

//       status: 'ACTIVE',
//       roles: {
//         create: {
//           roleId: role.id,
//           assignedAt: new Date(oldT),
//           assignedBy: 'EmergencyScript',
//         },
//       },
//     },
//   });
//   const newT = Date.now();
//   rl.write(
//     `User created:\nEmail: ${user_email}\nPassword: ${user_pwd}\nOperation completed in ${(newT - oldT) / 1000}s`,
//   );
//   rl.close();
// }

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
    --verbose         Enable verbose mode
    `);
    process.exit(0);
  }
  if (args.includes('--create')) create().catch((err) => console.error(err));
}

main();
