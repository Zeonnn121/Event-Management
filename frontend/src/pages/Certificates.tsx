import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { Certificate } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Download } from 'lucide-react';

export default function CertificatesPage() {
  const [viewMode, setViewMode] = useState<'event' | 'participant'>('event');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => apiFetch<Certificate[]>('/api/certificates'),
  });

  if (error) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <h1 className="text-3xl font-semibold text-text mb-8">Certificates</h1>
        <ErrorState
          title="Failed to load certificates"
          message="There was an error loading certificates."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </motion.div>
    );
  }

  const certificates = data ?? [];

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-4 md:p-6 lg:p-8 max-w-7xl"
    >
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-text mb-4">Certificates</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('event')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              viewMode === 'event'
                ? 'bg-primary text-primary-fg'
                : 'bg-surface-2 text-text hover:bg-border'
            }`}
          >
            By Event
          </button>
          <button
            onClick={() => setViewMode('participant')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              viewMode === 'participant'
                ? 'bg-primary text-primary-fg'
                : 'bg-surface-2 text-text hover:bg-border'
            }`}
          >
            By Participant
          </button>
        </div>
      </div>

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
      ) : certificates.length === 0 ? (
        <EmptyState
          title="No certificates"
          description="Certificates will appear here once events are completed and certificates are issued."
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
                  <div>{viewMode === 'event' ? 'Event' : 'Participant'}</div>
                  <div>{viewMode === 'event' ? 'Participant' : 'Event'}</div>
                  <div>Status</div>
                  <div>Issued</div>
                  <div>Action</div>
                </div>
                <div className="divide-y divide-border">
                  {certificates.map((cert) => (
                    <motion.div key={cert.certificate_id} variants={variants.staggerItem} className="grid grid-cols-5 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm">
                      <div className="text-text">{viewMode === 'event' ? `Event ${cert.event_id}` : `Participant ${cert.participant_id}`}</div>
                      <div className="text-text">{viewMode === 'event' ? `Participant ${cert.participant_id}` : `Event ${cert.event_id}`}</div>
                      <div>
                        <Badge variant={cert.status === 'issued' ? 'success' : 'default'}>
                          {cert.status}
                        </Badge>
                      </div>
                      <div className="text-muted">
                        {cert.issued_date ? formatDate(cert.issued_date) : '—'}
                      </div>
                      <div>
                        {cert.status === 'issued' && (
                          <Button size="sm" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
