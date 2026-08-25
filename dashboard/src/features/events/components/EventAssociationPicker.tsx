import { useQuery } from '@tanstack/react-query';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { sponsorsApi } from '@/features/sponsors/api/sponsors-api';

export interface EventAssociationSelection {
  speakerIds: string[];
  sponsorIds: string[];
  membershipIds: string[];
}

interface EventAssociationPickerProps {
  value: EventAssociationSelection;
  onChange: (next: EventAssociationSelection) => void;
  disabled?: boolean;
  /** Explains that links are per-event and content stays separate. */
  hint?: string;
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

/**
 * Multi-select shared memberships / speakers / sponsors for an edition.
 * The same entity can be linked to many events; sessions/content stay event-specific.
 */
export function EventAssociationPicker({
  value,
  onChange,
  disabled = false,
  hint = 'Select shared memberships, speakers, and sponsors for this event. The same person or tier can be linked to multiple events; sessions and offers stay separate per event.',
}: EventAssociationPickerProps) {
  const speakersQuery = useQuery({
    queryKey: ['speakers', 'library'],
    queryFn: () => speakersApi.list({ page: 1, perPage: 100 }),
  });
  const sponsorsQuery = useQuery({
    queryKey: ['sponsors', 'library'],
    queryFn: () => sponsorsApi.list({ page: 1, perPage: 100 }),
  });
  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'library'],
    queryFn: () => membershipsApi.list({ page: 1, perPage: 100 }),
  });

  const speakers = speakersQuery.data?.items ?? [];
  const sponsors = sponsorsQuery.data?.items ?? [];
  const memberships = membershipsQuery.data?.items ?? [];

  return (
    <fieldset className="schedule-fieldset" disabled={disabled}>
      <legend>Event associations</legend>
      <p className="hint">{hint}</p>

      <AssociationChecklist
        title="Memberships"
        empty="No memberships in the library yet. Create them on the Memberships page, then link here."
        items={memberships.map((item) => ({ id: item.id, label: item.name }))}
        selected={value.membershipIds}
        onToggle={(id) =>
          onChange({ ...value, membershipIds: toggleId(value.membershipIds, id) })
        }
      />

      <AssociationChecklist
        title="Speakers"
        empty="No speakers in the library yet. Create them on the Speakers page, then link here."
        items={speakers.map((item) => ({
          id: item.id,
          label: item.title ? `${item.name} — ${item.title}` : item.name,
        }))}
        selected={value.speakerIds}
        onToggle={(id) => onChange({ ...value, speakerIds: toggleId(value.speakerIds, id) })}
      />

      <AssociationChecklist
        title="Sponsors"
        empty="No sponsors in the library yet. Create them on the Sponsors page, then link here."
        items={sponsors.map((item) => ({ id: item.id, label: item.name }))}
        selected={value.sponsorIds}
        onToggle={(id) => onChange({ ...value, sponsorIds: toggleId(value.sponsorIds, id) })}
      />
    </fieldset>
  );
}

function AssociationChecklist({
  title,
  empty,
  items,
  selected,
  onToggle,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <p className="field-label">{title}</p>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="day-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ marginBottom: 6 }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
