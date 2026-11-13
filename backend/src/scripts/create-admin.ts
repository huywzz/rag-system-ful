// Usage: npm run create-admin -- <email> <password> [name]
import { auth } from '../core/auth/auth.js';
import { prisma } from '../core/database/prisma.js';

const [email, password, name = 'Admin'] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> [name]');
  process.exit(1);
}
// server-side call without request headers: allowed by the admin plugin, which is why this is a CLI and not a route
const { user } = await auth.api.createUser({ body: { email, password, name, role: 'admin' } });
console.log(`Created admin ${user.email} (${user.id})`);
await prisma.$disconnect();
