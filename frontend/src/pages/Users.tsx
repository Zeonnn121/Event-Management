import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { User } from '@/lib/types';
import { toast } from 'sonner';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'organizer', 'member']),
  department: z.string().optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', { role: roleFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      const url = `/api/users${params.size > 0 ? `?${params.toString()}` : ''}`;
      return apiFetch<User[]>(url);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserFormData) =>
      apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success('User created');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      reset();
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
        <h1 className="text-3xl font-semibold text-text mb-8">Users</h1>
        <ErrorState
          title="Failed to load users"
          message="There was an error loading users."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </motion.div>
    );
  }

  const roleVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    admin: 'danger',
    organizer: 'info',
    member: 'default',
  };

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-4 md:p-6 lg:p-8 max-w-6xl"
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-text">Users</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="primary">
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
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
              <Select
                {...register('role')}
                label="Role"
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'organizer', label: 'Organizer' },
                  { value: 'member', label: 'Member' },
                ]}
                error={errors.role?.message}
              />
              <Input
                {...register('department')}
                label="Department (Optional)"
                placeholder="Department"
              />
              <Button type="submit" isLoading={isSubmitting} className="w-full">
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            label="Filter by Role"
            options={[
              { value: '', label: 'All roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'organizer', label: 'Organizer' },
              { value: 'member', label: 'Member' },
            ]}
          />
        </CardContent>
      </Card>

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
          description="Create your first user to get started."
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
                <div className="bg-surface-2 grid grid-cols-4 gap-4 p-4 font-medium text-muted text-sm">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Role</div>
                  <div>Department</div>
                </div>
                <div className="divide-y divide-border">
                  {users.map((user) => (
                    <motion.div key={user.id} variants={variants.staggerItem} className="grid grid-cols-4 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm">
                      <div className="font-medium text-text">{user.name}</div>
                      <div className="text-muted">{user.email}</div>
                      <div>
                        <Badge variant={roleVariants[user.role]}>{user.role}</Badge>
                      </div>
                      <div className="text-text">{user.department || '—'}</div>
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
