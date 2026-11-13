import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { authClient, ROLE_LABEL, type Role } from '@/lib/auth'

const navClass = 'text-sm text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium'

export function Layout() {
  const { data } = authClient.useSession()
  const navigate = useNavigate()
  const role = data?.user.role as Role | undefined

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-6 border-b px-4 py-3">
        <span className="font-semibold">RAG nội bộ</span>
        <nav className="flex gap-4">
          <Link to="/" className={navClass}>Hỏi đáp</Link>
          <Link to="/documents" className={navClass}>Tài liệu</Link>
          {role === 'admin' && <Link to="/users" className={navClass}>Người dùng</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">{data?.user.email}</span>
          {role && <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await authClient.signOut()
              navigate({ to: '/login' })
            }}
          >
            Đăng xuất
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
