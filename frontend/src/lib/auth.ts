import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

// baseURL = this origin: Vite proxies /api to NestJS, so auth cookies stay first-party
export const authClient = createAuthClient({ plugins: [adminClient()] })

// keep in sync with ROLES in backend/src/core/auth/auth.ts
export const ROLES = ['admin', 'editor', 'viewer'] as const
export type Role = (typeof ROLES)[number]
export const ROLE_LABEL: Record<Role, string> = { admin: 'Quản trị', editor: 'Biên tập', viewer: 'Xem' }

export const canEditDocs = (role?: string | null) => role === 'admin' || role === 'editor'
