import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem 0 0.25rem' }}>
      <button
        type="button"
        className="ds-iconbtn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={20} strokeWidth={2.2} />
      </button>
      <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
        Page <span className="mono">{page}</span> of <span className="mono">{totalPages}</span>
      </span>
      <button
        type="button"
        className="ds-iconbtn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={20} strokeWidth={2.2} />
      </button>
    </div>
  );
};
