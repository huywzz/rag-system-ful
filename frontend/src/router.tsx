import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { Layout } from '@/components/Layout'
import { authClient } from '@/lib/auth'
import { ChatPage } from '@/pages/ChatPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { LoginPage } from '@/pages/LoginPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { UsersPage } from '@/pages/UsersPage'

const rootRoute = createRootRoute({
  component: Outlet,
  // last-resort screen instead of a blank page when a component crashes
  errorComponent: ({ error, reset }) => (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="font-medium">Đã có lỗi xảy ra</p>
      <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <button className="text-sm underline" onClick={reset}>Thử lại</button>
    </div>
  ),
})

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage })

// UX gate only; the API enforces every permission itself
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: Layout,
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data) throw redirect({ to: '/login' })
    return { user: data.user }
  },
})

const chatRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: ChatPage,
  validateSearch: (s: Record<string, unknown>): { c?: string } => (typeof s.c === 'string' ? { c: s.c } : {}),
})
const documentsRoute = createRoute({ getParentRoute: () => appRoute, path: '/documents', component: DocumentsPage })
const reviewRoute = createRoute({ getParentRoute: () => appRoute, path: '/documents/$id', component: ReviewPage })
const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/users',
  component: UsersPage,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin') throw redirect({ to: '/' })
  },
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([loginRoute, appRoute.addChildren([chatRoute, documentsRoute, reviewRoute, usersRoute])]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
