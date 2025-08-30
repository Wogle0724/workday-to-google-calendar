// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CalendarPlus, FileDown, Upload, LogIn as Login, Calendar as CalendarIcon } from "lucide-react";
import * as ExcelJS from "exceljs/dist/exceljs.min.js";
import { createEvents } from "ics";

/**
 * Courses → ICS (single-file React app)
 * 
 * What it does
 * - Upload your XLSX (same format as your example export)
 * - Parses rows and meeting patterns like: "Mon/Wed | 11:30 AM - 12:50 PM | URBAUER, Room 00222"
 * - Generates an .ics with weekly recurring events between the given start/end dates
 * - (Optional) Sign in with Google and push the events directly to your Google Calendar
 *
 * How to run (locally or in your app):
 * - Make sure the following npm deps are available: react, xlsx, ics
 * - For Google Calendar, add the gapi script to your index.html or let this file load it (we do here)
 * - Create an OAuth 2.0 Web Client in Google Cloud and paste CLIENT_ID below
 */

// Minimal local UI so you don't need shadcn right now
const Card = ({ className="", children }) => (
  <div className={`rounded-2xl shadow border bg-white ${className}`}>{children}</div>
);
const CardHeader = ({ children }) => <div className="border-b px-4 py-3">{children}</div>;
const CardTitle = ({ children, className="" }) => <h2 className={`font-semibold ${className}`}>{children}</h2>;
const CardContent = ({ children, className="" }) => <div className={`px-4 py-4 ${className}`}>{children}</div>;
// Academic calendar (days with no class)
const DAYS_OFF_SPEC = [
  "2025-09-01",                        // Labor Day
  ["2025-10-04", "2025-10-07"],        // Fall break
  ["2025-11-26", "2025-11-30"],        // Thanksgiving break
  ["2025-12-08", "2025-12-10"],        // Reading days
  ["2025-12-11", "2025-12-17"],        // Final exams
];

const Button = ({ children, className="", ...props }) => (
  <button className={`rounded-xl px-4 py-2 border bg-slate-900 text-white disabled:opacity-50 ${className}`} {...props}>
    {children}
  </button>
);

const Input = (props) => (
  <input className="w-full border rounded-lg px-3 py-2" {...props} />
);

// Simple select (no headless UI)
const SimpleSelect = ({ value, onChange, options=[] }) => (
  <select className="w-full border rounded-lg px-3 py-2" value={value} onChange={(e)=>onChange(e.target.value)}>
    {options.map((opt)=> <option key={opt} value={opt}>{opt}</option>)}
  </select>
);


// === EDIT ME: Google OAuth Client ID (Web) ===
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID; // e.g. 1234-abc.apps.googleusercontent.com
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
// Scopes needed to insert events
const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";

// Default timezone for created events
const DEFAULT_TZ = "America/Chicago";

// Column header names expected in the XLSX (exact match; tweak here if your headers differ)
const COLS = {
  course: "Course Listing",
  section: "Section",
  meetingPattern: "Meeting Patterns",
  startDate: "Start Date",
  endDate: "End Date",
};

const CREATE_OPT = "__create__";

