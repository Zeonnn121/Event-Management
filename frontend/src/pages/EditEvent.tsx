import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { Event } from '@/lib/types';
import { toast } from 'sonner';

const editEventSchema = z.object({
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

type EditEventFormData = z.infer<typeof editEventSchema>;

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id ?? '0', 10);
  const navigate = useNavigate();

  const { data: event, isLoading, error, refetch } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiFetch<Event>(`/api/events/${eventId}`),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditEventFormData>({
    resolver: zodResolver(editEventSchema),
    defaultValues: {
      title: event?.title,
      description: event?.description,
      category: event?.category,
      event_date: event?.event_date,
      start_time: event?.start_time,
      end_time: event?.end_time,
      venue: event?.venue,
      capacity: event?.capacity,
      registration_deadline: event?.registration_deadline,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: EditEventFormData) =>
      apiFetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success('Event updated');
      navigate(`/events/${eventId}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (error) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <h1 className="text-3xl font-semibold text-text mb-8">Edit Event</h1>
        <ErrorState
          title="Event not found"
          message="This event doesn't exist or has been deleted."
          action={<Button onClick={() => navigate('/events')}>Go Back</Button>}
        />
      </motion.div>
    );
  }

  if (isLoading || !event) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-96 w-full" />
      </motion.div>
    );
  }

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
      <h1 className="text-3xl font-semibold text-text mb-6">Edit Event</h1>

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
                Save Changes
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/events/${eventId}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
