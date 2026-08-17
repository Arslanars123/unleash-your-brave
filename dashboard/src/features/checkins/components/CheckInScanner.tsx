import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
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
 * Live camera QR scanner. Uses BarcodeDetector when present, otherwise jsQR on
 * each video frame so Safari/Firefox work too. Camera APIs require HTTPS.
 */
export function CheckInScanner({ onScan, disabled }: CheckInScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastValue = useRef('');

  useEffect(() => {
    if (!active) return;

    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(
          'Camera scanning needs a secure (HTTPS) dashboard URL. Open the HTTPS admin link, then try again.',
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

        const Detector = window.BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;

        const readFrame = async (): Promise<string | null> => {
          const el = videoRef.current;
          if (!el || el.readyState < 2) return null;

          if (detector) {
            try {
              const codes = await detector.detect(el);
              return codes[0]?.rawValue?.trim() || null;
            } catch {
              // Fall through to jsQR for this frame.
            }
          }

          const canvas = canvasRef.current;
          if (!canvas) return null;
          const width = el.videoWidth;
          const height = el.videoHeight;
          if (!width || !height) return null;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return null;
          ctx.drawImage(el, 0, 0, width, height);
          const image = ctx.getImageData(0, 0, width, height);
          const result = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'attemptBoth',
          });
          return result?.data?.trim() || null;
        };

        const tick = async () => {
          if (cancelled) return;
          try {
            const value = await readFrame();
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
        setError('Unable to open the camera. Allow camera access in the browser, then try again.');
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
        <>
          <video
            ref={videoRef}
            className="checkin-video"
            muted
            playsInline
            autoPlay
          />
          <canvas ref={canvasRef} className="checkin-qr-canvas" aria-hidden />
        </>
      ) : null}
    </div>
  );
}