// --- Add this in App.jsx (anywhere above the default export) ---
function InstructionsPanel() {
  // Edit this array to change the content/order of steps
  const steps = [
    {
      title: "1)",
      body:
        "From the Workday home page, open the <strong>Menu</strong> in the top-left corner.",
      img: "/imgs/menu.png",
      alt: "Workday menu",
    },
    {
      title: "2)",
      body:
        "In the dropdown, select <strong>Academics Hub</strong>.",
      img: "/imgs/academics_hub.png",
      alt: "Academics Hub option",
    },
    {
      title: "3)",
      body:
        "Within Academics Hub, choose <strong>Current Classes</strong>.",
      img: "/imgs/current_classes.png",
      alt: "Current Classes page",
    },
    {
      title: "4)",
      body:
        "In the top-right corner of the classes grid, click the <strong>Download</strong> button to export your schedule as an XLSX file.",
      img: "/imgs/download.png",
      alt: "Download button",
    },
    {
      title: "5)",
      body:
        "Confirm that your XLSX file contains the correct headers and course details.",
      img: "/imgs/excel.png",
      alt: "XLSX file preview",
    },
    {
      title: "6)",
      body:
        "On the Workday to Google Calendar website, click <strong>Sign in with Google</strong> and log in with your account.",
      img: "/imgs/signin.png",
      alt: "Google sign-in",
    },
    {
      title: "7)",
      body:
        "Choose the Google Calendar you’d like to use, or create a new calendar for your courses.",
      img: "/imgs/calendar.png",
      alt: "Select calendar",
    },
    {
      title: "8)",
      body:
        "Click <strong>Upload</strong> and select the XLSX file you downloaded from Workday.",
      img: "/imgs/choose.png",
      alt: "Upload file",
    },
    {
      title: "9)",
      body:
        "Click <strong>Create in Google Calendar</strong>. Your class schedule will be added automatically to the selected calendar.",
      img: "/imgs/create.png",
      alt: "Create events in calendar",
    },
  ];
  

  const [open, setOpen] = React.useState(true);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Instructions</span>
          <button
            className="text-xs px-2 py-1 border rounded-md"
            onClick={() => setOpen(o => !o)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-6">
          {steps.map((s, i) => (
            <div key={i} className="space-y-3">
              {/* Title + Body side by side */}
              <div className="flex flex-col md:flex-row md:items-center md:gap-4">
                <div className="font-medium">{s.title}</div>
                <p className="text-sm text-slate-600 mt-1 md:mt-0" dangerouslySetInnerHTML={{ __html: s.body }}></p>
              </div>

              {/* Image below, full width */}
              <img
                src={s.img}
                alt={s.alt}
                loading="lazy"
                className="w-full h-64 md:h-90 object-contain rounded-lg border bg-white"
              />
            </div>
          ))}
        </CardContent>

      )}
    </Card>
  );
}

// Util: normalize "URBAUER, Room 00222" → "Urbauer 222"
function normalizeLocation(locationRaw) {
  if (!locationRaw) return "";
  const m = String(locationRaw)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,?\s*Room\s*0{0,2}(\d+)/i, " $1");
  // Capitalize first word nicely (optional)
  return m
    .replace(/^([A-Z])[A-Z]*/i, (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .replace(/\s{2,}/g, " ");
}

function cellToString(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  // ExcelJS may return { text } or { richText: [...] }
  if (typeof v === "object") {
    if ("text" in v && v.text != null) return String(v.text);
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map(rt => rt.text ?? "").join("");
    }
  }
  return String(v);
}

// Util: parse meeting pattern → { days:["MO","WE"], startTime:"11:30 AM", endTime:"12:50 PM", location:"Urbauer 222" }
function parseMeetingPattern(mp) {
  if (!mp) return null;
  const raw = cellToString(mp).replace(/\u00A0/g, " "); // NBSP → space
  const parts = raw.split("|").map(s => s.trim());
  if (parts.length < 3) return null;
  const [daysPartRaw, timesPartRaw, ...locParts] = parts;
  const locationPart = locParts.join(" | ");

  const dayTokens = String(daysPartRaw).split(/[\/,&\s]+/).filter(Boolean);
  const dayMap = { Mon:"MO", Tue:"TU", Wed:"WE", Thu:"TH", Fri:"FR", Sat:"SA", Sun:"SU" };
  const days = dayTokens.map(d => dayMap[d] || d.toUpperCase().slice(0,2));

  const timesPart = timesPartRaw.replace(/\u2013/g, "-").replace(/\u2014/g, "-");
  const tm = timesPart.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i)
         || timesPart.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*(?:to)\s*(\d{1,2}:\d{2}\s*[AP]M)/i);

  let startTime = "", endTime = "";
  if (tm) {
    startTime = tm[1].replace(/\s*(AM|PM)$/i, " $1");
    endTime   = tm[2].replace(/\s*(AM|PM)$/i, " $1");
  }

  const location = normalizeLocation(locationPart);
  return { days, startTime, endTime, location };
}

