import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { variants } from '@/lib/motion';
import { apiFetch, apiFetchEnvelope } from '@/lib/api';
import type { Event } from '@/lib/types';
import { formatDate, formatTime } from '@/lib/format';
import { useDebounce } from '@/hooks';
import { cn } from '@/lib/cn';
import { useAuth } from '@/stores/auth';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  planned: 'default',
  registration_open: 'success',
  ongoing: 'info',
  completed: 'warning',
  cancelled: 'danger',
};

export default function MyEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [gridView, setGridView] = useState(true);
  const q = searchParams.get('q') ?? '';
  const year = searchParams.get('year') ?? '';
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const debouncedQ = useDebounce(q, 300);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManageEvents = user?.role === 'super_admin' || user?.role === 'council_lead';

  // Title changes based on role: super_admin sees "My Events", council roles see "Our Events"
  const pageTitle =
    user?.role === 'super_admin' ? 'My Events' : 'Our Events';

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: number) =>
      apiFetch(`/api/events/${eventId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Event deleted');
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-events', { q: debouncedQ, year, category, status, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.append('q', debouncedQ);
      if (year) params.append('year', year);
      if (category) params.append('category', category);
      if (status) params.append('status', status);
      params.append('page', String(page));
      const url = `/api/events/mine${params.size > 0 ? `?${params.toString()}` : ''}`;
      return apiFetchEnvelope<Event[]>(url);
    },
  });

  const handleSearch = (value: string) => {
    setSearchParams((p) => {
      p.set('q', value);
      p.delete('page');
      return p;
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setSearchParams((p) => {
      if (value) {
        p.set(key, value);
      } else {
        p.delete(key);
      }
      p.delete('page');
      return p;
    });
  };

  const events = data?.data ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.ceil(total / limit);

  const statusOptions = [
    { value: 'planned', label: 'Planned' },
    { value: 'registration_open', label: 'Registration Open' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  if (error) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <h1 className="text-3xl font-semibold text-text mb-8">{pageTitle}</h1>
        <ErrorState
          title="Failed to load events"
          message="There was an error loading your events."
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
        <h1 className="text-3xl font-semibold text-text">{pageTitle}</h1>
        {canManageEvents && (
          <Button variant="primary" onClick={() => navigate('/events/new')}>New Event</Button>
        )}
      </div>

      {/* Search and filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Input
              placeholder="Search events..."
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="Year"
                placeholder="All years"
                value={year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                type="number"
              />
              <Input
                label="Category"
                placeholder="All categories"
                value={category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              />
              <Select
                value={status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label="Status"
                options={statusOptions}
                placeholder="All statuses"
              />
              <div className="flex items-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGridView(!gridView)}
                  className="flex-1"
                >
                  {gridView ? 'List' : 'Grid'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events grid/list */}
      {isLoading ? (
        <motion.div
          className={cn(
            'grid gap-4',
            gridView ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''
          )}
          variants={variants.staggerContainer}
          initial="initial"
          animate="animate"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <motion.div key={i} variants={variants.staggerItem}>
              <Card>
                <CardContent className="pt-6">
                  <Skeleton className="h-6 mb-4 w-32" />
                  <Skeleton className="h-4 mb-2 w-full" />
                  <Skeleton className="h-4 w-48" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No events found"
          description={
            q || year || category || status
              ? 'Try adjusting your filters.'
              : user?.role === 'super_admin'
              ? 'You have not created any events yet.'
              : 'No events have been created for your council yet.'
          }
          action={
            canManageEvents ? (
              <Button variant="primary" onClick={() => navigate('/events/new')}>
                Create Event
              </Button>
            ) : undefined
          }
        />
      ) : (
        <motion.div
          className={cn(
            'grid gap-4',
            gridView ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''
          )}
          variants={variants.staggerContainer}
          initial="initial"
          animate="animate"
        >
          {events.map((event) => (
            <motion.div key={event.event_id} variants={variants.staggerItem}>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/events/${event.event_id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-semibold text-text line-clamp-2">{event.title}</h3>
                    <Badge variant={statusVariants[event.status]}>{event.status}</Badge>
                  </div>
                  <p className="text-sm text-muted mb-2">{event.venue}</p>
                  <p className="text-sm text-muted mb-4">
                    {formatDate(event.event_date)} at {formatTime(event.start_time)}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">
                      {event.registration_count ?? 0} / {event.capacity}
                    </span>
                    <span className="text-primary font-medium">{event.category}</span>
                  </div>
                  {canManageEvents && (
                    <div className="mt-4 flex justify-end">
                      <Button
                        size="sm"
                        variant="danger"
                        isLoading={
                          deleteEventMutation.isPending &&
                          deleteEventMutation.variables === event.event_id
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete "${event.title}"? This cannot be undone.`)) {
                            deleteEventMutation.mutate(event.event_id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {!isLoading && events.length > 0 && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-muted">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setSearchParams((p) => { p.set('page', String(page - 1)); return p; })}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page === totalPages}
              onClick={() => setSearchParams((p) => { p.set('page', String(page + 1)); return p; })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
