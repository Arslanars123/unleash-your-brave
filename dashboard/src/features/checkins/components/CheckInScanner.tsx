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

function extractToken(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/uyb1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return match?.[0] ?? trimmed;
}

/**
 * Live camera QR scanner. Always samples frames onto a canvas and decodes with
 * jsQR (BarcodeDetector is used as a first pass when present).
 */
export function CheckInScanner({ onScan, disabled }: CheckInScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onScanRef = useRef(onScan);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const lastValue = useRef('');

  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return;

    let stream: MediaStream | null = null;
    let timer = 0;
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
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        setHint('Point the camera at the attendee QR…');

        const Detector = window.BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;

        const readFrame = async (): Promise<string | null> => {
          const el = videoRef.current;
          const canvas = canvasRef.current;
          if (!el || !canvas || el.readyState < 2) return null;

          const sourceW = el.videoWidth;
          const sourceH = el.videoHeight;
          if (!sourceW || !sourceH) return null;

          const maxSide = 640;
          const scale = Math.min(1, maxSide / Math.max(sourceW, sourceH));
          const width = Math.max(1, Math.round(sourceW * scale));
          const height = Math.max(1, Math.round(sourceH * scale));
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return null;
          ctx.drawImage(el, 0, 0, width, height);

          if (detector) {
            try {
              const codes = await detector.detect(canvas);
              const detected = codes[0]?.rawValue?.trim();
              if (detected) return extractToken(detected);
            } catch {
              // jsQR below
            }
          }

          const image = ctx.getImageData(0, 0, width, height);
          const result = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'attemptBoth',
          });
          return result?.data ? extractToken(result.data) : null;
        };

        const tick = async () => {
          if (cancelled) return;
          try {
            const value = await readFrame();
            if (value && value !== lastValue.current) {
              lastValue.current = value;
              setHint('QR found — checking in…');
              onScanRef.current(value);
            }
          } catch {
            // ignore frame errors
          }
          if (!cancelled) {
            timer = window.setTimeout(() => {
              void tick();
            }, 120);
          }
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
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active]);

  return (
    <div className="checkin-scanner">
      <div className="page-header-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            setError(null);
            setHint(null);
            lastValue.current = '';
            setActive((value) => !value);
          }}
        >
          {active ? <CameraOff size={16} /> : <Camera size={16} />}
          {active ? 'Stop camera' : 'Scan with camera'}
        </Button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {hint && !error ? <p className="hint">{hint}</p> : null}
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
