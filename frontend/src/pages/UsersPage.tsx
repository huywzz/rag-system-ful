import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authClient, ROLE_LABEL, ROLES, type Role } from '@/lib/auth'

const selectClass = 'h-8 rounded-md border bg-background px-2 text-sm'

// Better Auth client returns { data, error }; turn error into a throw for react-query
async function unwrap<T>(p: Promise<{ data: T | null; error: { message?: string } | null }>) {
  const { data, error } = await p
  if (error) throw new Error(error.message ?? 'Lỗi')
  return data as T
}

export function UsersPage() {
  const qc = useQueryClient()
  const { data: session } = authClient.useSession()
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => unwrap(authClient.admin.listUsers({ query: { limit: 200, sortBy: 'createdAt', sortDirection: 'desc' } })),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const create = useMutation({
    mutationFn: (f: { name: string; email: string; password: string; role: Role }) =>
      // role cast: client types only know the default roles; the server validates against ROLES
      unwrap(authClient.admin.createUser({ ...f, role: f.role as 'admin' })),
    onSuccess: () => toast.success('Đã tạo tài khoản'),
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  })
  const setRole = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => unwrap(authClient.admin.setRole({ ...v, role: v.role as 'admin' })),
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: (userId: string) => unwrap(authClient.admin.removeUser({ userId })),
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  })

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-4">
      <h1 className="text-lg font-semibold">Người dùng</h1>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          const form = e.currentTarget
          create.mutate(
            { name: String(f.get('name')), email: String(f.get('email')), password: String(f.get('password')), role: f.get('role') as Role },
            { onSuccess: () => form.reset() },
          )
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Tên</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-email">Email</Label>
          <Input id="new-email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">Mật khẩu</Label>
          <Input id="new-password" name="password" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-role">Quyền</Label>
          <select id="new-role" name="role" defaultValue="viewer" className={selectClass}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <Button type="submit" disabled={create.isPending}>Tạo tài khoản</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Quyền</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.data?.users.map((u) => {
            const self = u.id === session?.user.id // don't let an admin lock themselves out
            return (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <select
                    aria-label={`Quyền của ${u.email}`}
                    className={selectClass}
                    value={u.role ?? 'viewer'}
                    disabled={self}
                    onChange={(e) => setRole.mutate({ userId: u.id, role: e.target.value as Role })}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </TableCell>
                <TableCell>
                  {!self && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Xóa ${u.email}`}
                      onClick={() => confirm(`Xóa tài khoản ${u.email}?`) && remove.mutate(u.id)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
