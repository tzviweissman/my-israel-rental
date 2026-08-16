/**
 * RequestDetail — /requests/:id.
 *
 * Public to read. The one action is "Message seeker", which POSTs to
 * /contact and follows the chat URL the server returns — the client never
 * constructs it, because the server is what decides whether this viewer
 * is allowed to contact at all and what counts as a contact.
 *
 * There is deliberately no seeker name, photo or contact detail on this
 * page. The API doesn't return any; identity is something the seeker
 * reveals in chat, not something the board publishes.
 */
import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Home, Wrench, MapPin, Coins, BedDouble, CalendarDays, Clock,
  MessageCircle, Loader2, ArrowLeft, Flag, CheckCircle2, RefreshCw, ExternalLink,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';

const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso) - new Date();
  return Number.isNaN(ms) ? null : Math.max(0, Math.ceil(ms / 86400000));
};

const Row = ({ Icon, label, value }) => (
  value ? (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink)' }}>
      <Icon size={15} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
      <span style={{ color: 'var(--brand-muted)' }}>{label}</span>
      <b>{value}</b>
    </div>
  ) : null
);

const RequestDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/marketplace/requests/${id}`)
      .then((r) => { setRequest(r.data); setNotFound(false); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const isMine = user && request && request.poster_user_id === user.id;

  const contact = async () => {
    if (!user) {
      navigate(`/join?redirect=${encodeURIComponent(`/requests/${id}`)}`);
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/requests/${id}/contact`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Follow the server's URL rather than building one — it owns the
      // rule about who may contact whom.
      navigate(data.chat_url);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('requests.contactFailed', 'Could not open the chat'));
    } finally {
      setBusy(false);
    }
  };

  const act = async (path, successMsg) => {
    setBusy(true);
    try {
      await axios.post(`${API}/marketplace/requests/${id}/${path}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(successMsg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('requests.actionFailed', 'That did not work'));
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    const reason = window.prompt(t('requests.reportPrompt', 'What is wrong with this request?'));
    if (!reason || reason.trim().length < 3) return;
    try {
      await axios.post(`${API}/marketplace/requests/${id}/report`, { reason: reason.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(t('requests.reported', 'Thanks — we will take a look.'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('requests.actionFailed', 'That did not work'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 className="animate-spin" size={28} style={{ color: 'var(--brand-primary)' }} />
      </div>
    );
  }

  if (notFound || !request) {
    return (
      <div
        className="min-h-screen px-4"
        style={{ background: 'var(--bg)', paddingTop: 'calc(var(--nav-h, 68px) + 80px)' }}
        data-testid="request-not-found"
      >
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>
            {t('requests.goneTitle', 'This request is no longer available')}
          </p>
          <p className="text-sm mt-2 mb-6" style={{ color: 'var(--brand-muted)' }}>
            {t('requests.goneBody', 'It may have been found, withdrawn or removed.')}
          </p>
          <button type="button" onClick={() => navigate('/requests')} className="btn-blue-solid">
            {t('requests.backToBoard', 'Back to the board')}
          </button>
        </div>
      </div>
    );
  }

  const isRental = request.request_type === 'rental';
  const expiresIn = daysUntil(request.expires_at);
  const budget = request.budget_amount
    ? `${request.budget_currency === 'USD' ? '$' : '₪'}${Number(request.budget_amount).toLocaleString()}`
    : t('requests.budgetOpenShort', 'Open to offers');

  // C3 — one value for both variants' date row. Flexible is stated rather
  // than left blank: a blank row makes a flexible seeker indistinguishable
  // from one who never answered, and an owner reads those very differently.
  // null falls through to the Row component's own empty handling.
  const rawDate = isRental ? request.move_in_date : request.preferred_date;
  const dateValue = request.date_mode === 'flexible'
    ? t('requests.dateFlexible', "I'm flexible")
    : rawDate && request.date_mode === 'before'
      ? t('requests.dateByPrefix', 'by {{date}}', { date: rawDate })
      : rawDate;

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="request-detail-page"
    >
      <PageMeta
        title={`${request.title} | MyIsraelRental`}
        description={(request.description || '').slice(0, 155)}
        path={`/requests/${id}`}
      />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => navigate('/requests')}
          className="inline-flex items-center gap-2 text-sm font-semibold mb-6"
          style={{ color: 'var(--brand-muted)' }}
          data-testid="request-detail-back"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {t('requests.backToBoard', 'Back to the board')}
        </button>

        <div className="bg-white rounded-2xl border p-6 sm:p-8" style={{ borderColor: 'var(--brand-border)' }}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`rc-badge ${request.post_kind === 'have' ? 'rc-badge-offer' : 'rc-badge-want'}`}>
              {request.post_kind === 'have'
                ? t('requests.badgeHave', 'Post')
                : t('requests.badgeWant', 'Request')}
            </span>
            <span className={`rc-badge ${isRental ? 'rc-badge-rental' : 'rc-badge-service'}`}>
              {isRental ? <Home size={11} aria-hidden="true" /> : <Wrench size={11} aria-hidden="true" />}
              {isRental ? t('requests.rental', 'Rental') : t('requests.service', 'Service')}
            </span>
            {request.status !== 'open' && (
              <span className="rc-badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                {t(`requests.status_${request.status}`, request.status)}
              </span>
            )}
            {request.status === 'open' && expiresIn != null && (
              <span className="rc-status">
                <Clock size={12} aria-hidden="true" />
                {t('requests.expiresIn', 'expires in {{n}} days', { n: expiresIn })}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {request.title}
          </h1>

          <div className="grid sm:grid-cols-2 gap-2 mb-5">
            <Row Icon={MapPin} label={t('requests.fieldArea', 'Area')} value={request.area} />
            <Row Icon={Coins} label={t('requests.fieldBudget', 'Budget')} value={budget} />
            {isRental && (
              <>
                <Row Icon={BedDouble} label={t('requests.fieldBedrooms', 'Bedrooms (minimum)')} value={request.bedrooms_min || null} />
                <Row Icon={CalendarDays} label={t('requests.fieldMoveIn', 'Move-in date')} value={dateValue} />
                <Row Icon={Clock} label={t('requests.fieldLease', 'Lease length (months)')} value={request.lease_months} />
              </>
            )}
            {!isRental && (
              <>
                <Row Icon={Wrench} label={t('requests.fieldCategory', 'Category')} value={(request.category || '').replace(/-/g, ' ')} />
                <Row Icon={CalendarDays} label={t('requests.fieldPreferredDate', 'Preferred date')} value={dateValue} />
              </>
            )}
          </div>

          {/* The full listing, when the poster has one here. Only ever an
              internal /property/{id} link - the id is checked server-side
              to belong to the poster, so this cannot point off-site. */}
          {request.listing_id && (
            <a
              href={`/property/${request.listing_id}`}
              className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold"
              style={{ color: 'var(--brand-primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              data-testid="request-detail-listing-link"
            >
              <ExternalLink size={14} aria-hidden="true" />
              {t('requests.viewListingFull', 'See the full listing — photos, price and availability')}
            </a>
          )}

          <p className="text-sm leading-relaxed whitespace-pre-line mb-6" style={{ color: 'var(--ink)' }}>
            {request.description}
          </p>

          {isMine ? (
            /* The seeker's own controls. contact_count is shown here and
               nowhere else — it is the one number that tells them their
               post is working. */
            <div className="border-t pt-5" style={{ borderColor: 'var(--brand-border)' }} data-testid="request-owner-actions">
              <p className="text-sm mb-3" style={{ color: 'var(--brand-muted)' }}>
                {t('requests.contactCount', '{{n}} people have opened a chat about this', { n: request.contact_count || 0 })}
              </p>
              <div className="flex flex-wrap gap-2">
                {request.status !== 'found' && (
                  <button type="button" onClick={() => act('found', t('requests.markedFound', 'Marked as found'))}
                          disabled={busy} className="btn-blue-solid inline-flex items-center gap-1.5 disabled:opacity-60"
                          data-testid="request-mark-found">
                    <CheckCircle2 size={15} />{t('requests.markFound', "I found it")}
                  </button>
                )}
                {request.status !== 'found' && (
                  <button type="button" onClick={() => act('renew', t('requests.renewed', 'Renewed for another 30 days'))}
                          disabled={busy} className="px-4 py-2.5 rounded-full text-sm font-semibold border disabled:opacity-60 inline-flex items-center gap-1.5"
                          style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                          data-testid="request-renew">
                    <RefreshCw size={14} />{t('requests.renew', 'Renew')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t pt-5 flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--brand-border)' }}>
              <button
                type="button" onClick={contact} disabled={busy || request.status !== 'open'}
                className="btn-blue-solid inline-flex items-center gap-2 disabled:opacity-60"
                data-testid="request-contact-btn"
              >
                {busy ? <Loader2 className="animate-spin" size={15} /> : <MessageCircle size={15} />}
                {request.post_kind === 'have'
                  ? t('requests.messageOwner', 'Message owner')
                  : t('requests.messageSeeker', 'Message seeker')}
              </button>
            {/* Opt-in only, and through the tracked redirect so the number
                stays server-side and the click is counted. */}
            {request.whatsapp_available && (
              <a
                href={`${API}/marketplace/requests/${encodeURIComponent(id)}/contact-whatsapp`
                  + `?text=${encodeURIComponent(request.post_kind === 'have'
                    ? t('requests.waPrefillOffer', 'Hi! I saw your post on the MyIsraelRental marketplace.')
                    : t('requests.waPrefillRequest', 'Hi! I saw your request on the MyIsraelRental marketplace.'))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost inline-flex items-center gap-2"
                data-testid="request-detail-whatsapp"
              >
                <MessageCircle size={15} aria-hidden="true" />
                {t('requests.messageWhatsapp', 'WhatsApp')}
              </a>
            )}
              <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                {t('requests.chatOnlyNote', 'Chat happens on MyIsraelRental — no phone numbers are shared.')}
              </span>
              {user && (
                <button
                  type="button" onClick={report}
                  className="ms-auto text-xs font-semibold inline-flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--brand-muted)' }}
                  data-testid="request-report-btn"
                >
                  <Flag size={12} />{t('requests.report', 'Report')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestDetail;
