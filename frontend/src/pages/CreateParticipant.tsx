import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { Participant } from '@/lib/types';
import { toast } from 'sonner';

const createParticipantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  department: z.string().min(1, 'Department is required'),
  year: z.coerce.number().int().min(1).max(4),
  phone: z.string().optional(),
});

type CreateParticipantFormData = z.infer<typeof createParticipantSchema>;

export default function CreateParticipantPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateParticipantFormData>({
    resolver: zodResolver(createParticipantSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateParticipantFormData) =>
      apiFetch<Participant>('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (created) => {
      toast.success('Participant created');
      navigate(`/participants/${created.participant_id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const departmentOptions = [
    { value: 'Tech', label: 'Tech' },
    { value: 'Design', label: 'Design' },
    { value: 'Business', label: 'Business' },
  ];

  const yearOptions = [
    { value: '1', label: 'Year 1' },
    { value: '2', label: 'Year 2' },
    { value: '3', label: 'Year 3' },
    { value: '4', label: 'Year 4' },
  ];

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-4 md:p-6 lg:p-8 max-w-2xl"
    >
      <h1 className="text-3xl font-semibold text-text mb-6">Create Participant</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <Input
              {...register('name')}
              label="Name"
              placeholder="Participant name"
              error={errors.name?.message}
            />
            <Input
              {...register('email')}
              label="Email"
              type="email"
              placeholder="participant@example.com"
              error={errors.email?.message}
            />
            <Select
              {...register('department')}
              label="Department"
              options={departmentOptions}
              error={errors.department?.message}
            />
            <Select
              {...register('year')}
              label="Year"
              options={yearOptions}
              error={errors.year?.message}
            />
            <Input
              {...register('phone')}
              label="Phone (Optional)"
              type="tel"
              placeholder="+1234567890"
            />
            <div className="flex gap-2 pt-4">
              <Button type="submit" isLoading={isSubmitting}>
                Create Participant
              </Button>
              <Button variant="secondary" onClick={() => navigate('/participants')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
