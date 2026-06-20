const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export const FALL_2026_TERM = {
  firstDay: "2026-08-24",
  lastDay: "2026-12-07",
  daysOff: [
    "2026-09-07",
    ["2026-10-03", "2026-10-06"],
    ["2026-11-25", "2026-11-29"],
  ],
};

export const DAYS_OFF_SPEC = [
  "2025-09-01",
  ["2025-10-04", "2025-10-07"],
  ["2025-11-26", "2025-11-30"],
  ["2025-12-08", "2025-12-10"],
  ["2025-12-11", "2025-12-17"],
  ...FALL_2026_TERM.daysOff,
  "2026-01-19",
  ["2026-03-09", "2026-03-13"],
  ["2026-04-27", "2026-04-29"],
  ["2026-04-30", "2026-05-06"],
];

export function firstOccurrenceOnOrAfter(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const wanted = new Set(days.map((day) => DOW[day]));
  for (let i = 0; i < 7; i++) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + i);
    if (wanted.has(candidate.getDay())) {
      const pad = (value) => String(value).padStart(2, "0");
      return `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}`;
    }
  }
  return isoDate;
}

export function buildWeeklyRRule(days, endDate) {
  const end = new Date(endDate);
  const y = end.getUTCFullYear();
  const m = String(end.getUTCMonth() + 1).padStart(2, "0");
  const d = String(end.getUTCDate()).padStart(2, "0");
  const until = `${y}${m}${d}T235959Z`;
  return `FREQ=WEEKLY;BYDAY=${days.join(",")};UNTIL=${until}`;
}

export function expandDaysOff(spec) {
  const out = [];

  const makeLocalDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const toIso = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const iterRangeLocal = (startIso, endIso) => {
    const start = makeLocalDate(startIso);
    const end = makeLocalDate(endIso);
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      out.push(toIso(cur));
    }
  };

  for (const item of spec) {
    if (Array.isArray(item)) iterRangeLocal(item[0], item[1]);
    else out.push(item);
  }

  return out;
}

export function isoMatchesByDay(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return days.includes(Object.entries(DOW).find(([, value]) => value === wd)?.[0]);
}

export function buildExdateDateTimeLines({ isoDates, startHour, startMinute, tz, byDays }) {
  if (!isoDates?.length) return [];
  const candidates = isoDates.filter((date) => isoMatchesByDay(date, byDays));
  if (!candidates.length) return [];

  const stamp = (iso) => {
    const [y, m, d] = iso.split("-");
    const h = String(startHour).padStart(2, "0");
    const mm = String(startMinute).padStart(2, "0");
    return `${y}${m}${d}T${h}${mm}00`;
  };

  const values = candidates.map(stamp);
  const chunkSize = 20;
  const lines = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    lines.push(`EXDATE;TZID=${tz}:${values.slice(i, i + chunkSize).join(",")}`);
  }
  return lines;
}

export function buildRecurringCourseEvent({
  days,
  startDate,
  endDate,
  startHour,
  startMinute,
  endHour,
  endMinute,
  tz,
  daysOff,
}) {
  const firstDate = firstOccurrenceOnOrAfter(startDate, days);
  const offWithinCourse = daysOff.filter((date) => date >= startDate && date <= endDate);
  return {
    start: {
      dateTime: `${firstDate}T${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}:00`,
      timeZone: tz,
    },
    end: {
      dateTime: `${firstDate}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00`,
      timeZone: tz,
    },
    recurrence: [
      `RRULE:${buildWeeklyRRule(days, endDate)}`,
      ...buildExdateDateTimeLines({
        isoDates: offWithinCourse,
        startHour,
        startMinute,
        tz,
        byDays: days,
      }),
    ],
  };
}