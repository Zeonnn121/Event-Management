import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/stores/auth';
import { apiFetch, setAuthToken, setOnUnauthorized } from '@/lib/api';
import { toast } from 'sonner';
import type { User } from '@/lib/types';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['member', 'council_lead']),
    department: z.string().optional(),
    council_name: z.string().optional(),
    message: z.string().optional(),
  })
  .refine((data) => data.role !== 'council_lead' || !!data.council_name?.trim(), {
    message: 'Tell us the name of your council',
    path: ['council_name'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

type RegisterResponse = {
  token?: string;
  user?: User;
  pending?: boolean;
  message?: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'member' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const response = await apiFetch<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          department: data.department || undefined,
          council_name: data.council_name || undefined,
          message: data.message || undefined,
        }),
        skipAuth: true,
      });

      // Council Lead: queued for approval, no session yet.
      if (response.pending) {
        toast.success(response.message ?? 'Request submitted for approval');
        navigate('/login', { replace: true });
        return;
      }

      if (response.token && response.user) {
        setAuthToken(response.token);
        setOnUnauthorized(() => {
          useAuth.setState({ token: null, user: null });
          navigate('/login', { replace: true });
        });
        setSession(response.token, response.user);
        navigate('/', { replace: true });
        toast.success('Welcome!');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Registration failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center bg-bg p-4"
    >
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold text-text mb-1 text-center">Create your account</h1>
          <p className="text-sm text-muted text-center mb-6">Technical Council</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('name')}
              label="Full name"
              placeholder="Your name"
              error={errors.name?.message}
            />
            <Input
              {...register('email')}
              label="Email"
              type="email"
              placeholder="you@example.com"
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
              label="I am joining as"
              options={[
                { value: 'member', label: 'Member — instant access' },
                { value: 'council_lead', label: 'Council Lead — needs approval' },
              ]}
              error={errors.role?.message}
            />
            {selectedRole === 'council_lead' && (
              <>
                <Input
                  {...register('council_name')}
                  label="Council name"
                  placeholder="e.g. Coding Council"
                  error={errors.council_name?.message}
                  helperText="The Super Admin reviews this and creates your council on approval."
                />
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Why should we approve you? (Optional)
                  </label>
                  <textarea
                    {...register('message')}
                    rows={3}
                    placeholder="Tell the Super Admin about your plans"
                    className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                  />
                </div>
              </>
            )}
            <Input
              {...register('department')}
              label="Department (Optional)"
              placeholder="Department"
            />
            <Button type="submit" isLoading={isLoading} className="w-full">
              {selectedRole === 'council_lead' ? 'Request Council Lead access' : 'Create account'}
            </Button>
          </form>
          <p className="text-sm text-muted text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
