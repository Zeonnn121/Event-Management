import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { variants } from '@/lib/motion';
import { formatNumber } from '@/lib/format';
import { prefersReducedMotion } from '@/lib/motion';
import { useEffect, useState } from 'react';

function StatCard({ label, value, isLoading }: { label: string; value: number; isLoading: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isLoading || prefersReducedMotion()) {
      setDisplayValue(value);
      return;
    }

    let current = 0;
    const increment = value / 30;
    const interval = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(interval);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, 20);

    return () => clearInterval(interval);
  }, [value, isLoading]);

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <>
            <Skeleton className="h-8 mb-2 w-20" />
            <Skeleton className="h-4 w-40" />
          </>
        ) : (
          <>
            <p className="text-4xl font-bold text-primary mb-1 tabular-nums">{formatNumber(displayValue)}</p>
            <p className="text-sm text-muted">{label}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardStats>('/api/dashboard/stats'),
  });

  if (error) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <h1 className="text-3xl font-semibold text-text mb-8">Dashboard</h1>
        <ErrorState
          title="Failed to load dashboard"
          message="There was an error loading your dashboard data."
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
      <h1 className="text-3xl font-semibold text-text mb-8">Dashboard</h1>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
        variants={variants.staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={variants.staggerItem}>
          <StatCard label="Total Events" value={data?.total_events ?? 0} isLoading={isLoading} />
        </motion.div>
        <motion.div variants={variants.staggerItem}>
          <StatCard label="Upcoming Events" value={data?.upcoming_events ?? 0} isLoading={isLoading} />
        </motion.div>
        <motion.div variants={variants.staggerItem}>
          <StatCard label="Completed Events" value={data?.completed_events ?? 0} isLoading={isLoading} />
        </motion.div>
        <motion.div variants={variants.staggerItem}>
          <StatCard label="Total Participants" value={data?.total_participants ?? 0} isLoading={isLoading} />
        </motion.div>
        <motion.div variants={variants.staggerItem}>
          <StatCard label="Total Registrations" value={data?.total_registrations ?? 0} isLoading={isLoading} />
        </motion.div>
        <motion.div variants={variants.staggerItem}>
          <StatCard label="Certificates Issued" value={data?.certificates_issued ?? 0} isLoading={isLoading} />
        </motion.div>
      </motion.div>

      {/* Charts */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Events by category */}
          {data.events_by_category.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Events by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.events_by_category}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="category" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                      labelStyle={{ color: 'var(--text)' }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Events by year */}
          {data.events_by_year.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Events by Year</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.events_by_year}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="year" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                      labelStyle={{ color: 'var(--text)' }}
                    />
                    <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Top events */}
      {data?.top_events && data.top_events.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.top_events.map((event) => (
                <div key={event.event_id} className="flex justify-between items-start pb-4 border-b last:border-0">
                  <div>
                    <p className="font-medium text-text">{event.title}</p>
                    <p className="text-sm text-muted">
                      {event.council_name ?? event.category}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-primary">
                    {event.participants_count ?? 0} participants
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent uploads */}
      {data?.recent_uploads && data.recent_uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recent_uploads.map((file) => (
                <div key={file.file_id} className="flex justify-between items-start pb-4 border-b last:border-0">
                  <div>
                    <p className="font-medium text-text">{file.original_name}</p>
                    <p className="text-sm text-muted">{file.event_title}</p>
                  </div>
                  <p className="text-sm text-muted">{file.file_type}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!data && !isLoading && (
        <EmptyState
          title="No data yet"
          description="Dashboard will populate as you create events and participants."
        />
      )}
    </motion.div>
  );
}
