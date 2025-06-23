import { Argon2Service } from '@/client-api/argon2/argon2.service';
import { PermissionsService } from '@/client-api/auth/permissions.service';
import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function random(length) {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

async function proceed() {
  await prisma.$connect();
  const oldT = Date.now();
  const role_name = 'Superuser_Role_' + oldT.toString();
  const perms = new PermissionsService().addPerms(0n, ['ADMINISTRATOR']).newBit;
  const role = await prisma.role.create({
    data: {
      name: role_name,
      color: 'ffffff',
      perms,
    },
  });
  const user_name = 'Superuser_User_' + oldT.toString();
  const user_email = `emergency_${oldT}@script.com`;
  const user_pwd = random(15);
  await prisma.user.create({
    data: {
      email: user_email,
      username: user_name,
      password: await new Argon2Service().hashPassword(user_pwd),
      perms,

      status: 'ACTIVE',
      roles: {
        create: {
          roleId: role.id,
          assignedAt: new Date(oldT),
          assignedBy: 'EmergencyScript',
        },
      },
    },
  });
  const newT = Date.now();
  rl.write(
    `User created:\nEmail: ${user_email}\nPassword: ${user_pwd}\nOperation completed in ${(newT - oldT) / 1000}s`,
  );
  rl.close();
}

function main() {
  rl.write(
    `This script should only be used in emergency situations, where there is no accessible administrator account.\nIt will generate a Superuser role and a new account to ensure there's no conflict with the old roles.\nPlease remember, if you have modified the system's permissions system, this script might not work as expected.\n`,
  );
  rl.question('>> Type "yes" to proceed with this operation: ', (ans) => {
    if (ans != 'yes') {
      rl.write('Operation cancelled.');
      rl.close();
    } else proceed().catch((err) => console.error(err));
  });
}

main();
