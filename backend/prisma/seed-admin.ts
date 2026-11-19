import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !email || !password || password.length < 12) {
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD com pelo menos 12 caracteres.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    create: { name, email, passwordHash, role: UserRole.ADMIN, status: UserStatus.ACTIVE }
  });
  console.log('Administrador inicial criado/atualizado.');
}

main().finally(() => prisma.$disconnect());