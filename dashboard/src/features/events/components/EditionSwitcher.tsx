import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import {
  formatEditionRange,
  useEditionScope,
} from '@/features/events/hooks/useEditionScope';
import { Button } from '@/shared/ui/Button';

interface EditionSwitcherProps {
  label?: string;
  pastBannerTitle?: string;
  pastBannerBody?: string;
  tipText?: string;
}

export function EditionSwitcher({
  label = 'Edition',
  pastBannerTitle = 'Editing past edition',
  pastBannerBody,
  tipText,
}: EditionSwitcherProps) {
  const {
    editions,
    selectedEdition,
    currentEdition,
    isPastEdition,
    selectEdition,
    clearEditionFilter,
    workspaceQuery,
  } = useEditionScope();

  if (workspaceQuery.isLoading || editions.length === 0) return null;

  const resolvedPastBody =
    pastBannerBody ??
    (selectedEdition
      ? `${formatEditionRange(selectedEdition)} — you can still update speakers, sessions, sponsors, and reviews for this edition.`
      : '');

  return (
    <div className="edition-switcher">
      <label className="edition-switcher-control">
        <span className="field-label">{label}</span>
        <select
          className="field-input edition-select"
          value={selectedEdition?.id ?? ''}
          onChange={(e) => selectEdition(e.target.value)}
          aria-label={`Select ${label.toLowerCase()}`}
        >
          {editions.map((edition) => {
            const isCurrent = edition.id === currentEdition?.id;
            return (
              <option key={edition.id} value={edition.id}>
                {formatEditionRange(edition)}
                {isCurrent ? ' (current)' : ' (past)'}
              </option>
            );
          })}
        </select>
      </label>

      {isPastEdition && selectedEdition ? (
        <div className="edition-readonly-banner" role="status">
          <History size={16} />
          <div>
            <strong>{pastBannerTitle}</strong>
            <p className="muted">{resolvedPastBody}</p>
          </div>
          <Button variant="secondary" onClick={clearEditionFilter}>
            Back to current
          </Button>
        </div>
      ) : null}

      {editions.length > 1 && !isPastEdition ? (
        <p className="hint edition-switcher-hint">
          {tipText ?? (
            <>
              Tip: pick a past edition above, or open one from the{' '}
              <Link to="/events">Event</Link> page.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
