/**
 * StaysSearchBar — 3-segment search pill (Where | Stay type | When)
 * plus a Filters button on the far end.
 *
 * Each segment's popover (Where suggestions, Stay-type menu, When
 * calendar) is rendered by its own child picker, which is why the pill
 * wrapper deliberately omits `overflow-hidden` — clipping the popover
 * to the pill would defeat the whole UX. The pill is rounded but the
 * children manage their own rounded corners.
 */
import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import WhenPicker from '../search/WhenPicker';
import WherePicker from '../search/WherePicker';
import StayTypePicker from '../search/StayTypePicker';

const StaysSearchBar = ({
  where, setWhere,
  checkin, setCheckin,
  checkout, setCheckout,
  flexible, setFlexible,
  subType, setSubType,
  areaOptions,
  onOpenFilters,
  filterCount,
  t,
}) => (
  <div className="flex items-stretch gap-2" data-testid="stays-search-bar">
    <div className="flex-1 flex items-stretch bg-[#F5F5F0] rounded-full border border-[#E5E5E5] hover:border-[#D4AF37] transition-colors">
      {/* On mobile the pill collapses to just Where — Stay type and
          When are hidden because they're available inside the Filters
          modal (Stay type as chips, Dates as a mobile-only section).
          This stops the segments from being squeezed to ~100px each
          and clipping their labels at viewports <640px. */}
      <div className="flex-1 min-w-0 rounded-full sm:rounded-l-full sm:rounded-r-none">
        <WherePicker
          value={where}
          onChange={setWhere}
          options={areaOptions}
          testidPrefix="stays-where"
        />
      </div>
      <div className="hidden sm:block w-px bg-[#E5E5E5] my-2" />
      <div className="hidden sm:block flex-1 min-w-0">
        <StayTypePicker
          value={subType}
          onChange={setSubType}
          testidPrefix="stays-type"
        />
      </div>
      <div className="hidden sm:block w-px bg-[#E5E5E5] my-2" />
      <div className="hidden sm:block flex-1 min-w-0">
        <WhenPicker
          checkin={checkin}
          checkout={checkout}
          flexible={flexible}
          onChange={({ checkin: ci, checkout: co, flexible: fx }) => {
            setCheckin(ci || '');
            setCheckout(co || '');
            setFlexible(fx || null);
          }}
          testidPrefix="stays-when"
        />
      </div>
    </div>
    <button
      onClick={onOpenFilters}
      className="flex items-center gap-2 px-3 sm:px-4 rounded-full border border-[#E5E5E5] hover:border-[#D4AF37] bg-white font-semibold text-sm text-gray-800 relative transition-colors shrink-0"
      data-testid="stays-filters-btn"
    >
      <SlidersHorizontal size={16} />
      <span className="hidden sm:inline">{t('stays.filters', 'Filters')}</span>
      {filterCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#D4AF37] text-white text-[10px] font-bold flex items-center justify-center">
          {filterCount}
        </span>
      )}
    </button>
  </div>
);

export default StaysSearchBar;
