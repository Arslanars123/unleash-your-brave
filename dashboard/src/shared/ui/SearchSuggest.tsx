import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Spinner } from '@/shared/ui/Spinner';

export interface SearchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  /** Optional leading media / icon node */
  leading?: ReactNode;
}

interface SearchSuggestProps {
  label?: string;
  placeholder?: string;
  /** Committed query driving the main list */
  value: string;
  onChange: (next: string) => void;
  /** Fetch suggestions for the debounced draft (return top ~5) */
  loadSuggestions: (draft: string) => Promise<SearchSuggestion[]>;
  /** Called when a suggestion row is chosen (also applies title as search) */
  onSelectSuggestion?: (item: SearchSuggestion) => void;
  disabled?: boolean;
}

/**
 * Instagram-style search: type → suggestions → “See all” commits the query.
 */
export function SearchSuggest({
  label = 'Search',
  placeholder = 'Search…',
  value,
  onChange,
  loadSuggestions,
  onSelectSuggestion,
  disabled = false,
}: SearchSuggestProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(loadSuggestions);
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const debouncedDraft = useDebouncedValue(draft.trim(), 280);

  loadRef.current = loadSuggestions;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!open || debouncedDraft.length < 1) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadRef
      .current(debouncedDraft)
      .then((items) => {
        if (!cancelled) setSuggestions(items.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedDraft, open]);

  function commit(next: string) {
    onChange(next.trim());
    setDraft(next);
    setOpen(false);
  }

  function clear() {
    setDraft('');
    onChange('');
    setSuggestions([]);
    setOpen(false);
  }

  const showPanel = open && draft.trim().length > 0;

  return (
    <div className="search-suggest" ref={rootRef}>
      {label ? <span className="field-label">{label}</span> : null}
      <div className={`search-suggest-field ${showPanel ? 'is-open' : ''}`}>
        <Search size={18} className="search-suggest-icon" aria-hidden />
        <input
          className="search-suggest-input"
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(draft);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        {draft ? (
          <button type="button" className="search-suggest-clear" onClick={clear} aria-label="Clear search">
            <X size={16} />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div className="search-suggest-panel" id={listId} role="listbox">
          {loading ? (
            <div className="search-suggest-empty">
              <Spinner />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="search-suggest-empty">
              <p>No matches for “{draft.trim()}”</p>
              <button type="button" className="search-suggest-see-all" onClick={() => commit(draft)}>
                Search anyway
              </button>
            </div>
          ) : (
            <>
              <ul className="search-suggest-list">
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="search-suggest-item"
                      role="option"
                      onClick={() => {
                        onSelectSuggestion?.(item);
                        commit(item.title);
                      }}
                    >
                      {item.leading ? (
                        <span className="search-suggest-leading">{item.leading}</span>
                      ) : (
                        <span className="search-suggest-leading search-suggest-leading-fallback">
                          <Search size={14} />
                        </span>
                      )}
                      <span className="search-suggest-copy">
                        <strong>{item.title}</strong>
                        {item.subtitle ? <span className="muted">{item.subtitle}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="search-suggest-see-all" onClick={() => commit(draft)}>
                See all results for “{draft.trim()}”
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
