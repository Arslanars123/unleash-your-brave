import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { sponsorsApi } from '@/features/sponsors/api/sponsors-api';
import { SponsorFormModal } from '@/features/sponsors/components/SponsorFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import type { EventMembershipLink, SponsorPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/toast';
import {
  membershipIdsFromLinks,
  syncMembershipLinks,
} from '@/features/events/components/event-form-utils';

export interface EventAssociationSelection {
  sponsorIds: string[];
  membershipIds: string[];
  membershipLinks: EventMembershipLink[];
}

interface EventAssociationPickerProps {
  value: EventAssociationSelection;
  onChange: (next: EventAssociationSelection) => void;
  disabled?: boolean;
  showMemberships?: boolean;
  showSponsors?: boolean;
  /** Last event day (YYYY-MM-DD) — purchase deadlines must be on/before this date. */
  eventEndDate?: string | null;
  /** Lets admins create a sponsor profile without leaving the event form. */
  allowCreateSponsor?: boolean;
  /** Explains that links are per-event and content stays separate. */
  hint?: string;
  membershipError?: string;
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function applyMembershipIds(
  value: EventAssociationSelection,
  membershipIds: string[],
): EventAssociationSelection {
  return {
    ...value,
    membershipIds,
    membershipLinks: syncMembershipLinks(value.membershipLinks, membershipIds),
  };
}

function updateMembershipLink(
  value: EventAssociationSelection,
  membershipId: string,
  patch: Partial<Pick<EventMembershipLink, 'saleExpiresAt' | 'badgeLabel'>>,
): EventAssociationSelection {
  const membershipLinks = value.membershipLinks.map((link) =>
    link.membershipId === membershipId ? { ...link, ...patch } : link,
  );
  return { ...value, membershipLinks };
}

/**
 * Multi-select shared memberships / sponsors for an edition.
 * Speakers are linked via sessions, not here.
 */
export function EventAssociationPicker({
  value,
  onChange,
  disabled = false,
  showMemberships = true,
  showSponsors = true,
  eventEndDate = null,
  allowCreateSponsor = false,
  hint = 'Select shared memberships and sponsors for this event. Speakers are assigned when you create sessions. The same tier or sponsor can be linked to multiple events.',
  membershipError,
}: EventAssociationPickerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);

  const sponsorsQuery = useQuery({
    queryKey: ['sponsors', 'library'],
    queryFn: () => sponsorsApi.list({ page: 1, perPage: 100 }),
  });

  const createSponsorMutation = useMutation({
    mutationFn: (payload: SponsorPayload) => sponsorsApi.create(payload),
    onSuccess: async (sponsor) => {
      await queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      onChange({
        ...value,
        sponsorIds: value.sponsorIds.includes(sponsor.id)
          ? value.sponsorIds
          : [...value.sponsorIds, sponsor.id],
      });
      toast.success('Sponsor created and linked');
      setSponsorModalOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create sponsor')),
  });
  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'library'],
    queryFn: () => membershipsApi.list({ page: 1, perPage: 100 }),
  });

  const sponsors = sponsorsQuery.data?.items ?? [];
  const memberships = membershipsQuery.data?.items ?? [];
  const selectedMembershipLinks = value.membershipLinks.filter((link) =>
    value.membershipIds.includes(link.membershipId),
  );
  const endDateMax = eventEndDate?.slice(0, 10) ?? undefined;

  return (
    <fieldset className="schedule-fieldset" disabled={disabled}>
      <legend>
        {showMemberships && showSponsors
          ? 'Event associations'
          : showSponsors
            ? 'Sponsors'
            : 'Memberships'}
      </legend>
      <p className="hint">{hint}</p>

      {showMemberships ? (
        <>
          <AssociationChecklist
            title="Memberships"
            empty="No memberships in the library yet. Create them on the Memberships page, then link here."
            items={memberships.map((item) => ({ id: item.id, label: item.name }))}
            selected={value.membershipIds}
            onToggle={(id) =>
              onChange(applyMembershipIds(value, toggleId(value.membershipIds, id)))
            }
          />
          {selectedMembershipLinks.length > 0 ? (
            <div className="membership-link-settings" style={{ marginTop: 16 }}>
              <p className="field-label">Per-tier settings for this edition</p>
              <p className="hint" style={{ marginTop: 0 }}>
                Optional purchase deadline stops new sales after that date (existing buyers keep
                access). Deadline must be on or before the event end date
                {endDateMax ? ` (${endDateMax})` : ''}.
              </p>
              <ul className="day-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {selectedMembershipLinks.map((link) => {
                  const label =
                    memberships.find((item) => item.id === link.membershipId)?.name ??
                    'Membership';
                  return (
                    <li
                      key={link.membershipId}
                      className="membership-link-row"
                      style={{
                        border: '1px solid var(--border, #ddd)',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <strong>{label}</strong>
                      <div
                        style={{
                          display: 'grid',
                          gap: 12,
                          marginTop: 10,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        }}
                      >
                        <label className="field">
                          <span className="field-label">Purchase deadline</span>
                          <input
                            type="date"
                            className="field-input"
                            max={endDateMax}
                            value={link.saleExpiresAt ?? ''}
                            disabled={disabled}
                            onChange={(e) =>
                              onChange(
                                updateMembershipLink(value, link.membershipId, {
                                  saleExpiresAt: e.target.value || null,
                                }),
                              )
                            }
                          />
                        </label>
                        <Input
                          label="Badge label"
                          value={link.badgeLabel ?? ''}
                          disabled={disabled}
                          placeholder="e.g. Early Access"
                          onChange={(e) =>
                            onChange(
                              updateMembershipLink(value, link.membershipId, {
                                badgeLabel: e.target.value.trim() || null,
                              }),
                            )
                          }
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {membershipError ? <p className="field-error">{membershipError}</p> : null}
        </>
      ) : null}

      {showSponsors ? (
        <>
          {allowCreateSponsor ? (
            <div className="toolbar" style={{ marginTop: 12, marginBottom: 8 }}>
              <Button
                type="button"
                variant="secondary"
                disabled={disabled || createSponsorMutation.isPending}
                onClick={() => setSponsorModalOpen(true)}
              >
                <Plus size={16} />
                Create sponsor
              </Button>
            </div>
          ) : null}
          <AssociationChecklist
            title="Sponsors"
            empty={
              allowCreateSponsor
                ? 'No sponsors yet. Create one above, then select it for this edition.'
                : 'No sponsors in the library yet. Create them on the Sponsors page, then link here.'
            }
            items={sponsors.map((item) => ({ id: item.id, label: item.name }))}
            selected={value.sponsorIds}
            onToggle={(id) => onChange({ ...value, sponsorIds: toggleId(value.sponsorIds, id) })}
          />
          {allowCreateSponsor ? (
            <SponsorFormModal
              open={sponsorModalOpen}
              mode="create"
              loading={createSponsorMutation.isPending}
              onClose={() => setSponsorModalOpen(false)}
              onSubmit={async (payload) => {
                await createSponsorMutation.mutateAsync(payload);
              }}
            />
          ) : null}
        </>
      ) : null}
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

/** Keep membershipIds aligned when loading association data. */
export function associationSelectionFromApi(input: {
  sponsorIds: string[];
  membershipIds: string[];
  membershipLinks?: EventMembershipLink[];
}): EventAssociationSelection {
  const membershipLinks = syncMembershipLinks(
    input.membershipLinks ?? [],
    input.membershipIds,
  );
  return {
    sponsorIds: input.sponsorIds,
    membershipIds: membershipIdsFromLinks(membershipLinks),
    membershipLinks,
  };
}
