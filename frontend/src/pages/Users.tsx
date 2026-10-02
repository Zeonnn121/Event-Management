import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Plus } from 'lucide-react';
import { variants } from '@/lib/motion';
import { apiFetch, apiFetchEnvelope } from '@/lib/api';
import type { User, ApiResponse } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const userSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'organizer', 'member']),
  department: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

const roleVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  admin: 'danger',
  organizer: 'warning',
  member: 'default',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', { role }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (role) params.append('role', role);
      const url = `/api/users${params.size > 0 ? `?${params.toString()}` : ''}`;
      return apiFetchEnvelope<User[]>(url);
    },
  });

  const createMutation = useMutation({
    mutationFn: (formData: UserFormData) =>
      apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created');
      setDialogOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const users = data?.data ?? [];

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

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-4 md:p-6 lg:p-8 max-w-7xl"
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-text">Users</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="primary">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <Input
                {...register('name')}
                label="Name"
                placeholder="John Doe"
                error={errors.name?.message}
              />
              <Input
                {...register('email')}
                label="Email"
                type="email"
                placeholder="john@example.com"
                error={errors.email?.message}
              />
              <Input
                {...register('password')}
                label="Password"
                type="password"
                placeholder="••••••••"
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
                placeholder="Select role"
              />
              <Input
                {...register('department')}
                label="Department (optional)"
                placeholder="Tech, Design, etc."
                error={errors.department?.message}
              />
              <Button type="submit" isLoading={isSubmitting} className="w-full">
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'organizer', label: 'Organizer' },
              { value: 'member', label: 'Member' },
            ]}
            placeholder="All roles"
          />
        </CardContent>
      </Card>

      {/* Users table */}
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
          action={
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="primary">Create User</Button>
              </DialogTrigger>
            </Dialog>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <motion.tr key={user.id} variants={variants.staggerItem}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleVariants[user.role]}>{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted">
                        {user.department || '—'}
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
