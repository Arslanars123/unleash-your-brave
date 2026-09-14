import { useQuery } from '@tanstack/react-query';
import { Copy, MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import { feedbackApi } from '@/features/feedback/api/feedback-api';
import { formatUsDateTime } from '@/shared/lib/datetime';
import { Button } from '@/shared/ui/Button';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

function publicFeedbackUrl(): string {
  // Static HTML — not the React SPA, so old admin caches cannot redirect to /login
  return `${window.location.origin}/event-feedback.html`;
}

export function FeedbackInboxPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const toast = useToast();

  const listQuery = useQuery({
    queryKey: ['feedback', 'list', search, page],
    queryFn: () =>
      feedbackApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
      }),
  });

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  async function copyLink() {
    const url = publicFeedbackUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Feedback link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  }

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Feedback</h1>
          <p className="muted">Submissions from the public feedback form. Not tied to an event.</p>
        </div>
        <div className="page-header-actions">
          <Button type="button" variant="secondary" onClick={() => void copyLink()}>
            <Copy size={16} />
            Copy form link
          </Button>
        </div>
      </header>

      <div className="toolbar">
        <SearchSuggest
          value={search}
          placeholder="Search name, email, or feedback…"
          onChange={applySearch}
          loadSuggestions={async (draft) => {
            const result = await feedbackApi.list({ search: draft, perPage: 6 });
            return result.items.map((item) => ({
              id: item.id,
              title: item.name,
              subtitle: item.email,
            }));
          }}
        />
      </div>

      {listQuery.isLoading ? (
        <Spinner />
      ) : listQuery.isError ? (
        <p className="field-error">Unable to load feedback.</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <MessageSquareText size={40} />
          <p>No feedback yet.</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Feedback</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td className="feedback-cell">{item.feedback}</td>
                    <td>{formatUsDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination
            page={meta?.page ?? page}
            totalPages={meta?.totalPages ?? 1}
            total={meta?.total ?? items.length}
            perPage={meta?.perPage ?? PER_PAGE}
            onPageChange={setPage}
            label="submissions"
          />
        </>
      )}
    </div>
  );
}
