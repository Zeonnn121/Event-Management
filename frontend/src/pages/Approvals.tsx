import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { RegistrationRequest } from '@/lib/types';
import { toast } from 'sonner';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [approveTarget, setApproveTarget] = useState<RegistrationRequest | null>(null);
  const [councilName, setCouncilName] = useState('');
  const [rejectTarget, setRejectTarget] = useState<RegistrationRequest | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['registration-requests', status],
    queryFn: () =>
      apiFetch<RegistrationRequest[]>(`/api/registration-requests?status=${status}`),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, councilName }: { id: number; councilName?: string }) =>
      apiFetch(`/api/registration-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ council_name: councilName || undefined }),
      }),
    onSuccess: () => {
      toast.success('Council Lead approved and council created');
      queryClient.invalidateQueries({ queryKey: ['registration-requests'] });
      queryClient.invalidateQueries({ queryKey: ['councils'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setApproveTarget(null);
      setCouncilName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      apiFetch(`/api/registration-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    onSuccess: () => {
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['registration-requests'] });
      setRejectTarget(null);
      setReason('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const requests = data ?? [];

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      className="p-4 md:p-6 lg:p-8 max-w-6xl"
    >
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-text">Council Lead Approvals</h1>
        <p className="text-sm text-muted mt-1">
          People who registered as a Council Lead. Approving creates their council and makes them its lead.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? 'primary' : 'secondary'}
            onClick={() => setStatus(value)}
          >
            {value[0].toUpperCase() + value.slice(1)}
          </Button>
        ))}
      </div>

      {error ? (
        <ErrorState
          title="Failed to load requests"
          message="There was an error loading registration requests."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <EmptyState
          title={status === 'all' ? 'No requests' : `No ${status} requests`}
          description="New Council Lead registrations will appear here."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <motion.div key={request.request_id} variants={variants.staggerItem}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-text">{request.name}</h3>
                        <Badge
                          variant={
                            request.status === 'pending'
                              ? 'warning'
                              : request.status === 'approved'
                                ? 'success'
                                : 'danger'
                          }
                        >
                          {request.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted">{request.email}</p>
                      <p className="text-sm text-text">
                        Proposed council: <span className="font-medium">{request.council_name}</span>
                      </p>
                      {request.department && (
                        <p className="text-sm text-muted">Department: {request.department}</p>
                      )}
                      {request.message && (
                        <p className="text-sm text-muted max-w-2xl whitespace-pre-wrap">
                          “{request.message}”
                        </p>
                      )}
                      <p className="text-xs text-muted">
                        Requested {new Date(request.requested_at).toLocaleString()}
                        {request.reviewed_by_name && request.status !== 'pending'
                          ? ` · ${request.status} by ${request.reviewed_by_name}`
                          : ''}
                        {request.review_note ? ` · ${request.review_note}` : ''}
                      </p>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setApproveTarget(request);
                            setCouncilName(request.council_name);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setRejectTarget(request);
                            setReason('');
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Approve dialog — council name is editable before it is created. */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Council Lead</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Approving <span className="text-text font-medium">{approveTarget.name}</span> creates the
                council below and makes them its lead.
              </p>
              <Input
                label="Council name"
                value={councilName}
                onChange={(e) => setCouncilName(e.target.value)}
                placeholder="Council name"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  isLoading={approveMutation.isPending}
                  onClick={() =>
                    approveMutation.mutate({
                      id: approveTarget.request_id,
                      councilName: councilName.trim() || undefined,
                    })
                  }
                >
                  Approve
                </Button>
                <Button variant="secondary" onClick={() => setApproveTarget(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <Input
                label="Reason (Optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Sent to the requester as a note"
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  isLoading={rejectMutation.isPending}
                  onClick={() =>
                    rejectMutation.mutate({
                      id: rejectTarget.request_id,
                      reason: reason.trim() || undefined,
                    })
                  }
                >
                  Reject
                </Button>
                <Button variant="secondary" onClick={() => setRejectTarget(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
