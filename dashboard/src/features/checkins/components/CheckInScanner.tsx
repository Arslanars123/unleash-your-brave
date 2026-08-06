import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

interface CheckInScannerProps {
  onScan: (token: string) => void;
  disabled?: boolean;
}

/**
 * Uses the browser BarcodeDetector API when available (Chromium + secure context).
 * Falls back to a clear message so staff can paste the token or use list check-in.
 */
export function CheckInScanner({ onScan, disabled }: CheckInScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastValue = useRef('');

  useEffect(() => {
    if (!active) return;

    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const Detector = window.BarcodeDetector;

    async function start() {
      if (!Detector) {
        setError(
          'Camera QR scanning needs Chrome/Edge on HTTPS. Paste the QR token below, or check in from the list.',
        );
        setActive(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value && value !== lastValue.current) {
              lastValue.current = value;
              onScan(value);
            }
          } catch {
            // ignore frame errors
          }
          raf = requestAnimationFrame(() => {
            void tick();
          });
        };
        void tick();
      } catch {
        setError('Unable to open the camera. Allow camera access, or paste the QR token instead.');
        setActive(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active, onScan]);

  return (
    <div className="checkin-scanner">
      <div className="page-header-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            setError(null);
            lastValue.current = '';
            setActive((value) => !value);
          }}
        >
          {active ? <CameraOff size={16} /> : <Camera size={16} />}
          {active ? 'Stop camera' : 'Scan with camera'}
        </Button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {active ? (
        <video
          ref={videoRef}
          className="checkin-video"
          muted
          playsInline
          autoPlay
        />
      ) : null}
    </div>
  );
}
