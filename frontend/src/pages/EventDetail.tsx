import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { Upload, Download, Plus, Check, X } from 'lucide-react';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { Event, Registration, AttendanceResponse, Certificate, FileRecord, Outcome, Participant } from '@/lib/types';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const statusTransitions: Record<string, string[]> = {
  planned: ['registration_open', 'cancelled'],
  registration_open: ['ongoing', 'cancelled'],
  ongoing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  planned: 'default',
  registration_open: 'success',
  ongoing: 'info',
  completed: 'warning',
  cancelled: 'danger',
};

const registrationStatusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  registered: 'success',
  waitlisted: 'warning',
  cancelled: 'danger',
};

const outcomeSchema = z.object({
  participants_count: z.coerce.number().int().min(0).optional(),
  feedback_score: z.coerce.number().min(0).max(5).optional(),
  winners: z.string().optional(),
  description: z.string().optional(),
});

type OutcomeFormData = z.infer<typeof outcomeSchema>;

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id ?? '0', 10);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'attendance' | 'files' | 'certificates' | 'outcome'>('overview');

  const { data: event, isLoading, error, refetch } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiFetch<Event>(`/api/events/${eventId}`),
  });

  const { data: registrations } = useQuery({
    queryKey: ['event-registrations', eventId],
    enabled: event?.id === eventId && activeTab === 'registrations',
    queryFn: () => apiFetch<Registration[]>(`/api/events/${eventId}/registrations`),
  });

  const { data: attendance } = useQuery({
    queryKey: ['event-attendance', eventId],
    enabled: event?.id === eventId && activeTab === 'attendance',
    queryFn: () => apiFetch<AttendanceResponse>(`/api/events/${eventId}/attendance`),
  });

  const { data: files } = useQuery({
    queryKey: ['event-files', eventId],
    enabled: event?.id === eventId && activeTab === 'files',
    queryFn: () => apiFetch<FileRecord[]>(`/api/events/${eventId}/files`),
  });

  const { data: certificates } = useQuery({
    queryKey: ['event-certificates', eventId],
    enabled: event?.id === eventId && activeTab === 'certificates',
    queryFn: () => apiFetch<Certificate[]>(`/api/events/${eventId}/certificates`),
  });

  const { data: outcome } = useQuery({
    queryKey: ['event-outcome', eventId],
    enabled: event?.id === eventId && activeTab === 'outcome',
    queryFn: () => apiFetch<Outcome>(`/api/events/${eventId}/outcome`),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/api/events/${eventId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Status updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const outcomeMutation = useMutation({
    mutationFn: (data: OutcomeFormData) =>
      apiFetch(`/api/events/${eventId}/outcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-outcome', eventId] });
      toast.success('Outcome saved');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OutcomeFormData>({
    resolver: zodResolver(outcomeSchema),
    defaultValues: {
      participants_count: outcome?.participants_count,
      feedback_score: outcome?.feedback_score,
      winners: outcome?.winners,
      description: outcome?.description,
    },
  });

  if (error || !eventId) {
    return (
      <motion.div
        variants={variants.pageEnter}
        initial="initial"
        animate="animate"
        className="p-4 md:p-6 lg:p-8"
      >
        <h1 className="text-3xl font-semibold text-text mb-8">Event Detail</h1>
        <ErrorState
          title="Event not found"
          message="This event doesn't exist or has been deleted."
          action={<Button onClick={() => window.history.back()}>Go Back</Button>}
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
        <Skeleton className="h-32 w-full mb-6" />
      </motion.div>
    );
  }

  const validTransitions = statusTransitions[event.status] || [];

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-4 md:p-6 lg:p-8 max-w-6xl"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-text">{event.title}</h1>
            <p className="text-muted mt-2">{event.venue}</p>
          </div>
          <Badge variant={statusVariants[event.status]}>{event.status}</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted">Date</p>
            <p className="font-medium text-text">{formatDate(event.event_date)}</p>
          </div>
          <div>
            <p className="text-muted">Time</p>
            <p className="font-medium text-text">
              {formatTime(event.start_time)} - {formatTime(event.end_time)}
            </p>
          </div>
          <div>
            <p className="text-muted">Capacity</p>
            <p className="font-medium text-text">
              {event.registration_count ?? 0} / {event.capacity}
            </p>
          </div>
          <div>
            <p className="text-muted">Category</p>
            <p className="font-medium text-text">{event.category}</p>
          </div>
        </div>
      </div>

      {/* Status control & actions */}
      <Card className="mb-6">
        <CardContent className="pt-6 flex flex-wrap gap-2">
          <Select
            value={event.status}
            onChange={(e) => {
              const newStatus = e.target.value;
              if (validTransitions.includes(newStatus)) {
                statusMutation.mutate(newStatus);
              }
            }}
            options={validTransitions.map((s) => ({ value: s, label: s }))}
            placeholder="Change status"
          />
          {validTransitions.length === 0 && (
            <div className="text-sm text-muted">This event is in a terminal state.</div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['overview', 'registrations', 'attendance', 'files', 'certificates', 'outcome'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`px-4 py-2 rounded-md font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-fg'
                : 'bg-surface-2 text-text hover:bg-border'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div variants={variants.pageEnter} initial="initial" animate="animate">
        {/* Overview */}
        {activeTab === 'overview' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="font-semibold text-text mb-2">Description</h3>
                <p className="text-muted">{event.description || 'No description provided.'}</p>
              </div>
              {event.organizers && (
                <div>
                  <h3 className="font-semibold text-text mb-2">Organizers</h3>
                  <ul className="space-y-1 text-muted">
                    {event.organizers.map((org) => (
                      <li key={org.id}>{org.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {event.outcome && (
                <div>
                  <h3 className="font-semibold text-text mb-2">Outcome Summary</h3>
                  <p className="text-muted">{event.outcome.description}</p>
                  {event.outcome.feedback_score && (
                    <p className="text-muted">
                      Feedback Score: {event.outcome.feedback_score} / 5
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Registrations */}
        {activeTab === 'registrations' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Registrations</CardTitle>
                <Button size="sm" variant="primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Registration
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!registrations || registrations.length === 0 ? (
                <EmptyState
                  title="No registrations"
                  description="No participants registered for this event yet."
                />
              ) : (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full rounded-lg border border-border">
                    <div className="bg-surface-2 grid grid-cols-4 gap-4 p-4 font-medium text-muted text-sm">
                      <div>Participant</div>
                      <div>Status</div>
                      <div>Registered</div>
                      <div></div>
                    </div>
                    <div className="divide-y divide-border">
                      {registrations.map((reg) => (
                        <div key={reg.id} className="grid grid-cols-4 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm">
                          <div className="text-text">Participant {reg.participant_id}</div>
                          <div>
                            <Badge variant={registrationStatusVariants[reg.status]}>
                              {reg.status}
                            </Badge>
                          </div>
                          <div className="text-muted">
                            {formatDate(reg.registered_date)}
                          </div>
                          <div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Attendance */}
        {activeTab === 'attendance' && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {!attendance || attendance.data.length === 0 ? (
                <EmptyState
                  title="No attendance records"
                  description="Attendance will be tracked once registrations exist."
                />
              ) : (
                <div>
                  <div className="mb-6 grid grid-cols-3 gap-4">
                    <div className="bg-surface-2 rounded-md p-4">
                      <p className="text-sm text-muted">Registered</p>
                      <p className="text-2xl font-bold text-text">
                        {attendance.summary?.registered ?? 0}
                      </p>
                    </div>
                    <div className="bg-success/10 rounded-md p-4">
                      <p className="text-sm text-success">Present</p>
                      <p className="text-2xl font-bold text-success">
                        {attendance.summary?.present ?? 0}
                      </p>
                    </div>
                    <div className="bg-danger/10 rounded-md p-4">
                      <p className="text-sm text-danger">Absent</p>
                      <p className="text-2xl font-bold text-danger">
                        {attendance.summary?.absent ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="inline-block min-w-full rounded-lg border border-border">
                      <div className="bg-surface-2 grid grid-cols-2 gap-4 p-4 font-medium text-muted text-sm">
                        <div>Participant</div>
                        <div>Present</div>
                      </div>
                      <div className="divide-y divide-border">
                        {attendance.data.map((rec) => (
                          <div key={rec.participant_id} className="grid grid-cols-2 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm">
                            <div className="text-text">Participant {rec.participant_id}</div>
                            <div>
                              {rec.present ? (
                                <Badge variant="success">Present</Badge>
                              ) : (
                                <Badge variant="danger">Absent</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Files */}
        {activeTab === 'files' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Files</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="primary">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload File</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input type="file" placeholder="Select file" />
                      <Button className="w-full">Upload</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {!files || files.length === 0 ? (
                <EmptyState
                  title="No files"
                  description="No files uploaded for this event yet."
                />
              ) : (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full rounded-lg border border-border">
                    <div className="bg-surface-2 grid grid-cols-4 gap-4 p-4 font-medium text-muted text-sm">
                      <div>Name</div>
                      <div>Type</div>
                      <div>Uploaded By</div>
                      <div>Action</div>
                    </div>
                    <div className="divide-y divide-border">
                      {files.map((file) => (
                        <div key={file.id} className="grid grid-cols-4 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm">
                          <div className="font-medium text-text">{file.file_name}</div>
                          <div className="text-muted">{file.file_type}</div>
                          <div className="text-muted">{file.uploaded_by_name}</div>
                          <div>
                            <Button size="sm" variant="ghost">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Certificates */}
        {activeTab === 'certificates' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Certificates</CardTitle>
                <Button size="sm" variant="primary">
                  Create Certificates
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!certificates || certificates.length === 0 ? (
                <EmptyState
                  title="No certificates"
                  description="Certificates will appear once created for present participants."
                />
              ) : (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full rounded-lg border border-border">
                    <div className="bg-surface-2 grid grid-cols-4 gap-4 p-4 font-medium text-muted text-sm">
                      <div>Participant</div>
                      <div>Status</div>
                      <div>Created</div>
                      <div>Action</div>
                    </div>
                    <div className="divide-y divide-border">
                      {certificates.map((cert) => (
                        <div key={cert.id} className="grid grid-cols-4 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm">
                          <div className="text-text">Participant {cert.participant_id}</div>
                          <div>
                            <Badge variant={cert.status === 'issued' ? 'success' : 'default'}>
                              {cert.status}
                            </Badge>
                          </div>
                          <div className="text-muted">
                            {formatDate(cert.created_at)}
                          </div>
                          <div>
                            {cert.status === 'issued' && (
                              <Button size="sm" variant="ghost">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Outcome */}
        {activeTab === 'outcome' && (
          <Card>
            <CardHeader>
              <CardTitle>Event Outcome</CardTitle>
            </CardHeader>
            <CardContent>
              {event.status !== 'completed' ? (
                <div className="bg-info/10 border border-info rounded-md p-4 text-info text-sm">
                  Event must be marked as completed to record outcome.
                </div>
              ) : (
                <form onSubmit={handleSubmit((data) => outcomeMutation.mutate(data))} className="space-y-4">
                  <Input
                    {...register('participants_count')}
                    label="Participants Count"
                    type="number"
                    placeholder="Leave blank to auto-count present attendees"
                    error={errors.participants_count?.message}
                  />
                  <Input
                    {...register('feedback_score')}
                    label="Feedback Score (0-5)"
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    error={errors.feedback_score?.message}
                  />
                  <Input
                    {...register('winners')}
                    label="Winners"
                    placeholder="Award winners, if any"
                    error={errors.winners?.message}
                  />
                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">Description</label>
                    <textarea
                      {...register('description')}
                      placeholder="Event summary and notes"
                      rows={4}
                      className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                    />
                    {errors.description?.message && (
                      <p className="text-xs text-danger mt-1">{errors.description.message}</p>
                    )}
                  </div>
                  <Button type="submit" isLoading={isSubmitting}>
                    Save Outcome
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </motion.div>
  );
}
