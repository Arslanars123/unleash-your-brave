import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { appBrandingApi } from '@/features/branding/api/app-branding-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
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
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');

  const brandingQuery = useQuery({
    queryKey: ['app-branding'],
    queryFn: () => appBrandingApi.get(),
  });

  useEffect(() => {
    if (!brandingQuery.data) return;
    setHomeCoverImage(brandingQuery.data.homeCoverImage ?? '');
    setSupportEmail(brandingQuery.data.supportEmail ?? '');
    setSupportPhone(brandingQuery.data.supportPhone ?? '');
  }, [brandingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = (await imageRef.current?.commit()) ?? homeCoverImage;
      return appBrandingApi.update({
        homeCoverImage: url.trim(),
        supportEmail: supportEmail.trim(),
        supportPhone: supportPhone.trim(),
      });
    },
    onSuccess: async (data) => {
      setHomeCoverImage(data.homeCoverImage);
      setSupportEmail(data.supportEmail);
      setSupportPhone(data.supportPhone);
      await queryClient.invalidateQueries({ queryKey: ['app-branding'] });
      toast.success('App settings saved.');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to save app settings')),
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>App home</h1>
          <p className="muted">
            Home cover and Help &amp; Support contact details shown in the mobile app.
          </p>
        </div>
        <Button
          loading={saveMutation.isPending}
          onClick={() => void saveMutation.mutateAsync()}
          disabled={brandingQuery.isLoading}
        >
          Save settings
        </Button>
      </header>

      {brandingQuery.isLoading ? <Spinner /> : null}
      {brandingQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(brandingQuery.error)}</p>
      ) : null}

      {!brandingQuery.isLoading && !brandingQuery.isError ? (
        <>
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

          <section className="panel" style={{ maxWidth: 640, marginTop: 24 }}>
            <div className="panel-header">
              <h2>Help &amp; Support</h2>
            </div>
            <Input
              label="Support email"
              name="supportEmail"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="dedee@fittoprofit.com"
            />
            <Input
              label="Support phone"
              name="supportPhone"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