// Util: convert "11:30 AM" with a date to [hour, minute], 24h
function parseHourMinute(timeStr) {
  const d = new Date(`1970-01-01 ${timeStr}`);
  return [d.getHours(), d.getMinutes()];
}

// Util: date → YYYYMMDD or YYYYMMDDTHHmmssZ for RRULE UNTIL (we'll use date-only in local tz converted to end-of-day UTC)
function toICSDateParts(date, timeStr) {
  // ics lib needs [YYYY, M, D, H, m]
  const dt = new Date(date);
  const [h, m] = timeStr ? parseHourMinute(timeStr) : [0, 0];
  return [dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), h, m];
}

// Build weekly RRULE between start/end using BYDAY
function buildWeeklyRRule(days, endDate) {
  // UNTIL must be in UTC in format YYYYMMDDT000000Z. We'll set UNTIL to 23:59:59 local of endDate, but convert to UTC by just using date part.
  const end = new Date(endDate);
  const y = end.getUTCFullYear();
  const m = String(end.getUTCMonth() + 1).padStart(2, "0");
  const d = String(end.getUTCDate()).padStart(2, "0");
  const until = `${y}${m}${d}T235959Z`;
  return `FREQ=WEEKLY;BYDAY=${days.join(",")};UNTIL=${until}`;
}

function loadGapiScript() {
  return new Promise((resolve, reject) => {
    if (window.gapi) return resolve();
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.onload = () => resolve();
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

let tokenClient;
let accessToken = null;
let gapiReady = false;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(s => s.src === src);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.dataset.loaded = "false";
    s.onload = () => { s.dataset.loaded = "true"; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function waitFor(check, timeoutMs = 8000, intervalMs = 50) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const t = setInterval(() => {
      if (check()) { clearInterval(t); resolve(); }
      else if (performance.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error("Timed out waiting for dependency"));
      }
    }, intervalMs);
  });
}

async function ensureGapiReady() {
  if (gapiReady) return;

  // Load scripts if they aren't already present
  await loadScriptOnce("https://accounts.google.com/gsi/client");
  await loadScriptOnce("https://apis.google.com/js/api.js");

  // Wait for globals to actually exist
  await waitFor(() => window.google && window.google.accounts && window.gapi);

  // Init gapi client (Calendar REST)
  await new Promise((r) => window.gapi.load("client", r));
  await window.gapi.client.init({
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
  });

  // Init GIS token client
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp && resp.access_token) {
        accessToken = resp.access_token;
        window.gapi.client.setToken({ access_token: accessToken });
      }
    },
  });

  gapiReady = true;
  console.log("GAPI ready");
}

async function ensureToken() {
  await ensureGapiReady();
  if (accessToken) return;

  // Wrap GIS token flow in a Promise so we can await it
  await new Promise((resolve, reject) => {
    const original = tokenClient.callback;
    tokenClient.callback = (resp) => {
      // Restore original callback after this request
      tokenClient.callback = original;

      if (resp && resp.access_token) {
        accessToken = resp.access_token;
        window.gapi.client.setToken({ access_token: accessToken });
        resolve();
      } else if (resp && resp.error) {
        reject(resp);
      } else {
        reject(new Error("No access token received"));
      }
    };

    // Use prompt='consent' the first time; subsequent times 'none' avoids re-prompt
    tokenClient.requestAccessToken({ prompt: accessToken ? "none" : "consent", scope: SCOPES });
  });
}

const DOW = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };

function firstOccurrenceOnOrAfter(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);        // local midnight
  const wanted = new Set(days.map(d => DOW[d]));
  for (let i = 0; i < 7; i++) {
    const t = new Date(start);
    t.setDate(start.getDate() + i);
    if (wanted.has(t.getDay())) {
      const pad = n => String(n).padStart(2, "0");
      return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    }
  }
  return isoDate; // fallback
}

