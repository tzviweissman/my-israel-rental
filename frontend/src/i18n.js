import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      nav: {
        home: 'Home',
        longTerm: 'Long Term',
        shortTerm: 'Short Term',
        vacation: 'Vacation',
        storage: 'Storage',
        login: 'Login',
        signup: 'Sign Up',
        dashboard: 'Dashboard',
        logout: 'Logout'
      },
      hero: {
        title: 'Find Your Perfect Rental',
        subtitle: 'Browse thousands of properties for long-term, short-term, vacation rentals and storage spaces',
        searchPlaceholder: 'Search by area, city, or address...'
      },
      property: {
        bedrooms: 'Bedrooms',
        bathrooms: 'Bathrooms',
        area: 'Area',
        floor: 'Floor',
        elevator: 'Elevator',
        shabbatElevator: 'Shabbat Elevator',
        porches: 'Porches',
        sukkah: 'Sukkah Compatible',
        sqm: 'Square Meters',
        monthly: 'Monthly',
        nightly: 'Per Night',
        furniture: 'Furniture Package',
        amenities: 'Amenities',
        contact: 'Contact Owner',
        book: 'Book Now',
        viewDetails: 'View Details'
      },
      auth: {
        loginTitle: 'Login to Your Account',
        signupTitle: 'Create an Account',
        email: 'Email',
        password: 'Password',
        name: 'Full Name',
        phone: 'Phone Number',
        role: 'I am a',
        renter: 'Renter',
        owner: 'Owner/Manager',
        submit: 'Submit'
      },
      footer: {
        contact: 'Contact Us',
        phone: 'Phone'
      }
    }
  },
  he: {
    translation: {
      nav: {
        home: 'בית',
        longTerm: 'לטווח ארוך',
        shortTerm: 'לטווח קצר',
        vacation: 'נופש',
        storage: 'אחסון',
        login: 'התחברות',
        signup: 'הרשמה',
        dashboard: 'לוח בקרה',
        logout: 'התנתק'
      },
      hero: {
        title: 'מצא את השכירות המושלמת שלך',
        subtitle: 'עיין באלפי נכסים להשכרה לטווח ארוך, קצר, נופש ואחסון',
        searchPlaceholder: 'חיפוש לפי אזור, עיר או כתובת...'
      },
      property: {
        bedrooms: 'חדרי שינה',
        bathrooms: 'חדרי רחצה',
        area: 'אזור',
        floor: 'קומה',
        elevator: 'מעלית',
        shabbatElevator: 'מעלית שבת',
        porches: 'מרפסות',
        sukkah: 'מתאים לסוכה',
        sqm: 'מ"ר',
        monthly: 'חודשי',
        nightly: 'ללילה',
        furniture: 'חבילת ריהוט',
        amenities: 'שירותים',
        contact: 'צור קשר עם בעלים',
        book: 'הזמן עכשיו',
        viewDetails: 'פרטים נוספים'
      },
      auth: {
        loginTitle: 'התחבר לחשבון שלך',
        signupTitle: 'צור חשבון',
        email: 'אימייל',
        password: 'סיסמה',
        name: 'שם מלא',
        phone: 'מספר טלפון',
        role: 'אני',
        renter: 'שוכר',
        owner: 'בעלים/מנהל',
        submit: 'שלח'
      },
      footer: {
        contact: 'צור קשר',
        phone: 'טלפון'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;