interface ListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function ListPagination({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
  label = 'results',
}: ListPaginationProps) {
  if (totalPages <= 1 && total <= perPage) {
    return total > 0 ? (
      <div className="list-pagination list-pagination-meta-only">
        <span className="muted">
          {total} {label}
        </span>
      </div>
    ) : null;
  }

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="list-pagination">
      <span className="list-pagination-meta muted">
        {from}–{to} of {total} {label}
      </span>
      <div className="list-pagination-controls">
        <button
          type="button"
          className="list-pagination-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="list-pagination-page">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className="list-pagination-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
