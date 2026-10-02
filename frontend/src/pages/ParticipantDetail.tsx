import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { Participant } from '@/lib/types';
import { formatDate } from '@/lib/format';

const registrationStatusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  registered: 'success',
  waitlisted: 'warning',
  cancelled: 'danger',
};

export default function ParticipantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const participantId = parseInt(id ?? '0', 10);

  const { data: participant, isLoading, error, refetch } = useQuery({
    queryKey: ['participant', participantId],
    queryFn: () => apiFetch<Participant>(`/api/participants/${participantId}`),
  });

  if (error) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <h1 className="text-3xl font-semibold text-text mb-8">Participant</h1>
        <ErrorState
          title="Participant not found"
          message="This participant doesn't exist or has been deleted."
          action={<Button onClick={() => window.history.back()}>Go Back</Button>}
        />
      </motion.div>
    );
  }

  if (isLoading || !participant) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-32 w-full mb-6" />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-4 md:p-6 lg:p-8 max-w-4xl"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-text">{participant.name}</h1>
        <p className="text-muted mt-2">{participant.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted">Department</p>
            <p className="text-lg font-semibold text-text">{participant.department}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted">Year</p>
            <p className="text-lg font-semibold text-text">Year {participant.year}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted">Total Events</p>
            <p className="text-lg font-semibold text-text">
              {participant.participation_history?.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {participant.participation_history && participant.participation_history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Participation History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full rounded-lg border border-border">
                <div className="bg-surface-2 grid grid-cols-4 gap-4 p-4 font-medium text-muted text-sm">
                  <div>Event</div>
                  <div>Status</div>
                  <div>Present</div>
                  <div>Date</div>
                </div>
                <div className="divide-y divide-border">
                  {participant.participation_history.map((reg) => (
                    <div key={reg.id} className="grid grid-cols-4 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm">
                      <div className="text-text">Event {reg.event_id}</div>
                      <div>
                        <Badge variant={registrationStatusVariants[reg.status]}>
                          {reg.status}
                        </Badge>
                      </div>
                      <div>
                        {reg.present ? (
                          <Badge variant="success">Present</Badge>
                        ) : (
                          <Badge variant="danger">Absent</Badge>
                        )}
                      </div>
                      <div className="text-muted">{formatDate(reg.registered_date)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No participation history"
          description="This participant hasn't been registered for any events yet."
        />
      )}
    </motion.div>
  );
}
