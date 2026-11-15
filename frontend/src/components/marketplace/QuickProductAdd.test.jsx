// A seasonal catalog (15 Nov 2026): ticking it, naming it and choosing its dates hands the season to the parent with
// every list read; without both dates nothing can be added; unticked, no season at all.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import QuickProductAdd from './QuickProductAdd';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === 'string' ? d : k) }) }));

const q = (el, id) => el.querySelector(`[data-testid="t-${id}"]`);
const type = (input, value) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const tset = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  (input.tagName === 'TEXTAREA' ? tset : set).call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

function mount(props) {
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  act(() => { root.render(<QuickProductAdd onExtract={props.onExtract} testid="t" seasonal={props.seasonal} />); });
  return el;
}

test('a seasonal catalog goes with the pasted list', async () => {
  const onExtract = jest.fn(() => Promise.resolve(true));
  const el = mount({ onExtract, seasonal: true });
  act(() => { q(el, 'season-on').click(); });
  act(() => { type(q(el, 'season-name'), 'Chanukah'); });
  expect(q(el, 'from-shot').disabled).toBe(true);   // no dates yet: nothing can be added
  act(() => { type(q(el, 'season-from'), '2026-11-20'); type(q(el, 'season-until'), '2026-12-20'); });
  expect(q(el, 'from-shot').disabled).toBe(false);
  act(() => { q(el, 'paste-toggle').click(); });
  act(() => { type(q(el, 'paste'), 'Sufganiya 12'); });
  await act(async () => { q(el, 'paste-read').click(); });
  expect(onExtract).toHaveBeenCalledWith({ text: 'Sufganiya 12' }, expect.objectContaining({ on: true, name: 'Chanukah', from: '2026-11-20', until: '2026-12-20' }));
});

test('no tick, no season; a service list has no tick at all', async () => {
  const onExtract = jest.fn(() => Promise.resolve(true));
  const el = mount({ onExtract, seasonal: true });
  act(() => { q(el, 'paste-toggle').click(); });
  act(() => { type(q(el, 'paste'), 'Board 180'); });
  await act(async () => { q(el, 'paste-read').click(); });
  expect(onExtract).toHaveBeenCalledWith({ text: 'Board 180' }, null);
  const svc = mount({ onExtract, seasonal: false });
  expect(q(svc, 'season-on')).toBeNull();
});
