import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

const createEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  event_date: z.string().min(1, 'Event date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  venue: z.string().min(1, 'Venue is required'),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
  registration_deadline: z.string().optional(),
  coordinator_id: z.coerce.number().optional(),
});

type CreateEventFormData = z.infer<typeof createEventSchema>;

export default function CreateEventPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      capacity: 100,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateEventFormData) =>
      apiFetch<{ event_id: number }>('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Untouched date/optional inputs submit as "", which the API rejects.
        // Omit them so the backend applies its own default (null) instead.
        body: JSON.stringify({
          ...data,
          description: data.description || undefined,
          registration_deadline: data.registration_deadline || undefined,
          coordinator_id: data.coordinator_id || undefined,
        }),
      }),
    onSuccess: (res) => {
      toast.success('Event created');
      navigate(`/events/${res.event_id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const categoryOptions = [
    { value: 'Workshop', label: 'Workshop' },
    { value: 'Seminar', label: 'Seminar' },
    { value: 'Conference', label: 'Conference' },
    { value: 'Hackathon', label: 'Hackathon' },
    { value: 'Meetup', label: 'Meetup' },
  ];

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-4 md:p-6 lg:p-8 max-w-2xl"
    >
      <h1 className="text-3xl font-semibold text-text mb-6">Create Event</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <Input
              {...register('title')}
              label="Title"
              placeholder="Event title"
              error={errors.title?.message}
            />
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Description</label>
              <textarea
                {...register('description')}
                placeholder="Event description"
                rows={4}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
              />
            </div>
            <Select
              {...register('category')}
              label="Category"
              options={categoryOptions}
              error={errors.category?.message}
            />
            <Input
              {...register('event_date')}
              label="Event Date"
              type="date"
              error={errors.event_date?.message}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                {...register('start_time')}
                label="Start Time"
                type="time"
                error={errors.start_time?.message}
              />
              <Input
                {...register('end_time')}
                label="End Time"
                type="time"
                error={errors.end_time?.message}
              />
            </div>
            <Input
              {...register('venue')}
              label="Venue"
              placeholder="Event venue"
              error={errors.venue?.message}
            />
            <Input
              {...register('capacity')}
              label="Capacity"
              type="number"
              min="1"
              error={errors.capacity?.message}
            />
            <Input
              {...register('registration_deadline')}
              label="Registration Deadline"
              type="date"
            />
            <div className="flex gap-2 pt-4">
              <Button type="submit" isLoading={isSubmitting}>
                Create Event
              </Button>
              <Button variant="secondary" onClick={() => navigate('/events')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