function buildDateTimeLocal(isoDateOrDate, hour, minute) {
  let y, m, d;
  if (typeof isoDateOrDate === "string") {
    [y, m, d] = isoDateOrDate.split("-").map(Number);
  } else {
    y = isoDateOrDate.getFullYear();
    m = isoDateOrDate.getMonth() + 1;
    d = isoDateOrDate.getDate();
  }
  const pad = n => String(n).padStart(2, "0");
  // IMPORTANT: no trailing Z — keep it local and supply timeZone separately
  return `${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00`;
}

// Expand ["2025-10-04","2025-10-07"] to each ISO date; pass-through single dates
function expandDaysOff(spec) {
  const out = [];
  const add = (iso) => out.push(iso);
  const iterRange = (a, b) => {
    const s = new Date(a), e = new Date(b);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      add(`${y}-${m}-${dd}`);
    }
  };

  for (const item of spec) {
    if (Array.isArray(item)) iterRange(item[0], item[1]);
    else add(item);
  }
  return out;
}

// Build EXDATE lines for RFC 5545; chunk to keep lines reasonable
function buildExdateLines(isoDates) {
  if (!isoDates || !isoDates.length) return [];
  const vals = isoDates.map((d) => d.replace(/-/g, "")); // YYYYMMDD
  const lines = [];
  const CHUNK = 20; // safe chunk size
  for (let i = 0; i < vals.length; i += CHUNK) {
    lines.push(`EXDATE;VALUE=DATE:${vals.slice(i, i + CHUNK).join(",")}`);
  }
  return lines;
}


function displayDatePlusOne(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d); // local midnight, no UTC shift
  dt.setDate(dt.getDate());      // display-only: add 1 day
  return dt.toLocaleDateString();    // format for UI
}

