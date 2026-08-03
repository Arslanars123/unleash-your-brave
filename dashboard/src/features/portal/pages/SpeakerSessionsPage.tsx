import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Eye, FolderOpen } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { ManageSessionContentModal } from '@/features/portal/components/ManageSessionContentModal';
import { ViewSessionModal } from '@/features/portal/components/ViewSessionModal';
import { sessionsApi } from '@/features/sessions/api/sessions-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatSessionTimeRange } from '@/shared/lib/datetime';
import type { PublicSession, SessionMaterialPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function SpeakerSessionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<PublicSession | null>(null);
  const [managing, setManaging] = useState<PublicSession | null>(null);

  const speakerId = user?.speakerId ?? undefined;

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'mine', speakerId],
    queryFn: () => sessionsApi.list({ speakerId, perPage: 100 }),
    enabled: Boolean(speakerId),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      description,
      materials,
    }: {
      id: string;
      description: string;
      materials: SessionMaterialPayload[];
    }) => sessionsApi.update(id, { description, materials }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'mine'] });
      toast.success('Session content saved');
      setManaging(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to save content')),
  });

  if (sessionsQuery.isLoading) return <Spinner />;
  if (sessionsQuery.isError) {
    return <p className="form-error">{getApiErrorMessage(sessionsQuery.error)}</p>;
  }

  const sessions = sessionsQuery.data?.items ?? [];

  // Keep viewing session fresh after edits
  const viewingSession =
    (viewing && sessions.find((session) => session.id === viewing.id)) || viewing;
  const managingSession =
    (managing && sessions.find((session) => session.id === managing.id)) || managing;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>My sessions</h1>
          <p className="muted">
            View session details and reviews, edit your description, and manage uploaded content.
          </p>
        </div>
      </header>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <h2>No sessions assigned yet</h2>
          <p className="muted">When an admin assigns you to a session, it will show up here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Day</th>
                <th>Time</th>
                <th>Location</th>
                <th>Content</th>
                <th>Reviews</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const ratingsCount = session.feedbackSummary?.ratingsCount ?? 0;
                const average = session.feedbackSummary?.averageRating ?? 0;
                const timeRange = formatSessionTimeRange(session.startTime, session.endTime);

                return (
                  <tr key={session.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{session.name}</strong>
                        {session.description ? (
                          <span className="muted cell-clamp">{session.description}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="badge role-member">Day {session.eventDayNumber}</span>
                    </td>
                    <td>
                      {timeRange ? <span>{timeRange}</span> : <span className="muted">—</span>}
                    </td>
                    <td>
                      {session.location?.trim() ? (
                        <span>{session.location}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge role-admin">
                        {session.materials.length}{' '}
                        {session.materials.length === 1 ? 'item' : 'items'}
                      </span>
                    </td>
                    <td>
                      {ratingsCount > 0 ? (
                        <span className="muted">
                          {average.toFixed(1)} · {ratingsCount}
                        </span>
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </td>
                    <td className="actions">
                      <Button variant="secondary" onClick={() => setViewing(session)}>
                        <Eye size={14} />
                        View session
                      </Button>
                      <Button onClick={() => setManaging(session)}>
                        <FolderOpen size={14} />
                        Manage content
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ViewSessionModal
        open={Boolean(viewingSession)}
        session={viewingSession}
        onClose={() => setViewing(null)}
        onManageContent={() => {
          if (!viewingSession) return;
          setManaging(viewingSession);
          setViewing(null);
        }}
      />

      <ManageSessionContentModal
        open={Boolean(managingSession)}
        session={managingSession}
        loading={updateMutation.isPending}
        onClose={() => setManaging(null)}
        onSave={async ({ description, materials }) => {
          if (!managingSession) return;
          await updateMutation.mutateAsync({
            id: managingSession.id,
            description,
            materials,
          });
        }}
      />
    </div>
  );
}
