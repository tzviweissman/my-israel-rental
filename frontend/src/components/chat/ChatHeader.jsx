import React from 'react';
import { useTranslation } from 'react-i18next';
import { areaLabel } from '../../utils/areaNames';
import {
  ArrowLeft, Home, Building2, Briefcase, Search, ChevronUp, ChevronDown, X,
} from 'lucide-react';

/**
 * Chat top bar (back / live indicator / search toggle / dashboard) +
 * collapsible search bar + property/sublease/job info bar.
 *
 * Owns nothing — every piece of state comes from the parent (Chat.js)
 * because the search query also drives message-bubble highlighting.
 *
 * A single chat thread is scoped to ONE of {property, sublease, job}.
 * Job threads exist for the Jobs Board reverse marketplace when a poster
 * clicks "Message" on an applicant. The Chat.js parent fetches the job
 * doc from `/marketplace/jobs/{id}` when the /properties lookup returns
 * 404, and passes it down here.
 */
const ChatHeader = ({
  property,
  sublease,
  job,
  onBack,
  onDashboard,
  searchOpen,
  setSearchOpen,
  searchQuery,
  setSearchQuery,
  activeMatchIndex,
  setActiveMatchIndex,
  matchIds,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-t-2xl border border-b-0 border-gray-200 shadow-sm overflow-hidden flex-shrink-0">
      {/* Top bar with back button */}
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[var(--brand-primary)] to-[#267a7a]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium transition-colors"
          data-testid="chat-back-btn"
        >
          <ArrowLeft size={16} />
          {t('chat.back')}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white/80 text-xs font-medium">{t('chat.liveChat')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSearchOpen((v) => {
                const next = !v;
                if (!next) {
                  setSearchQuery('');
                  setActiveMatchIndex(0);
                }
                return next;
              });
            }}
            className={`p-2 rounded-lg transition-all backdrop-blur-sm ${
              searchOpen ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'
            }`}
            data-testid="chat-search-toggle"
            aria-label={t('chat.searchMessages')}
            title={t('chat.searchMessages')}
          >
            <Search size={14} className="text-white" />
          </button>
          <button
            onClick={onDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all backdrop-blur-sm"
            data-testid="return-dashboard-btn"
          >
            <Home size={14} />
            {t('chat.dashboard')}
          </button>
        </div>
      </div>

      {/* Search bar (collapsible) */}
      {searchOpen && (
        <div
          className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50"
          data-testid="chat-search-bar"
        >
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveMatchIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (matchIds.length > 0) {
                  setActiveMatchIndex((i) => (i + 1) % matchIds.length);
                }
              } else if (e.key === 'Escape') {
                setSearchOpen(false);
                setSearchQuery('');
                setActiveMatchIndex(0);
              }
            }}
            placeholder={t('chat.searchPlaceholder')}
            autoFocus
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
            data-testid="chat-search-input"
          />
          {searchQuery && (
            <span
              className="text-[11px] text-gray-500 flex-shrink-0"
              data-testid="chat-search-counter"
            >
              {matchIds.length === 0
                ? t('chat.noMatches')
                : t('chat.matchCounter', {
                    current: activeMatchIndex + 1,
                    total: matchIds.length,
                  })}
            </span>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() =>
                matchIds.length > 0 &&
                setActiveMatchIndex((i) => (i - 1 + matchIds.length) % matchIds.length)
              }
              disabled={matchIds.length === 0}
              className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="chat-search-prev"
              aria-label={t('chat.previousMatch')}
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={() =>
                matchIds.length > 0 && setActiveMatchIndex((i) => (i + 1) % matchIds.length)
              }
              disabled={matchIds.length === 0}
              className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="chat-search-next"
              aria-label={t('chat.nextMatch')}
            >
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
                setActiveMatchIndex(0);
              }}
              className="p-1 rounded text-gray-500 hover:bg-gray-200"
              data-testid="chat-search-close"
              aria-label={t('chat.closeSearch')}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Property info bar */}
      {property && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          <div className="w-11 h-11 rounded-xl bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-[var(--brand-primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-800 truncate">
              {sublease?.title || property.title}
            </h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span>{areaLabel(sublease?.area || property.area, t)}</span>
              {sublease ? (
                <>
                  <span className="text-gray-300 mx-1">•</span>
                  <span className="font-medium" style={{ color: 'var(--gold)' }}>
                    {sublease.currency === 'USD' ? '$' : '₪'}
                    {sublease.price?.toLocaleString()}
                    {sublease.price_type === 'per_night' ? '/night' : ' total'}
                  </span>
                </>
              ) : property.monthly_price ? (
                <>
                  <span className="text-gray-300 mx-1">•</span>
                  <span className="font-medium" style={{ color: 'var(--gold)' }}>
                    {property.currency === 'USD' ? '$' : '₪'}
                    {property.monthly_price?.toLocaleString()}/mo
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)] uppercase tracking-wider">
              {sublease ? t('chat.subleaseLabel') : property.rental_type?.replace('-', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Job info bar — rendered when the chat is scoped to a Jobs Board
          post rather than a property listing. Same visual shape as the
          property bar so the chat page stays consistent regardless of
          which surface spawned the thread. */}
      {!property && job && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100" data-testid="chat-header-job-bar">
          <div className="w-11 h-11 rounded-xl bg-[rgb(var(--gold-rgb)/<alpha-value>)]/15 flex items-center justify-center shrink-0">
            <Briefcase size={20} className="text-[#8A6A15]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-800 truncate" data-testid="chat-header-job-title">
              {job.title}
            </h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span>{job.area}</span>
              {job.budget_type === 'fixed' && job.budget_amount ? (
                <>
                  <span className="text-gray-300 mx-1">•</span>
                  <span className="font-medium" style={{ color: 'var(--gold)' }}>
                    {job.budget_currency === 'USD' ? '$' : '₪'}
                    {Number(job.budget_amount).toLocaleString()}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-gray-300 mx-1">•</span>
                  <span className="text-gray-500">Open to offers</span>
                </>
              )}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[rgb(var(--gold-rgb)/<alpha-value>)]/15 text-[#8A6A15] uppercase tracking-wider">
              Job
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
