# MyIsraelRental.com - Product Requirements Document

## Original Problem Statement
Build a bilingual (English/Hebrew) rental website named MyIsraelRental.com with admin dashboard, property listing management (long-term, short-term, vacation, storage), real-time chat, iCal/Airbnb calendar sync, paid service portal (Arnona/name change), rental contract translation & signing, renter notifications, and manager bulk upload features. Black and gold color scheme.

## Core Architecture
- **Frontend**: React + TailwindCSS + Lucide-react icons
- **Backend**: FastAPI + Motor (Async MongoDB)
- **Database**: MongoDB
- **Theme**: Black and Gold (strict)

## What's Been Implemented

### Completed Features
- [x] React + FastAPI + MongoDB boilerplate with JWT auth
- [x] Black and gold UI theme across all components
- [x] Custom MyIsraelRental logo with CSS blend mode in Navigation
- [x] Floating WhatsApp button and Accessibility controls
- [x] Landing page with hero, featured listings, About Us, Footer
- [x] Complex property creation form with:
  - Half-number dropdowns for beds, baths, floors
  - Dual currency (ILS/USD) for rent and agent fees
  - Progressive disclosure (Shabbat elevator, Sukkah, Agent Fee)
  - TAMA (under construction) checkbox
  - 18 selectable amenities
  - **Property Condition dropdown** (Renovated / Partially Renovated / Good Condition)
- [x] Backend Pydantic schemas fully synced with frontend form fields
- [x] Empty string to null conversion for optional numeric fields in form submission

### Backend Schema Fields (PropertyCreate)
title, description, rental_type, property_type, bedrooms (float), bathrooms (float), area, address, square_meters, floor (float), has_elevator, is_shabbat_elevator, is_tama, has_agent_fee, agent_fee_price, agent_fee_currency, porches, sukkah_compatible, condition, furniture_option, amenities[], monthly_price, nightly_price, currency, images[], videos[], ical_url

## Prioritized Backlog

### P0 - High Priority
- [ ] Image/Video upload for property listings
- [ ] Real-time chat between owners and renters
- [ ] Booking calendar with iCal/Airbnb sync

### P1 - Medium Priority
- [ ] PayPal integration for paid services (Arnona/name change)
- [ ] Rental contract upload, translation (Hebrew->English), digital signing
- [ ] Email/SMTP notifications for renter alerts

### P2 - Lower Priority
- [ ] Manager bulk property upload via text
- [ ] Personal manager profile pages
- [ ] English/Hebrew bilingual translation for all strings
- [ ] Dashboard.js refactoring (~640 lines, could split into sub-components)

## 3rd Party Integrations (Not Yet Integrated)
- Claude Sonnet (via Emergent LLM Key) - for translation
- PayPal - for paid services
- Simple SMTP - for email notifications

## Test Credentials
See /app/memory/test_credentials.md
