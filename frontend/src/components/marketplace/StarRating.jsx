/**
 * StarRating — reusable star row for the Services Marketplace.
 *
 * Two modes:
 *   - `readOnly` (default): renders a filled-star line + tiny "avg (count)"
 *     label, e.g. ★ 4.7 (12).
 *   - Interactive: click a star to set a value, hover to preview. Used inside
 *     the "Leave a review" form on GigDetail.
 */
import React, { useState } from 'react';
import { Star } from 'lucide-react';

export const StarRating = ({
  value = 0,
  count,
  onChange,
  size = 14,
  showCount = true,
  className = '',
  testidPrefix = 'star',
}) => {
  const [hover, setHover] = useState(null);
  const interactive = typeof onChange === 'function';
  const shown = hover != null ? hover : value;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} data-testid={`${testidPrefix}-row`}>
      <span className="inline-flex" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= shown;
          const StarEl = (
            <Star
              size={size}
              className={filled ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-gray-300'}
            />
          );
          if (!interactive) return <span key={n}>{StarEl}</span>;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              className="p-0.5 hover:scale-110 transition-transform"
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              data-testid={`${testidPrefix}-${n}`}
            >
              {StarEl}
            </button>
          );
        })}
      </span>
      {showCount && !interactive && (
        value > 0 ? (
          <span className="text-xs text-gray-700 font-semibold" data-testid={`${testidPrefix}-label`}>
            {Number(value).toFixed(1)}
            {typeof count === 'number' && count > 0 && (
              <span className="text-gray-400 font-normal"> ({count})</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-gray-400" data-testid={`${testidPrefix}-empty`}>
            No reviews yet
          </span>
        )
      )}
    </span>
  );
};

export default StarRating;
