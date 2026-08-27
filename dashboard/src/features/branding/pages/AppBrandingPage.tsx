import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { appBrandingApi } from '@/features/branding/api/app-branding-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import {
  MediaImageField,
  type MediaImageFieldHandle,
} from '@/shared/ui/MediaImageField';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function AppBrandingPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const imageRef = useRef<MediaImageFieldHandle>(null);
  const [homeCoverImage, setHomeCoverImage] = useState('');

  const brandingQuery = useQuery({
    queryKey: ['app-branding'],
    queryFn: () => appBrandingApi.get(),
  });

  useEffect(() => {
    if (!brandingQuery.data) return;
    setHomeCoverImage(brandingQuery.data.homeCoverImage ?? '');
  }, [brandingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = (await imageRef.current?.commit()) ?? homeCoverImage;
      return appBrandingApi.update({ homeCoverImage: url.trim() });
    },
    onSuccess: async (data) => {
      setHomeCoverImage(data.homeCoverImage);
      await queryClient.invalidateQueries({ queryKey: ['app-branding'] });
      toast.success('Home cover saved. It will show on the app home screen.');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to save home cover')),
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>App home</h1>
          <p className="muted">
            This cover stays on the mobile app home screen. It is not tied to any event.
          </p>
        </div>
        <Button
          loading={saveMutation.isPending}
          onClick={() => void saveMutation.mutateAsync()}
          disabled={brandingQuery.isLoading}
        >
          Save cover
        </Button>
      </header>

      {brandingQuery.isLoading ? <Spinner /> : null}
      {brandingQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(brandingQuery.error)}</p>
      ) : null}

      {!brandingQuery.isLoading && !brandingQuery.isError ? (
        <section className="panel" style={{ maxWidth: 640 }}>
          <div className="panel-header">
            <h2>Home cover image</h2>
          </div>
          <MediaImageField
            ref={imageRef}
            label="Cover image"
            value={homeCoverImage}
            onChange={setHomeCoverImage}
            hint="Shown behind the countdown on the app home screen. Upload or paste a URL, then save."
          />
        </section>
      ) : null}
    </div>
  );
}
