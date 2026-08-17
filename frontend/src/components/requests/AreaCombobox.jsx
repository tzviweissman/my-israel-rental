/**
 * Area picker — the shared Combobox, pointed at the canonical list of
 * Israeli cities and neighbourhoods.
 *
 * Free text is allowed and submitted verbatim: someone naming a village we
 * have never heard of must not be blocked by our list. The dropdown is a
 * shortcut, not a gate.
 *
 * Why the shortcut matters beyond convenience: `area` is what the matching
 * email greps to decide which owners hear about a post, and what the board
 * filters on. "Ramat Eshkol", "ramat eshkol jerusalem" and "R. Eshkol" are
 * one place to a person and three to a regex, and the odd one out is a
 * post nobody is told about.
 */
import React from 'react';
import { MapPin } from 'lucide-react';
import Combobox from '../common/Combobox';
import { ALL_AREA_VALUES } from '../../constants/locations';

export default function AreaCombobox(props) {
  return <Combobox {...props} options={ALL_AREA_VALUES} allowFreeText icon={MapPin} />;
}