function FooterBar() {
  return (
    <footer className="fixed bottom-0 inset-x-0 border-t bg-white/95 backdrop-blur py-2">
      <div className="mx-auto max-w-3xl px-4 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <a href="/privacy" className="hover:underline">Privacy</a>
          <span>•</span>
          <a href="/terms" className="hover:underline">Terms</a>
          <span>•</span>
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            title="Revoke this app’s Google access"
          >
            Revoke Google access
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a href="mailto:wyattjamesogle@gmail.com" className="hover:underline">
            Contact
          </a>
          <span className="text-slate-400">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}


function App() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [icsText, setIcsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalId, setSelectedCalId] = useState("primary");
  const [newCalName, setNewCalName] = useState("");
  const allDaysOff = useMemo(() => expandDaysOff(DAYS_OFF_SPEC), []);



  // Handle sign-in state updates
  useEffect(() => {
    const gapiInit = async () => {
      await gapi.load("client:auth2", async () => {
        await gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
          clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
          scope: "https://www.googleapis.com/auth/calendar.events"
        });
        // DO NOT call signIn() here
      });
    };
    gapiInit();
  }, []);
  
  // inside App(), above pushToGoogle
  const ensureTargetCalendarId = async () => {
    // if user chose an existing calendar, just use it
    if (selectedCalId !== CREATE_OPT) return selectedCalId;

    // else they chose "<Create new>"
    const name = (newCalName || "").trim();
    if (!name) {
      alert("Please enter a name for the new calendar.");
      throw new Error("Missing new calendar name");
    }

    await ensureGapiReady(); // uses your existing helper

    // Create the calendar
    const res = await window.gapi.client.calendar.calendars.insert({
      summary: name,
    });
    const newCal = res.result;

    // Refresh the list and select it
    await loadCalendars();
    setSelectedCalId(newCal.id);
    setNewCalName("");

    return newCal.id;
  };


  async function loadCalendars() {
    try {
      await ensureGapiReady();
      const res = await window.gapi.client.calendar.calendarList.list({ minAccessRole: "writer" });
      const items = res.result.items || [];
      setCalendars(items);
  
      // Default selection
      const hasSelected = items.some(c => c.id === selectedCalId);
      if (!hasSelected) {
        const primary = items.find(c => c.primary);
        setSelectedCalId(primary ? primary.id : (items[0]?.id || "primary"));
      }
    } catch (err) {
      console.error("calendarList.list failed:", err);
      alert("Failed to load calendars. Check console for details. If scope consent appeared, accept it and try again.");
      setCalendars([]);
    }
  }
  

  async function createCalendar() {
    const name = newCalName.trim();
    if (!name) {
      alert("Please enter a calendar name.");
      return;
    }
    setBusy(true);
    try {
      await ensureGapiReady();
      // Requires https://www.googleapis.com/auth/calendar scope
      const res = await window.gapi.client.calendar.calendars.insert({
        summary: name
      });
      const newCal = res.result;
      // Add it to the list and select it
      await loadCalendars();
      setSelectedCalId(newCal.id);
      setNewCalName("");
    } catch (e) {
      console.error("Failed to create calendar:", e);
      alert("Failed to create calendar. See console for details.");
    } finally {
      setBusy(false);
    }
  }
  

  function coerceExcelDate(v) {
    // Excel serialized date -> Date
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "number") {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const ms = v * 24 * 60 * 60 * 1000;
      const d = new Date(epoch.getTime() + ms);
      return d.toISOString().slice(0, 10);
    }
    const s = cellToString(v).trim().replace(/\u00A0/g, " "); // normalize NBSP
    // Accept M/D/YY or M/D/YYYY
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let [, mm, dd, yy] = m;
      let yyyy = yy.length === 2 ? (Number(yy) >= 70 ? "19" + yy : "20" + yy) : yy;
      const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      return iso;
    }
    // If it’s already ISO-ish, keep it
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return s; // last resort; UI will show raw if parsing fails
  }
  

  function parseSection(sectionCell, courseCell="") {
    if (!sectionCell) return "";
    const s = String(sectionCell).trim();
  
    // Pattern like: "CSE 3300-11 - Rapid ..."
    let m = s.match(/^[A-Za-z]{2,}\s*\d{3,4}\s*-\s*([A-Za-z0-9]+)\s*-/);
    if (m) return m[1].replace(/^0+/, ""); // strip leading zeros just in case
  
    // If we also have the course listing (e.g., "CSE 3300 - Rapid ..."),
    // match "<course prefix>-<section>"
    if (courseCell) {
      const prefix = String(courseCell).split("-")[0].trim(); // "CSE 3300"
      const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("^" + esc + "\\s*-\\s*([A-Za-z0-9]+)\\b");
      m = s.match(re);
      if (m) return m[1].replace(/^0+/, "");
    }
  
    // Fallback: if the cell is just a code like "11", "011", "A01", etc.
    m = s.match(/\b([A-Za-z]?\d{1,3}[A-Za-z]?)\b/);
    return m ? m[1].replace(/^0+/, "") : "";
  }
  
  
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
  
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = reader.result;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.worksheets[0];
        if (!ws) {
          alert("No worksheet found in the file.");
          return;
        }
    
        // Try row 3 first (your header row), then fall back by scanning the first ~30 rows
        let headerRowIndex = 3;
        let headers = ws.getRow(headerRowIndex).values.slice(1).map(h => String(h || "").trim());

        const hasRequired = (arr) =>
          arr.includes(COLS.course) && arr.includes(COLS.meetingPattern);

        if (!hasRequired(headers)) {
          for (let r = 1; r <= Math.min(30, ws.rowCount); r++) {
            const tryHeaders = ws.getRow(r).values.slice(1).map(h => String(h || "").trim());
            if (hasRequired(tryHeaders)) {
              headers = tryHeaders;
              headerRowIndex = r;
              break;
            }
          }
        }
        console.log("Detected headers at row:", headerRowIndex, headers);

        // Build a fast map header -> column index (1-based for exceljs)
        const hidx = {};
        headers.forEach((h, i) => (hidx[h] = i + 1));

        const need = [COLS.course, COLS.section, COLS.meetingPattern, COLS.startDate, COLS.endDate];
        const missing = need.filter((k) => !(k in hidx));
        if (missing.length) {
          console.warn("Missing expected headers:", missing, "Available headers:", headers);
          alert("Missing expected headers: " + missing.join(", ") + "\nCheck COLS mapping at top of App.jsx.");
          setRows([]);
          return;
        }

        const rowsParsed = [];
        ws.eachRow((row, rowNumber) => {
          // skip all rows up to and including the header row
          if (rowNumber <= headerRowIndex) return;

          const get = (colName) => {
            const c = hidx[colName];
            const cell = row.getCell(c);
            return cell?.value ?? "";
          };

          const course = cellToString(get(COLS.course)).trim();
          const section = parseSection(get(COLS.section), course);
          const meetingPattern = cellToString(get(COLS.meetingPattern)).trim();
          const startDate = coerceExcelDate(get(COLS.startDate));
          const endDate = coerceExcelDate(get(COLS.endDate));   
          console.log("row", { course, section, meetingPattern, startDate, endDate });       

          if (course && meetingPattern && startDate && endDate) {
            rowsParsed.push({ course, section, meetingPattern, startDate, endDate });
          }
        });

        setRows(rowsParsed);

    
        setRows(rowsParsed);
        console.log("Parsed rows:", rowsParsed.length, rowsParsed.slice(0, 3));
      } catch (err) {
        console.error("Failed to parse XLSX:", err);
        alert("Failed to parse the XLSX. See console for details.");
        setRows([]);
      }
    };
    
    reader.readAsArrayBuffer(f);
  }
  

  async function pushToGoogle() {
    if (!rows.length) return;
    setBusy(true);
    try {
      await ensureToken();
      setSignedIn(true);
  
      // Ensure we have a real calendar ID (create if needed)
      const targetCalId = await ensureTargetCalendarId();
  
      // Nice-to-have: show the calendar name later
      const calName =
        calendars.find((c) => c.id === targetCalId)?.summary ||
        (targetCalId === "primary" ? "Primary" : targetCalId);
  
      for (const r of rows) {
        const mp = parseMeetingPattern(r.meetingPattern);
        if (!mp) continue;
        const { days, startTime, endTime, location } = mp;
        const [sh, sm] = parseHourMinute(startTime);
        const [eh, em] = parseHourMinute(endTime);
  
        const firstDate = firstOccurrenceOnOrAfter(r.startDate, days);
  
        const offWithinCourse = allDaysOff.filter(d => d >= r.startDate && d <= r.endDate);
        const exdateLines = buildExdateLines(offWithinCourse);
        
        const event = {
          summary: `${r.course}${r.section ? ` (${r.section})` : ""}`,
          location,
          start: { dateTime: buildDateTimeLocal(firstDate, sh, sm), timeZone: tz },
          end:   { dateTime: buildDateTimeLocal(firstDate, eh, em), timeZone: tz },
          // RRULE + EXDATE(s)
          recurrence: [
            `RRULE:${buildWeeklyRRule(days, r.endDate)}`,
            ...exdateLines,
          ],
        };
  
        await window.gapi.client.calendar.events.insert({
          calendarId: targetCalId || "primary",
          resource: event,
        });
      }
  
      alert(`Events Created.`);
    } catch (e) {
      try {
        const parsed = e && e.body ? JSON.parse(e.body) : null;
        console.error("Insert failed:", parsed?.error || e);
        alert(parsed?.error?.message || "Google Calendar insert failed - Check XLSX Formatting");
      } catch {
        console.error(e);
        alert("Google Calendar insert failed. See console.");
      }
    } finally {
      setBusy(false);
    }
    
  }
  
  
  

  async function signInGoogle() {
    setBusy(true);
    try {
      await ensureToken();
      setSignedIn(true);
      await loadCalendars();
    } catch (e) {
      console.error(e);
      alert("Google sign-in failed. See console.");
    } finally {
      setBusy(false);
    }
  }
  

  return (
    <div className="min-h-screen flex justify-center bg-white">
      <div className="w-full max-w-3xl px-4">
      <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2.5">
        WashU Workday to ICS Converter
      </h1>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl ">
              <CalendarPlus className="h-5 w-5" /> Courses → ICS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sign-in / status row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">

              {!signedIn && (
                <Button
                  type="button"
                  onClick={signInGoogle}
                  disabled={busy}
                  className="flex items-center"
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Login className="mr-2 h-4 w-4" />
                  )}
                  <span>Sign in with Google</span>
                </Button>
              )}

              {signedIn && (
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <div className="text-s text-slate-600">Target Calendar:</div>

                  <select
                    className="border rounded-md px-2 py-1"
                    value={selectedCalId}
                    onChange={(e) => setSelectedCalId(e.target.value)}
                  >
                    {/* Existing calendars */}
                    {(calendars || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.summary} {c.primary ? "(primary)" : ""}
                      </option>
                    ))}

                    {/* Always add the create-new option at the bottom */}
                    <option value={CREATE_OPT}>&lt;Create new&gt;</option>
                  </select>

                  {/* Only show the name input when "create new" is selected */}
                  {selectedCalId === CREATE_OPT && (
                    <input
                      className="border rounded-md px-2 py-1"
                      placeholder="New calendar name"
                      value={newCalName}
                      onChange={(e) => setNewCalName(e.target.value)}
                    />
                  )}
                </div>

              )}
            </div>

            {/* SHOW THESE ONLY WHEN LOGGED IN */}
            {signedIn ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium ">Upload XLSX</label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept=".xlsx,.xls" onChange={onFile} />
                      <Upload className="h-4 w-4 opacity-60" />
                    </div>
                    {fileName && (
                      <p className="text-xs text-slate-600 mt-1">
                        Selected: <span className="font-medium">{fileName}</span> — Parsed{" "}
                        <span className="font-medium">{rows.length}</span> row(s)
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium ">
                      Select your current time zone
                    </label>
                    <SimpleSelect
                      value={tz}
                      onChange={setTz}
                      options={[
                        "America/Los_Angeles",
                        "America/Chicago",
                        "America/New_York",
                        "UTC",
                      ]}
                    />
                  </div>
                </div>

                {/* Create button */}
                <Button
                  type="button"
                  onClick={pushToGoogle}
                  disabled={
                    busy ||
                    !rows.length ||
                    (selectedCalId === CREATE_OPT && !newCalName.trim())
                  }
                  className="flex items-center"
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarIcon className="mr-2 h-4 w-4" />
                  )}
                  <span>Create in Google Calendar</span>
                </Button>

              </>
            ) : (
              <div className="text-sm text-slate-600">
                Please sign in with Google to choose a calendar, upload your XLSX, and set your time zone.
              </div>
            )}

            {/* Parsed table – also only when signed in (optional) */}
            {signedIn && rows.length > 0 && (
              <div className="rounded-lg border bg-white p-3 text-sm overflow-x-auto ">
                <div className="mb-2 font-medium">Parsed {rows.length} row(s)</div>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="[&>th]:border-b [&>th]:px-2 [&>th]:py-2">
                      <th>Course</th>
                      <th>Days</th>
                      <th>Time</th>
                      <th>Room</th>
                      <th>Start</th>
                      <th>End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const mp = parseMeetingPattern(r.meetingPattern) || {};
                      const days = (mp.days || []).join("/");
                      const time =
                        mp.startTime && mp.endTime ? `${mp.startTime}–${mp.endTime}` : "";
                      const room = mp.location || "";
                      return (
                        <tr key={i} className="[&>td]:border-b [&>td]:px-2 [&>td]:py-2">
                          <td>{r.course}{r.section ? ` (${r.section})` : ""}</td>
                          <td>{days}</td>
                          <td>{time}</td>
                          <td>{room}</td>
                          <td>
                            {r.startDate ? displayDatePlusOne(r.startDate) : ""
                              ? (isNaN(new Date(r.startDate).valueOf())
                                  ? r.startDate
                                  : new Date(r.startDate).toLocaleDateString())
                              : ""}
                          </td>
                          <td>
                            {r.endDate ? displayDatePlusOne(r.endDate) : ""
                              ? (isNaN(new Date(r.endDate).valueOf())
                                  ? r.endDate
                                  : new Date(r.endDate).toLocaleDateString())
                              : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </CardContent>

        </Card>
            <InstructionsPanel />
      </div>
      <FooterBar />
    </div>
  );
}


export default App;
