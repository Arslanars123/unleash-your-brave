import { useEffect, useId, useRef, useState } from 'react';

export interface VenuePlaceSelection {
  venueName: string;
  venueAddress: string;
  venueCity: string;
  latitude: number | null;
  longitude: number | null;
}

interface VenuePlacesFieldProps {
  venueName: string;
  venueAddress: string;
  venueCity: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (next: VenuePlaceSelection) => void;
  errors?: Partial<Record<'venueName' | 'venueAddress' | 'venueCity', string>>;
}

declare global {
  interface Window {
    google?: typeof google;
    __uybMapsReady?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__uybMapsReady) return window.__uybMapsReady;

  window.__uybMapsReady = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-uyb-maps]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.uybMaps = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return window.__uybMapsReady;
}

function cityFromComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): string {
  if (!components?.length) return '';
  const locality =
    components.find((c) => c.types.includes('locality'))?.long_name ??
    components.find((c) => c.types.includes('postal_town'))?.long_name ??
    components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ??
    '';
  const region =
    components.find((c) => c.types.includes('administrative_area_level_1'))?.short_name ?? '';
  return [locality, region].filter(Boolean).join(', ');
}

export function VenuePlacesField({
  venueName,
  venueAddress,
  venueCity,
  latitude,
  longitude,
  onChange,
  errors,
}: VenuePlacesFieldProps) {
  const addressId = useId();
  const addressRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const venueNameRef = useRef(venueName);
  const venueCityRef = useRef(venueCity);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [status, setStatus] = useState('Loading Google Places…');

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  onChangeRef.current = onChange;
  venueNameRef.current = venueName;
  venueCityRef.current = venueCity;

  useEffect(() => {
    if (!apiKey?.trim()) {
      setMapsError('Set VITE_GOOGLE_MAPS_API_KEY in dashboard/.env, then restart npm run dev.');
      setStatus('');
      return;
    }

    let cancelled = false;
    void loadGoogleMaps(apiKey.trim())
      .then(() => {
        if (cancelled) return;
        const waitForPlaces = () =>
          new Promise<void>((resolve, reject) => {
            const started = Date.now();
            const tick = () => {
              if (window.google?.maps?.places) {
                resolve();
                return;
              }
              if (Date.now() - started > 8000) {
                reject(new Error('Places library timed out'));
                return;
              }
              window.setTimeout(tick, 50);
            };
            tick();
          });

        return waitForPlaces().then(() => {
          if (!cancelled) {
            setMapsReady(true);
            setStatus('Type here, then click a Google suggestion to set the map pin.');
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMapsError(
            'Unable to load Google Places. Enable Maps JavaScript API + Places API for this key, then restart npm run dev.',
          );
          setStatus('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const input = addressRef.current;
    if (!mapsReady || !input || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      fields: ['name', 'formatted_address', 'geometry', 'address_components'],
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) {
        setStatus('Pick a suggestion from the dropdown to set the pin.');
        return;
      }

      const nextAddress =
        place.formatted_address?.trim() || input.value.trim() || '';
      onChangeRef.current({
        venueName: place.name?.trim() || venueNameRef.current,
        venueAddress: nextAddress,
        venueCity: cityFromComponents(place.address_components) || venueCityRef.current,
        latitude: location.lat(),
        longitude: location.lng(),
      });
      setStatus('Venue pin saved from Google Places.');
    });

    return () => {
      listener.remove();
      window.google?.maps?.event.clearInstanceListeners(autocomplete);
      document.querySelectorAll('.pac-container').forEach((node) => node.remove());
    };
  }, [mapsReady]);

  function clearCoords() {
    onChange({
      venueName,
      venueAddress,
      venueCity,
      latitude: null,
      longitude: null,
    });
  }

  const hasCoords = latitude != null && longitude != null;

  return (
    <div className="venue-places">
      <label className="field" htmlFor={addressId}>
        <span className="field-label">Venue address</span>
        <input
          id={addressId}
          ref={addressRef}
          className={`field-input${errors?.venueAddress ? ' field-input-error' : ''}`}
          name="venueAddress"
          value={venueAddress}
          onChange={(e) =>
            onChange({
              venueName,
              venueAddress: e.target.value,
              venueCity,
              // Clear pin when the user edits address manually after a Places pick.
              latitude: null,
              longitude: null,
            })
          }
          placeholder="Start typing an address or venue…"
          autoComplete="off"
        />
        {errors?.venueAddress ? <span className="field-error">{errors.venueAddress}</span> : null}
        {mapsError ? <span className="field-error">{mapsError}</span> : null}
        {!mapsError && status ? <span className="hint">{status}</span> : null}
      </label>

      <label className="field">
        <span className="field-label">Venue name</span>
        <input
          className={`field-input${errors?.venueName ? ' field-input-error' : ''}`}
          name="venueName"
          value={venueName}
          onChange={(e) =>
            onChange({
              venueName: e.target.value,
              venueAddress,
              venueCity,
              latitude,
              longitude,
            })
          }
          placeholder="The Vinoy"
        />
        {errors?.venueName ? <span className="field-error">{errors.venueName}</span> : null}
      </label>

      <label className="field">
        <span className="field-label">Venue city</span>
        <input
          className={`field-input${errors?.venueCity ? ' field-input-error' : ''}`}
          name="venueCity"
          value={venueCity}
          onChange={(e) =>
            onChange({
              venueName,
              venueAddress,
              venueCity: e.target.value,
              latitude,
              longitude,
            })
          }
          placeholder="St. Petersburg, FL"
        />
        {errors?.venueCity ? <span className="field-error">{errors.venueCity}</span> : null}
      </label>

      <div className="venue-coords">
        {hasCoords ? (
          <p className="hint venue-coords-text">
            Map pin: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
            <button type="button" className="link-button" onClick={clearCoords}>
              Clear pin
            </button>
          </p>
        ) : (
          <p className="hint">No map pin yet — pick a Google Places suggestion above.</p>
        )}
      </div>
    </div>
  );
}
