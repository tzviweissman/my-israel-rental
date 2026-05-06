// Shared catalog + pricing helpers for the paid document services.
// Mirrors VALID_DOC_SERVICES / SERVICE_PRETTY / SERVICE_REQUIRED_INFO and the
// pricing formula in /app/backend/routes/payments.py — keep these in sync.

export const PRICE_PER = 150;
export const PAIR_DISCOUNT = 50;

export const DOC_SERVICES = [
  {
    key: 'kitzvat_yeladim',
    label: 'Kitzvat Yeladim (Child Stipend)',
    hint: 'We file your monthly child allowance claim with Bituach Leumi.',
    price: PRICE_PER,
    items: [
      "Parents' passports",
      "Proof of bank account in the mother's name (e.g. a void check)",
      "A copy of the child's passport and visa",
      "Daf knisot v'yitziot for the child and one parent",
      "Mother's Teudat Zehut / Bituach Leumi number",
      "Father's Teudat Zehut / Bituach Leumi number",
      "Child's Teudat Zehut / Bituach Leumi number",
    ],
  },
  {
    key: 'maanak_leidah',
    label: 'Maanak Leidah (Birth Grant)',
    hint: 'We file your one-time birth grant claim with Bituach Leumi.',
    price: PRICE_PER,
    items: [
      "Mother's passport",
      "Father's passport",
      "Child's passport",
      "Mother's Teudat Zehut / Bituach Leumi number",
      'Address',
      'Employment status',
      "Father's Teudat Zehut / Bituach Leumi number",
      'Hospital of birth',
      'Proof of payment to hospital and amount paid',
      'Bank details',
    ],
  },
  {
    key: 'birth_expenses',
    label: 'Birth expenses',
    hint: 'We submit your reimbursement claim for hospitalization & birth expenses.',
    price: PRICE_PER,
    items: [
      "Claimant's full name and Teudat Zehut (ID)",
      "Proof of the baby's birth (birth certificate or hospital discharge)",
      "Receipts / invoices for the birth-related expenses you're claiming",
      'Bank account details (bank, branch, account number)',
    ],
  },
  {
    key: 'arnona_discount',
    label: 'Arnona discount filing',
    hint: 'We prepare and file your Arnona (municipal tax) discount request with the city.',
    price: PRICE_PER,
    items: [
      'Full name and Teudat Zehut (ID) of the lease holder',
      'Full property address (city, street, number, apartment)',
      'A clear photo of your most recent Arnona bill',
      'Eligibility proof (student ID, pensioner card, income statement, etc.)',
      'Bank account details for any refund',
    ],
  },
  {
    key: 'name_change',
    label: 'Apartment name change',
    hint: 'Officially change the name on record for electricity, water, and Arnona.',
    price: PRICE_PER,
    items: [
      'Full name and Teudat Zehut of the previous lease holder',
      'Full name and Teudat Zehut of the new lease holder',
      'Full property address',
      'A photo of the signed lease agreement',
      'Account numbers for electricity, water, and Arnona (if known)',
    ],
  },
  {
    key: 'bituach_leumi_registration',
    label: 'Bituach Leumi registration',
    hint: 'New-resident registration with Bituach Leumi (the National Insurance Institute) — required to access any benefit.',
    price: PRICE_PER,
    items: [
      'Full name and Teudat Zehut (ID) — or passport number if not yet issued',
      'Date of arrival in Israel and visa / immigration status',
      'Current address in Israel',
      "Marital status (and spouse's full name + Teudat Zehut if married)",
      "Children's full names and dates of birth (if applicable)",
      'Employment / income status (employed, self-employed, student, etc.)',
      'Bank account details (bank, branch, account number)',
    ],
  },
];

export const SERVICE_BY_KEY = Object.fromEntries(DOC_SERVICES.map(s => [s.key, s]));

/** Save $50 for every completed pair: total = n*150 - floor(n/2)*50 */
export function computeTotal(selectedKeys) {
  const n = selectedKeys.length;
  return n * PRICE_PER - Math.floor(n / 2) * PAIR_DISCOUNT;
}

export function computeSavings(selectedKeys) {
  return Math.floor(selectedKeys.length / 2) * PAIR_DISCOUNT;
}
