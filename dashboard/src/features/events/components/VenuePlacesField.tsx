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
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            inputField: HTMLInputElement,
            opts?: google.maps.places.AutocompleteOptions,
          ) => google.maps.places.Autocomplete;
        };
      };
    };
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
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [search, setSearch] = useState('');
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey?.trim()) {
      setMapsError('Set VITE_GOOGLE_MAPS_API_KEY to enable Places search.');
      return;
    }

    let cancelled = false;
    void loadGoogleMaps(apiKey.trim())
      .then(() => {
        if (!cancelled) setMapsReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapsError('Unable to load Google Places. Check the API key.');
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!mapsReady || !inputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['name', 'formatted_address', 'geometry', 'address_components'],
      types: ['establishment'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) return;

      onChange({
        venueName: place.name?.trim() || '',
        venueAddress: place.formatted_address?.trim() || '',
        venueCity: cityFromComponents(place.address_components),
        latitude: location.lat(),
        longitude: location.lng(),
      });
      setSearch(place.name?.trim() || place.formatted_address?.trim() || '');
    });

    autocompleteRef.current = autocomplete;
  }, [mapsReady, onChange]);

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
      <label className="field" htmlFor={searchId}>
        <span className="field-label">Search venue (Google Places)</span>
        <input
          id={searchId}
          ref={inputRef}
          className="field-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Start typing a venue name…"
          autoComplete="off"
          disabled={!mapsReady}
        />
        {mapsError ? <span className="field-error">{mapsError}</span> : null}
        {!mapsError && !apiKey?.trim() ? (
          <span className="hint">Places search needs VITE_GOOGLE_MAPS_API_KEY.</span>
        ) : null}
        {mapsReady ? (
          <span className="hint">Pick a result to fill name, address, city, and map pin.</span>
        ) : null}
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
        <span className="field-label">Venue address</span>
        <input
          className={`field-input${errors?.venueAddress ? ' field-input-error' : ''}`}
          name="venueAddress"
          value={venueAddress}
          onChange={(e) =>
            onChange({
              venueName,
              venueAddress: e.target.value,
              venueCity,
              latitude,
              longitude,
            })
          }
          placeholder="501 5th Ave NE"
        />
        {errors?.venueAddress ? <span className="field-error">{errors.venueAddress}</span> : null}
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
          <p className="hint">No map pin yet — search and select a place above.</p>
        )}
      </div>
    </div>
  );
}
