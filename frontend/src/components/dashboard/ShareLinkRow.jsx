import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Compact, polished share-link control. Used in two places:
 * - inside ManagerHeader (full "Your Manager Page" block, manager/admin only)
 * - standalone on the owner dashboard so owners can also send a public link
 *   to all of their listings.
 *
 * Pass a `userId` to build the default `/manager/{id}` link, or pass an
 * explicit `link` to override.
 */
const ShareLinkRow = ({
  userId,
  link,
  label = 'Share your listings',
  testidPrefix = 'shareable-link',
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const shareableLink = link || `${window.location.origin}/manager/${userId}`;

  const copy = async () => {
    const writeOk = async () => {
      try {
        await navigator.clipboard.writeText(shareableLink);
        return true;
      } catch {
        const ta = document.createElement('textarea');
        ta.value = shareableLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      }
    };
    if (await writeOk()) {
      setCopied(true);
      toast.success(t('qr.linkCopied', 'Link copied'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div
        className="flex items-stretch rounded-xl border border-[#E5E5E5] bg-gray-50 overflow-hidden focus-within:border-[var(--brand-primary)] focus-within:ring-2 focus-within:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/15 transition-all"
        data-testid={`${testidPrefix}-row`}
      >
        <span className="flex items-center ps-3 pe-2 text-gray-400 flex-shrink-0">
          <Link2 size={14} />
        </span>
        <input
          type="text"
          value={shareableLink}
          readOnly
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 py-2 pe-2 bg-transparent text-sm text-gray-700 focus:outline-none truncate"
          data-testid={testidPrefix}
        />
        <button
          onClick={copy}
          className={`flex items-center gap-1.5 px-3.5 text-xs font-semibold transition-colors flex-shrink-0 border-l border-[#E5E5E5] ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-[var(--brand-primary)] text-[var(--gold)] hover:bg-[#155454]'
          }`}
          data-testid={`${testidPrefix}-copy-button`}
        >
          {copied ? <Check size={13} /> : <Link2 size={13} />}
          {copied ? t('qr.copied', 'Copied!') : t('qr.copy', 'Copy')}
        </button>
      </div>
    </div>
  );
};

export default ShareLinkRow;
