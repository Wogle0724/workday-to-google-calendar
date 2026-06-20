import assert from "node:assert/strict";
import test from "node:test";
import {
  DAYS_OFF_SPEC,
  FALL_2026_TERM,
  buildRecurringCourseEvent,
  expandDaysOff,
} from "../src/calendarUtils.js";

test("fall 2026 schedule stays within the requested class window", () => {
  const allDaysOff = expandDaysOff(DAYS_OFF_SPEC);

  const event = buildRecurringCourseEvent({
    days: ["MO", "WE"],
    startDate: FALL_2026_TERM.firstDay,
    endDate: FALL_2026_TERM.lastDay,
    startHour: 11,
    startMinute: 30,
    endHour: 12,
    endMinute: 50,
    tz: "America/Chicago",
    daysOff: allDaysOff,
  });

  assert.equal(event.start.dateTime.startsWith("2026-08-24T11:30:00"), true);
  assert.equal(event.end.dateTime.startsWith("2026-08-24T12:50:00"), true);
  assert.equal(event.recurrence[0], "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261207T235959Z");

  const exdateDates = event.recurrence
    .flatMap((line) => [...line.matchAll(/(\d{8})T\d{6}/g)].map((match) => match[1]))
    .map((value) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`);

  for (const date of exdateDates) {
    assert.ok(date >= FALL_2026_TERM.firstDay, `exdate ${date} is before the class start`);
    assert.ok(date <= FALL_2026_TERM.lastDay, `exdate ${date} is after the class end`);
  }

  assert.ok(exdateDates.includes("2026-09-07"));
  assert.ok(exdateDates.includes("2026-10-05"));
  assert.ok(exdateDates.includes("2026-11-25"));
  assert.ok(!exdateDates.includes("2026-11-27"));
});