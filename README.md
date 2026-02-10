# Workday to Google Calendar (Courses to ICS)

Convert a Workday class schedule export into recurring Google Calendar events. Upload an XLSX export, preview parsed meetings, and create events directly in a selected Google Calendar.

## What this app does

- Parses a Workday schedule XLSX and extracts meeting patterns, dates, and locations.
- Creates weekly recurring events with an RRULE between course start and end dates.
- Skips academic break days using a built-in days-off list.
- Lets you sign in with Google and insert events into a calendar.

## Tech stack

- React + Vite
- Tailwind CSS
- ExcelJS (XLSX parsing)
- ics (recurrence formatting)
- Google Calendar API (via gapi + GIS)

## Getting started

1. Install dependencies

	```bash
	npm install
	```

2. Create a local environment file

	```bash
	cp .env.example .env
	```

3. Add your Google OAuth credentials to `.env`

	```bash
	VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
	VITE_GOOGLE_API_KEY=your_api_key
	VITE_GOOGLE_CLIENT_SECRET=your_client_secret
	```

4. Run the dev server

	```bash
	npm run dev
	```

## Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint

## Google API setup

You must create an OAuth 2.0 Web Client in Google Cloud Console.

- Enable the Google Calendar API for your project.
- Create OAuth credentials (Web client).
- Add an Authorized JavaScript origin for your local dev server (for example `http://localhost:5173`).
- Add an Authorized redirect URI (not used directly by GIS in this app, but required by the console).
- Put your `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` in `.env`.

The app uses these scopes:

- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

## XLSX format expectations

The parser looks for these column headers (exact matches):

- `Course Listing`
- `Section`
- `Meeting Patterns`
- `Start Date`
- `End Date`

Meeting pattern examples:

- `Mon/Wed | 11:30 AM - 12:50 PM | URBAUER, Room 00222`

Header rows are auto-detected. The app scans the first ~30 rows to find the header row.

## Days off

Academic breaks are encoded in `DAYS_OFF_SPEC` inside [src/App.jsx](src/App.jsx). These are excluded using `EXDATE` entries so classes do not occur during breaks.

## UI flow

1. Sign in with Google.
2. Choose a target calendar or create a new one.
3. Upload your Workday XLSX export.
4. Select a time zone.
5. Click Create in Google Calendar.

## Assets and routes

- Instructional screenshots in [public/imgs](public/imgs).
- Privacy policy at [public/privacy.html](public/privacy.html).
- Terms at [public/terms.html](public/terms.html).

## Deployment

This project is Vite-based and can be deployed to any static hosting platform. If using Vercel, configuration is in [vercel.json](vercel.json).

## Notes

- The app loads Google APIs at runtime and uses the GIS token client flow.
- Events are created as local time with a configured `timeZone` field (default: America/Chicago).
