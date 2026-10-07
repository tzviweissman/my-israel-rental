/**
 * The save heart on storefront cards and the item page (phase 5). Filled
 * when saved. No "saved by N people" count: none is shown anywhere.
 */
import React from 'react';
import { Heart } from 'lucide-react';

export default function SaveHeart({ saved, onClick, t, testid, size = 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-11 h-11';
  return (
    <button type="button" onClick={onClick} aria-pressed={!!saved}
      aria-label={saved ? t('saved.unsave', 'Remove from Saved') : t('saved.save', 'Save')}
      title={saved ? t('saved.unsave', 'Remove from Saved') : t('saved.save', 'Save')}
      className={`${dim} shrink-0 inline-flex items-center justify-center rounded-full border transition-colors`}
      style={{ borderColor: 'var(--brand-border)', background: 'var(--surface)', color: saved ? 'var(--gold-text-on-light)' : 'var(--ink)' }}
      data-testid={testid} data-saved={saved ? 'true' : 'false'}>
      <Heart size={18} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
