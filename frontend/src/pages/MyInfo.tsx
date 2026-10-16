import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { toast } from 'sonner';

interface Profile {
  participant_id: number | null;
  name: string;
  email: string;
  department: string | null;
  year: number | null;
  phone: string | null;
}

const yearOptions = [
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
];

const branchOptions = [
  { value: 'CSE', label: 'CSE' },
  { value: 'COMPS', label: 'COMPS' },
  { value: 'ECS', label: 'ECS' },
  { value: 'MECH', label: 'MECH' },
];

export default function MyInfoPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<Profile>('/api/profile'),
  });

  // Split the stored name into first/last for the form
  const splitName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [year, setYear] = useState('');
  const [department, setDepartment] = useState('');

  // Seed form when profile loads
  useEffect(() => {
    if (!profile) return;
    const { first, last } = splitName(profile.name ?? '');
    setFirstName(first);
    setLastName(last);
    setPhone(profile.phone ?? '');
    setYear(profile.year ? String(profile.year) : '');
    setDepartment(profile.department ?? '');
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (body: { name: string; phone?: string; year: number; department: string }) =>
      apiFetch<Profile>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile saved!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { toast.error('First name is required'); return; }
    if (!year) { toast.error('Please select your year'); return; }
    if (!department) { toast.error('Please select your branch'); return; }

    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    saveMutation.mutate({
      name,
      phone: phone || undefined,
      year: parseInt(year, 10),
      department,
    });
  };

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      className="p-4 md:p-6 lg:p-8 max-w-lg"
    >
      <h1 className="text-3xl font-semibold text-text mb-6">My Info</h1>
      <p className="text-sm text-muted mb-6">
        Fill in your details once. They'll be used automatically when you register for events.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Aryan"
                  required
                />
                <Input
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Shah"
                />
              </div>
              <Input
                label="Email"
                value={user?.email ?? ''}
                disabled
                className="opacity-60 cursor-not-allowed"
              />
              <Input
                label="Mobile (optional)"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
              <Select
                label="Year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                options={yearOptions}
                placeholder="Select year"
              />
              <Select
                label="Branch"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={branchOptions}
                placeholder="Select branch"
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={saveMutation.isPending}
              >
                Save Info
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
