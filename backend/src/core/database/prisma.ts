import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../../generated/prisma/client.js';

// The adapter ignores ?schema= in the URL, while `prisma migrate` honours it; pass it on so both agree.
const schema = new URL(env.DATABASE_URL).searchParams.get('schema') ?? undefined;

// One client for both Better Auth and the repositories (PrismaClient is provided to DI in AppModule).
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }, { schema }),
});
