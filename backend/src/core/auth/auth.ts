import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access';
import { prisma } from '../database/prisma.js';
import { env } from '../config/env.js';

const ac = createAccessControl(defaultStatements);

/** System roles. Routes check them with @Roles([...]) from @thallesp/nestjs-better-auth. */
export const ROLES = {
  admin: ac.newRole(adminAc.statements), // manage users + documents
  editor: ac.newRole(userAc.statements), // upload/delete documents
  viewer: ac.newRole(userAc.statements), // ask questions only
};
export type Role = keyof typeof ROLES;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],
  // Internal app: no self sign-up, admins create accounts (first admin: npm run create-admin).
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [admin({ ac, roles: ROLES, defaultRole: 'viewer' })],
});
