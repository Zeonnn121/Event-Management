import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { Plus, UserMinus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { Council, User } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { toast } from 'sonner';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  council_lead: 'Council Lead',
  council_member: 'Council Member',
  member: 'Member',
};

const roleVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  super_admin: 'danger',
  council_lead: 'info',
  council_member: 'success',
  member: 'default',
};

/** Roles that must be attached to a council when a super admin creates them. */
const COUNCIL_ROLES = ['council_lead', 'council_member'];

function makeCreateUserSchema(isSuperAdmin: boolean) {
  return z
    .object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Invalid email'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      role: z.enum(['super_admin', 'council_lead', 'council_member', 'member']),
      department: z.string().optional(),
      council_id: z.string().optional(),
    })
    .refine(
      (data) =>
        // A council lead's own council is applied by the API, so the field is
        // hidden for them and must not be required here.
        !isSuperAdmin ||
        !COUNCIL_ROLES.includes(data.role) ||
        !!data.council_id,
      { message: 'Choose a council for this role', path: ['council_id'] }
    );
}

type CreateUserFormData = z.infer<ReturnType<typeof makeCreateUserSchema>>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [roleFilter, setRoleFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', { role: roleFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Council leads are scoped server-side, so the role filter only matters
      // for the super admin.
      if (isSuperAdmin && roleFilter) params.append('role', roleFilter);
      const url = `/api/users${params.size > 0 ? `?${params.toString()}` : ''}`;
      return apiFetch<User[]>(url);
    },
  });

  const { data: councils } = useQuery({
    queryKey: ['councils'],
    queryFn: () => apiFetch<Council[]>('/api/councils?include_inactive=true'),
    enabled: isSuperAdmin,
  });

  const schema = useMemo(() => makeCreateUserSchema(isSuperAdmin), [isSuperAdmin]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: isSuperAdmin ? 'member' : 'council_member',
      council_id: '',
    },
  });

  const selectedRole = watch('role');

  const createMutation = useMutation({
    mutationFn: (data: CreateUserFormData) =>
      apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          department: data.department || undefined,
          council_id: data.council_id ? Number(data.council_id) : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(isSuperAdmin ? 'User created' : 'Council member added');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['councils'] });
      reset({
        role: isSuperAdmin ? 'member' : 'council_member',
        council_id: '',
        name: '',
        email: '',
        password: '',
        department: '',
      });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Detaches someone from their council but keeps their account.
  const removeMutation = useMutation({
    mutationFn: (userId: number) =>
      apiFetch(`/api/users/${userId}/council`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Removed from council');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['councils'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const users = data ?? [];

  if (error) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <h1 className="text-3xl font-semibold text-text mb-8">
          {isSuperAdmin ? 'Users' : 'My Council Members'}
        </h1>
        <ErrorState
          title="Failed to load users"
          message="There was an error loading users."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </motion.div>
    );
  }

  const councilOptions = (councils ?? []).map((c) => ({
    value: String(c.council_id),
    label: c.lead_name ? `${c.name} (lead: ${c.lead_name})` : c.name,
  }));

  // A super admin can detach anyone who is in a council; a council lead can
  // only detach council members (their list is already their own council).
  const canRemoveFromCouncil = (user: User) =>
    user.council_id != null && (isSuperAdmin || user.role === 'council_member');

  const columns = isSuperAdmin ? 'grid-cols-6' : 'grid-cols-5';

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-4 md:p-6 lg:p-8 max-w-6xl"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-text">
            {isSuperAdmin ? 'Users' : 'My Council Members'}
          </h1>
          <p className="text-sm text-muted mt-1">
            {isSuperAdmin
              ? 'Create Super Admins, Council Leads, Council Members, or Members. Council roles need a council.'
              : `Council members of ${currentUser?.council_name ?? 'your council'}.`}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="primary">
              <Plus className="h-4 w-4 mr-2" />
              {isSuperAdmin ? 'Create User' : 'Add Council Member'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isSuperAdmin ? 'Create New User' : 'Add Council Member'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <Input
                {...register('name')}
                label="Name"
                placeholder="Full name"
                error={errors.name?.message}
              />
              <Input
                {...register('email')}
                label="Email"
                type="email"
                placeholder="user@example.com"
                error={errors.email?.message}
              />
              <Input
                {...register('password')}
                label="Password"
                type="password"
                placeholder="At least 8 characters"
                error={errors.password?.message}
              />
              {isSuperAdmin ? (
                <>
                  <Select
                    {...register('role')}
                    label="Role"
                    options={[
                      { value: 'member', label: 'Member (no council)' },
                      { value: 'council_member', label: 'Council Member' },
                      { value: 'council_lead', label: 'Council Lead' },
                      { value: 'super_admin', label: 'Super Admin' },
                    ]}
                    error={errors.role?.message}
                  />
                  {COUNCIL_ROLES.includes(selectedRole) && (
                    <Select
                      {...register('council_id')}
                      label="Council"
                      placeholder="Select a council"
                      options={councilOptions}
                      error={errors.council_id?.message}
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">
                  This person will be added as a{' '}
                  <span className="text-text font-medium">Council Member</span> of{' '}
                  <span className="text-text font-medium">
                    {currentUser?.council_name ?? 'your council'}
                  </span>
                  .
                </p>
              )}
              <Input
                {...register('department')}
                label="Department (Optional)"
                placeholder="Department"
              />
              <Button type="submit" isLoading={isSubmitting} className="w-full">
                {isSuperAdmin ? 'Create User' : 'Add Council Member'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isSuperAdmin && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              label="Filter by Role"
              options={[
                { value: '', label: 'All roles' },
                { value: 'super_admin', label: 'Super Admin' },
                { value: 'council_lead', label: 'Council Lead' },
                { value: 'council_member', label: 'Council Member' },
                { value: 'member', label: 'Member' },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <motion.div
          variants={variants.staggerContainer}
          initial="initial"
          animate="animate"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <motion.div key={i} variants={variants.staggerItem}>
                    <Skeleton className="h-16 w-full" />
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description={
            isSuperAdmin
              ? 'Create your first user to get started.'
              : 'Add your first council member to get started.'
          }
        />
      ) : (
        <motion.div
          variants={variants.staggerContainer}
          initial="initial"
          animate="animate"
        >
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <div className="inline-block min-w-full rounded-lg border border-border">
                <div className={`bg-surface-2 grid ${columns} gap-4 p-4 font-medium text-muted text-sm`}>
                  <div>Name</div>
                  <div>Email</div>
                  <div>Role</div>
                  {isSuperAdmin && <div>Council</div>}
                  <div>Department</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="divide-y divide-border">
                  {users.map((user) => (
                    <motion.div
                      key={user.user_id}
                      variants={variants.staggerItem}
                      className={`grid ${columns} gap-4 p-4 hover:bg-surface-2 transition-colors text-sm items-center`}
                    >
                      <div className="font-medium text-text">
                        {user.name}
                        {!user.is_active && (
                          <Badge variant="warning" className="ml-2">inactive</Badge>
                        )}
                      </div>
                      <div className="text-muted">{user.email}</div>
                      <div>
                        <Badge variant={roleVariants[user.role]}>
                          {roleLabels[user.role] ?? user.role}
                        </Badge>
                      </div>
                      {isSuperAdmin && (
                        <div className="text-text">{user.council_name || '—'}</div>
                      )}
                      <div className="text-text">{user.department || '—'}</div>
                      <div className="flex justify-end">
                        {canRemoveFromCouncil(user) ? (
                          <Button
                            size="sm"
                            variant="danger"
                            isLoading={
                              removeMutation.isPending &&
                              removeMutation.variables === user.user_id
                            }
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove ${user.name} from ${
                                    user.council_name ?? 'their council'
                                  }? Their account is kept, but they lose access to the council.`
                                )
                              ) {
                                removeMutation.mutate(user.user_id);
                              }
                            }}
                          >
                            <UserMinus className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
