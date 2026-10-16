import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { variants } from '@/lib/motion';
import { apiFetch, apiFetchEnvelope } from '@/lib/api';
import type { Participant, ApiResponse } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useDebounce } from '@/hooks';

const registrationStatusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  registered: 'success',
  waitlisted: 'warning',
  cancelled: 'danger',
};

interface ParticipantsFilters {
  q: string;
  department: string;
  year: string;
  page: number;
}

export default function ParticipantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') ?? '';
  const department = searchParams.get('department') ?? '';
  const year = searchParams.get('year') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const debouncedQ = useDebounce(q, 300);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['participants', { q: debouncedQ, department, year, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.append('q', debouncedQ);
      if (department) params.append('department', department);
      if (year) params.append('year', year);
      params.append('page', String(page));
      const url = `/api/participants${params.size > 0 ? `?${params.toString()}` : ''}`;
      return apiFetchEnvelope<Participant[]>(url);
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

  const participants = data?.data ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.ceil(total / limit);

  const yearOptions = Array.from({ length: 4 }, (_, i) => ({
    value: String(i + 1),
    label: `Year ${i + 1}`,
  }));

  if (error) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <h1 className="text-3xl font-semibold text-text mb-8">Participants</h1>
        <ErrorState
          title="Failed to load participants"
          message="There was an error loading participants."
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
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-text">Participants</h1>
      </div>

      {/* Search and filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Input
              placeholder="Search by name or email..."
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Select
                value={year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                label="Year"
                options={yearOptions}
                placeholder="All years"
              />
              <Select
                value={department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                label="Department"
                options={[
                  { value: 'Tech', label: 'Tech' },
                  { value: 'Design', label: 'Design' },
                  { value: 'Business', label: 'Business' },
                ]}
                placeholder="All departments"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants table */}
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
      ) : participants.length === 0 ? (
        <EmptyState
          title="No participants found"
          description={q || department || year ? 'Try adjusting your filters.' : 'No participants yet.'}
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
                <div className="bg-surface-2 grid grid-cols-5 gap-4 p-4 font-medium text-muted text-sm">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Department</div>
                  <div>Year</div>
                  <div>Registrations</div>
                </div>
                <div className="divide-y divide-border">
                  {participants.map((participant) => (
                    <motion.div
                      key={participant.participant_id}
                      variants={variants.staggerItem}
                      className="grid grid-cols-5 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm cursor-pointer"
                      onClick={() => navigate(`/participants/${participant.participant_id}`)}
                    >
                      <div className="font-medium text-text">{participant.name}</div>
                      <div className="text-muted">{participant.email}</div>
                      <div className="text-text">{participant.department}</div>
                      <div className="text-text">Year {participant.year}</div>
                      <div className="text-sm text-text">
                        {participant.participation_history?.length ?? 0} events
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pagination */}
      {!isLoading && participants.length > 0 && totalPages > 1 && (
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
