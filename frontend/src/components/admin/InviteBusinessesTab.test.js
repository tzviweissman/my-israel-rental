import i18n from 'i18next';
import '../../i18n';
import { inviteMessage } from './InviteBusinessesTab';

// The invite says only what the site already promises, carries both links, and
// is written in the language picked, whatever language the dashboard shows.
describe('inviteMessage', () => {
  const origin = 'https://myisraelrental.com';

  it('English, with their name and both links', () => {
    const m = inviteMessage('en', ' Moshe ', origin);
    expect(m.startsWith('Hi Moshe,')).toBe(true);
    expect(m).toContain('Listing your business is free');
    expect(m).toContain('https://myisraelrental.com/join-rules');
    expect(m).toContain('https://myisraelrental.com/why-list');
    expect(m).not.toMatch(/&#x2F;|&amp;/); // links are not HTML-escaped
  });

  it('Hebrew, without a name, once the Hebrew strings are loaded', async () => {
    await i18n.loadLanguages('he');
    const m = inviteMessage('he', '', origin);
    expect(m.startsWith('שלום,')).toBe(true);
    expect(m).toContain('בחינם');
    expect(m).toContain('https://myisraelrental.com/join-rules');
  });
});
