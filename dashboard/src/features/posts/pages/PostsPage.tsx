import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Heart, Images, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { postsApi } from '@/features/posts/api/posts-api';
import { PostCommentsModal } from '@/features/posts/components/PostCommentsModal';
import { PostFormModal } from '@/features/posts/components/PostFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import type { PostPayload, PublicPost } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 12;

export function PostsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicPost | null>(null);
  const [commentsPost, setCommentsPost] = useState<PublicPost | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();

  const listQuery = useQuery({
    queryKey: ['posts', 'list', search, page],
    queryFn: () =>
      postsApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
      }),
  });

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  const createMutation = useMutation({
    mutationFn: (payload: PostPayload) => postsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['posts', 'list'] });
      toast.success('Post published');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create post')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PostPayload }) =>
      postsApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['posts', 'list'] });
      toast.success('Post updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update post')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => postsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['posts', 'list'] });
      toast.success('Post deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete post')),
  });

  const toggleCommentsMutation = useMutation({
    mutationFn: ({ id, commentsEnabled }: { id: string; commentsEnabled: boolean }) =>
      postsApi.update(id, { commentsEnabled }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['posts', 'list'] });
      toast.success(variables.commentsEnabled ? 'Comments turned on' : 'Comments turned off');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update comments setting')),
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(post: PublicPost) {
    setEditing(post);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(payload: PostPayload) {
    if (editing) {
      const ok = await confirm({
        title: 'Save post changes?',
        message: 'Update this post for all attendees?',
        confirmLabel: 'Save changes',
        tone: 'primary',
      });
      if (!ok) return;
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    await createMutation.mutateAsync(payload);
  }

  async function handleDelete(post: PublicPost) {
    const ok = await confirm({
      title: 'Delete post?',
      message: 'Delete this post and all of its likes/comments? This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(post.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Feed</span>
          <h1>Posts</h1>
          <p className="muted">
            Instagram-style posts with text and a picture. Attendees can like and comment; you
            can moderate comments.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Create post
        </Button>
      </header>

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          placeholder="Search captions…"
          value={search}
          onChange={applySearch}
          loadSuggestions={async (draft) => {
            const result = await postsApi.list({ search: draft, perPage: 6 });
            return result.items.map((post) => ({
              id: post.id,
              title: post.text?.slice(0, 48) || 'Untitled post',
              subtitle: `${post.likesCount ?? 0} likes · ${post.commentsCount ?? 0} comments`,
              leading: post.image ? <img src={resolveMediaUrl(post.image)} alt="" /> : undefined,
            }));
          }}
        />
      </div>
      {search ? (
        <div className="active-filter-chip">
          Showing results for “{search}”
          <button type="button" aria-label="Clear filter" onClick={() => applySearch('')}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {listQuery.isLoading ? <Spinner /> : null}
      {listQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(listQuery.error)}</p>
      ) : null}

      {listQuery.data ? (
        listQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Images size={28} />
            <h2>No posts yet</h2>
            <p className="muted">Publish a photo + caption for attendees to like and comment on.</p>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Create post
            </Button>
          </div>
        ) : (
          <div className="post-feed">
            {listQuery.data.items.map((post) => (
              <article key={post.id} className="post-card">
                {post.image ? (
                  <div className="post-card-media">
                    <img src={resolveMediaUrl(post.image)} alt="" />
                  </div>
                ) : null}
                <div className="post-card-body">
                  <p className="post-card-author">{post.author?.name ?? 'Admin'}</p>
                  <p className="post-card-text">{post.text}</p>
                  <div className="post-card-meta">
                    <span>
                      <Heart size={14} /> {post.likesCount}
                    </span>
                    <span>
                      <MessageCircle size={14} /> {post.commentsCount}
                    </span>
                    <span className={`badge ${post.commentsEnabled ? 'status-active' : 'status-suspended'}`}>
                      {post.commentsEnabled ? 'Comments on' : 'Comments off'}
                    </span>
                    <span className="muted">
                      {new Date(post.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <div className="actions">
                    <Button variant="secondary" onClick={() => openEdit(post)}>
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={toggleCommentsMutation.isPending}
                      onClick={() =>
                        toggleCommentsMutation.mutate({
                          id: post.id,
                          commentsEnabled: !post.commentsEnabled,
                        })
                      }
                    >
                      {post.commentsEnabled ? 'Turn comments off' : 'Turn comments on'}
                    </Button>
                    <Button variant="secondary" onClick={() => setCommentsPost(post)}>
                      <MessageCircle size={14} />
                      Comments
                    </Button>
                    <Button
                      variant="danger"
                      disabled={deleteMutation.isPending}
                      onClick={() => void handleDelete(post)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {listQuery.data && listQuery.data.items.length > 0 ? (
        <ListPagination
          page={listQuery.data.meta.page}
          totalPages={listQuery.data.meta.totalPages}
          total={listQuery.data.meta.total}
          perPage={listQuery.data.meta.perPage}
          onPageChange={setPage}
          label="posts"
        />
      ) : null}

      <PostFormModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialPost={editing}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <PostCommentsModal
        open={Boolean(commentsPost)}
        post={commentsPost}
        onClose={() => setCommentsPost(null)}
      />
    </div>
  );
}
