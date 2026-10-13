import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/stores/auth';
import { apiFetch } from '@/lib/api';
import { setAuthToken, setOnUnauthorized } from '@/lib/api';
import { toast } from 'sonner';
import type { User } from '@/lib/types';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const skipLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch<{ token: string; user: User }>('/api/auth/dev-login', {
        method: 'POST',
        skipAuth: true,
      });

      setAuthToken(response.token);
      setOnUnauthorized(() => {
        useAuth.setState({ token: null, user: null });
        navigate('/login', { replace: true });
      });
      setSession(response.token, response.user);
      navigate('/', { replace: true });
      toast.success('Skipped login in development mode');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to skip login';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        skipAuth: true,
      });

      setAuthToken(response.token);
      setOnUnauthorized(() => {
        useAuth.setState({ token: null, user: null });
        navigate('/login', { replace: true });
      });
      setSession(response.token, response.user);
      navigate('/', { replace: true });
      toast.success('Logged in successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Login failed';
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
          <h1 className="text-2xl font-bold text-text mb-6 text-center">Technical Council</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('email')}
              label="Email"
              type="email"
              placeholder="admin@council.edu"
              error={errors.email?.message}
            />
            <Input
              {...register('password')}
              label="Password"
              type="password"
              placeholder="Admin@123"
              error={errors.password?.message}
            />
            <Button type="submit" isLoading={isLoading} className="w-full">
              Sign in
            </Button>
          </form>
          {import.meta.env.DEV && (
            <div className="space-y-4">
              <Button
                type="button"
                variant="secondary"
                onClick={skipLogin}
                isLoading={isLoading}
                className="w-full"
              >
                Skip for now
              </Button>
              <div className="pt-4 border-t border-border text-xs text-muted">
                <p className="font-semibold mb-2">Demo credentials:</p>
                <p>Email: admin@council.edu</p>
                <p>Password: Admin@123</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
