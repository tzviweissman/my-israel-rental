/**
 * Nearby density bar — one-line summary of how many results sit within
 * common distance bands from the address the renter picked. Reuses the
 * `distance_km` field the parent already computed, so no extra maps or
 * API calls are needed.
 *
 * Shows up when the renter has entered an address; helps them answer
 * the "is this area dense enough for me?" question without zooming
 * out and counting pins.
 */
import React from 'react';
import { Footprints, MapPin, Layers } from 'lucide-react';

/**
 * @param {object} props
 * @param {Array<{distance_km:number|null}>} props.items
 * @param {string} [props.testId]
 * @param {string} [props.className]
 */
const NearbyDensityBar = ({ items, testId = 'nearby-density-bar', className = '' }) => {
  // Skip render entirely when we don't have a signal to talk about —
  // the parent already gates on `nearCoords`, but this guard keeps the
  // component safe if someone reuses it elsewhere.
  const withCoords = items.filter((p) => typeof p.distance_km === 'number');
  if (!withCoords.length) return null;

  const walking = withCoords.filter((p) => p.distance_km <= 1).length;
  const shortHop = withCoords.filter((p) => p.distance_km <= 3).length;
  const total = items.length;

  // Even a single hit within walking distance is worth surfacing. If
  // there are literally zero in any band we still show the total so
  // the renter knows the address geocoded correctly.
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-full bg-white/95 backdrop-blur ring-1 ring-black/5 shadow-sm px-4 py-2 text-xs sm:text-sm ${className}`}
      data-testid={testId}
    >
      {walking > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[#1E6A6A] font-semibold">
          <Footprints size={14} strokeWidth={2.4} />
          {walking} within walking
        </span>
      )}
      {shortHop > walking && (
        <span className="inline-flex items-center gap-1.5 text-gray-800">
          <MapPin size={14} />
          {shortHop} within 3&nbsp;km
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-gray-500">
        <Layers size={14} />
        {total} total
      </span>
    </div>
  );
};

export default NearbyDensityBar;
