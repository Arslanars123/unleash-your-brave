import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { SpeakerPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

export function SpeakerProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const speakerQuery = useQuery({
    queryKey: ['speakers', 'me', user?.speakerId],
    queryFn: () => speakersApi.getMe(),
    enabled: Boolean(user?.speakerId),
  });

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');

  useEffect(() => {
    if (!speakerQuery.data) return;
    setName(speakerQuery.data.name);
    setTitle(speakerQuery.data.title);
    setDescription(speakerQuery.data.description);
    setPhoto(speakerQuery.data.photo);
  }, [speakerQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: SpeakerPayload) => speakersApi.update(user!.speakerId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['speakers', 'me'] });
      toast.success('Profile saved');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to save profile')),
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    await saveMutation.mutateAsync({
      name: name.trim(),
      title: title.trim(),
      description: description.trim(),
      photo: photo.trim(),
    });
  }

  if (speakerQuery.isLoading) return <Spinner />;
  if (speakerQuery.isError) {
    return <p className="form-error">{getApiErrorMessage(speakerQuery.error)}</p>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>My profile</h1>
          <p className="muted">Update how you appear to attendees. Only your profile is editable.</p>
        </div>
      </header>

      <form className="portal-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <Input label="Name" requiredMark value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Keynote Speaker"
        />
        <TextArea
          label="Bio"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell attendees about your work…"
        />
        <Input
          label="Photo URL"
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          placeholder="https://…"
        />
        {photo ? (
          <div className="speaker-photo-preview">
            <img src={photo} alt="" />
          </div>
        ) : null}
        <div className="portal-form-actions">
          <Button type="submit" loading={saveMutation.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </div>
  );
}
