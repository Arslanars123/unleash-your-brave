import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send, Trash2, Users } from 'lucide-react';
import { chatApi, type ChatMessageView } from '@/features/chat/api/chat-api';
import { useChatRealtime } from '@/features/chat/hooks/useChatRealtime';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { getApiErrorMessage } from '@/shared/api/client';
import { createClientId } from '@/shared/lib/client-id';
import { resolveMediaUrl } from '@/shared/lib/media';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function roleLabel(role: string): string {
  if (role === 'admin') return 'Admin';
  if (role === 'speaker') return 'Speaker';
  if (role === 'sponsor') return 'Sponsor';
  return 'Attendee';
}

export function ChatPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatSocket = useChatRealtime(true);

  const groupQuery = useQuery({
    queryKey: ['chat', 'group'],
    queryFn: () => chatApi.getGroup(),
  });

  const messagesQuery = useQuery({
    queryKey: ['chat', 'messages'],
    queryFn: () => chatApi.listMessages({ limit: 80 }),
  });

  const membersQuery = useQuery({
    queryKey: ['chat', 'members'],
    queryFn: () => chatApi.listMembers({ perPage: 50 }),
  });

  const messages = useMemo(() => {
    const items = messagesQuery.data ?? [];
    return [...items].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messagesQuery.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (chatSocket.deleteMessage(id)) return;
      await chatApi.removeMessage(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'messages'] });
      const previous = queryClient.getQueryData<ChatMessageView[]>(['chat', 'messages']);
      queryClient.setQueryData<ChatMessageView[]>(['chat', 'messages'], (prev) =>
        (prev ?? []).filter((m) => m.id !== id),
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['chat', 'messages'], context.previous);
      }
      toast.error(getApiErrorMessage(error, 'Unable to delete message'));
    },
    onSuccess: () => toast.success('Message removed'),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !user) return;

    const clientId = createClientId();
    const optimistic: ChatMessageView = {
      id: `local-${clientId}`,
      groupId: groupQuery.data?.id ?? 'global',
      senderId: user.id,
      senderName: user.name || 'You',
      senderRole: 'admin',
      senderPhotoUrl: user.photoUrl ?? '',
      clientId,
      type: 'text',
      body: text,
      gifUrl: '',
      createdAt: new Date().toISOString(),
      reactions: [],
      deliveryStatus: 'sent',
    };

    setDraft('');
    queryClient.setQueryData<ChatMessageView[]>(['chat', 'messages'], (prev) => [
      ...(prev ?? []),
      optimistic,
    ]);

    const sentOverWs = chatSocket.sendText(text, clientId);
    if (sentOverWs) return;

    setSending(true);
    void chatApi
      .sendText(text, clientId)
      .then((message) => {
        queryClient.setQueryData<ChatMessageView[]>(['chat', 'messages'], (prev) => {
          const list = prev ?? [];
          const withoutLocal = list.filter((m) => m.clientId !== clientId && m.id !== optimistic.id);
          if (withoutLocal.some((m) => m.id === message.id)) return withoutLocal;
          return [...withoutLocal, message];
        });
      })
      .catch((error) => {
        queryClient.setQueryData<ChatMessageView[]>(['chat', 'messages'], (prev) =>
          (prev ?? []).filter((m) => m.clientId !== clientId),
        );
        setDraft(text);
        toast.error(getApiErrorMessage(error, 'Unable to send message'));
      })
      .finally(() => setSending(false));
  }

  async function confirmDelete(message: ChatMessageView) {
    const preview =
      message.type === 'gif' ? 'GIF' : message.body.slice(0, 60) || 'this message';
    const ok = await confirm({
      title: 'Delete message?',
      message: `Delete “${preview}”? Attendees will no longer see it.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    deleteMutation.mutate(message.id);
  }

  const loading = groupQuery.isLoading || messagesQuery.isLoading;

  return (
    <div className="page chat-admin-page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Community</span>
          <h1>Group chat</h1>
          <p className="muted">
            See every attendee message, reply as admin, and remove anything that shouldn’t stay.
          </p>
        </div>
      </header>

      {groupQuery.data ? (
        <div className="chat-admin-stats">
          <div className="panel">
            <strong>{groupQuery.data.name}</strong>
            <span className="muted">Live group</span>
          </div>
          <div className="panel">
            <strong>{groupQuery.data.memberCount}</strong>
            <span className="muted">Members</span>
          </div>
          <div className="panel">
            <strong>{messages.length}</strong>
            <span className="muted">Loaded messages</span>
          </div>
        </div>
      ) : null}

      <div className="chat-admin-layout">
        <section className="panel chat-admin-thread">
          {loading ? <Spinner /> : null}
          {messagesQuery.isError ? (
            <p className="form-error">{getApiErrorMessage(messagesQuery.error)}</p>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="empty-state">
              <MessageCircle size={28} />
              <h2>No messages yet</h2>
              <p className="muted">Say hello — attendees will see your name as Admin.</p>
            </div>
          ) : (
            <div className="chat-admin-messages">
              {messages.map((message) => {
                const mine = message.senderId === user?.id;
                const photo = resolveMediaUrl(message.senderPhotoUrl);
                return (
                  <article
                    key={message.id}
                    className={`chat-admin-row ${mine ? 'is-mine' : 'is-theirs'}`}
                  >
                    {!mine ? (
                      photo ? (
                        <img src={photo} alt="" className="chat-admin-avatar" />
                      ) : (
                        <span className="chat-admin-avatar placeholder">
                          {(message.senderName || '?').charAt(0).toUpperCase()}
                        </span>
                      )
                    ) : null}

                    <div className={`chat-admin-bubble ${mine ? 'is-mine' : ''}`}>
                      <div className="chat-admin-name-row">
                        <strong>{mine ? 'You' : message.senderName}</strong>
                        <span className={`chat-role-pill role-${message.senderRole}`}>
                          {roleLabel(message.senderRole)}
                        </span>
                      </div>
                      {message.type === 'gif' && message.gifUrl ? (
                        <img
                          src={resolveMediaUrl(message.gifUrl)}
                          alt="GIF"
                          className="chat-admin-gif"
                        />
                      ) : (
                        <p>{message.body}</p>
                      )}
                      <div className="chat-admin-bubble-footer">
                        <span className="chat-admin-time">{formatTime(message.createdAt)}</span>
                        <button
                          type="button"
                          className="chat-admin-delete"
                          disabled={deleteMutation.isPending}
                          onClick={() => confirmDelete(message)}
                          aria-label="Delete message"
                          title="Delete message"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {mine ? (
                      photo ? (
                        <img src={photo} alt="" className="chat-admin-avatar" />
                      ) : (
                        <span className="chat-admin-avatar placeholder is-mine">
                          {(message.senderName || 'A').charAt(0).toUpperCase()}
                        </span>
                      )
                    ) : null}
                  </article>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}

          <form className="chat-admin-composer" onSubmit={onSubmit}>
            <input
              className="field-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the group as admin…"
              maxLength={2000}
              disabled={sending}
            />
            <Button type="submit" loading={sending} disabled={!draft.trim()}>
              <Send size={16} />
              Send
            </Button>
          </form>
        </section>

        <aside className="panel chat-admin-members">
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
              <Users size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
              Members
            </h2>
          </div>
          {membersQuery.isLoading ? <Spinner /> : null}
          <ul className="chat-admin-member-list">
            {(membersQuery.data?.items ?? []).map((member) => (
              <li key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <p className="muted">
                    {roleLabel(member.role)}
                    {member.title ? ` · ${member.title}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
