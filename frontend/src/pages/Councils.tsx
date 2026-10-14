import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Trash2 } from 'lucide-react';
import { variants } from '@/lib/motion';
import { apiFetch } from '@/lib/api';
import type { Council } from '@/lib/types';
import { toast } from 'sonner';

export default function CouncilsPage() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Council | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['councils', 'all'],
    queryFn: () => apiFetch<Council[]>('/api/councils?include_inactive=true'),
  });

  const deleteMutation = useMutation({
    mutationFn: (councilId: number) =>
      apiFetch(`/api/councils/${councilId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Council deleted');
      queryClient.invalidateQueries({ queryKey: ['councils'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const councils = data ?? [];

  // A council can only be deleted once it has no events and nobody in it.
  const isEmpty = (council: Council) =>
    Number(council.event_count ?? 0) === 0 && Number(council.member_count ?? 0) === 0;

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      className="p-4 md:p-6 lg:p-8 max-w-6xl"
    >
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-text">Councils</h1>
        <p className="text-sm text-muted mt-1">
          A council can be deleted only once it has no events and no members. Remove its members
          from the Users page first.
        </p>
      </div>

      {error ? (
        <ErrorState
          title="Failed to load councils"
          message="There was an error loading councils."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : councils.length === 0 ? (
        <EmptyState
          title="No councils yet"
          description="Councils are created when you approve a Council Lead request."
        />
      ) : (
        <motion.div variants={variants.staggerContainer} initial="initial" animate="animate">
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <div className="inline-block min-w-full rounded-lg border border-border">
                <div className="bg-surface-2 grid grid-cols-6 gap-4 p-4 font-medium text-muted text-sm">
                  <div>Council</div>
                  <div>Lead</div>
                  <div>Events</div>
                  <div>Members</div>
                  <div>Status</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="divide-y divide-border">
                  {councils.map((council) => {
                    const empty = isEmpty(council);
                    return (
                      <motion.div
                        key={council.council_id}
                        variants={variants.staggerItem}
                        className="grid grid-cols-6 gap-4 p-4 hover:bg-surface-2 transition-colors text-sm items-center"
                      >
                        <div className="font-medium text-text">
                          {council.name}
                          <div className="text-xs text-muted font-normal">{council.slug}</div>
                        </div>
                        <div className="text-muted">
                          {council.lead_name || <span className="italic">No lead</span>}
                        </div>
                        <div className="text-text">{Number(council.event_count ?? 0)}</div>
                        <div className="text-text">{Number(council.member_count ?? 0)}</div>
                        <div>
                          <Badge variant={council.is_active ? 'success' : 'warning'}>
                            {council.is_active ? 'active' : 'inactive'}
                          </Badge>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="danger"
                            title={
                              empty
                                ? 'Delete this council'
                                : 'Empty the council before deleting it'
                            }
                            onClick={() => setDeleteTarget(council)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete council</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              {isEmpty(deleteTarget) ? (
                <p className="text-sm text-muted">
                  Delete <span className="text-text font-medium">{deleteTarget.name}</span>? This
                  cannot be undone.
                </p>
              ) : (
                <div className="text-sm text-muted space-y-2">
                  <p>
                    <span className="text-text font-medium">{deleteTarget.name}</span> still has{' '}
                    {Number(deleteTarget.event_count ?? 0)} event(s) and{' '}
                    {Number(deleteTarget.member_count ?? 0)} member(s), so it cannot be deleted.
                  </p>
                  <p>To empty it:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Remove its members on the Users page.</li>
                    <li>Delete its events on the Events page (a council lead can do this too).</li>
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  disabled={!isEmpty(deleteTarget)}
                  isLoading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteTarget.council_id)}
                >
                  Delete
                </Button>
                <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
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
