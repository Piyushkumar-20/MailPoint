export type BusyInterval = {
  start: string;
  end: string;
};

export type AvailabilityCalendar = {
  id: string;
  busy: BusyInterval[];
  accessible: boolean;
  errors: Array<{
    domain?: string;
    reason?: string;
    message?: string;
  }>;
};

export type MeetingSlot = {
  start: string;
  end: string;
};

export type AvailabilityResult = {
  calendars: AvailabilityCalendar[];
  attendeeAvailability: "available" | "partial" | "unknown";
  slots: MeetingSlot[];
  warnings: string[];
};

type FreeBusyCalendar = {
  busy?: Array<{
    start?: string;
    end?: string;
  }>;
  errors?: Array<{
    domain?: string;
    reason?: string;
    message?: string;
  }>;
};

type FreeBusyResponse = {
  calendars?: Record<string, FreeBusyCalendar>;
};

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function normalizeBusyIntervals(
  busy: BusyInterval[],
  windowStart: number,
  windowEnd: number,
): BusyInterval[] {
  const intervals = busy
    .map((interval) => ({
      start: new Date(interval.start).getTime(),
      end: new Date(interval.end).getTime(),
    }))
    .filter(
      (interval) =>
        Number.isFinite(interval.start) &&
        Number.isFinite(interval.end) &&
        interval.start < interval.end,
    )
    .map((interval) => ({
      start: Math.max(interval.start, windowStart),
      end: Math.min(interval.end, windowEnd),
    }))
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];

  for (const interval of intervals) {
    const previous = merged[merged.length - 1];

    if (!previous) {
      merged.push(interval);
      continue;
    }

    if (interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
      continue;
    }

    merged.push(interval);
  }

  return merged.map((interval) => ({
    start: new Date(interval.start).toISOString(),
    end: new Date(interval.end).toISOString(),
  }));
}

function calculateFreeIntervals(
  busy: BusyInterval[],
  windowStart: number,
  windowEnd: number,
): BusyInterval[] {
  const free: BusyInterval[] = [];
  let cursor = windowStart;

  for (const interval of busy) {
    const start = new Date(interval.start).getTime();
    const end = new Date(interval.end).getTime();

    if (start > cursor) {
      free.push({
        start: new Date(cursor).toISOString(),
        end: new Date(start).toISOString(),
      });
    }

    cursor = Math.max(cursor, end);
  }

  if (cursor < windowEnd) {
    free.push({
      start: new Date(cursor).toISOString(),
      end: new Date(windowEnd).toISOString(),
    });
  }

  return free;
}

function intersectFreeIntervals(
  first: BusyInterval[],
  second: BusyInterval[],
): BusyInterval[] {
  const result: BusyInterval[] = [];

  let firstIndex = 0;
  let secondIndex = 0;

  while (firstIndex < first.length && secondIndex < second.length) {
    const firstInterval = first[firstIndex];
    const secondInterval = second[secondIndex];

    if (!firstInterval || !secondInterval) {
      break;
    }

    const firstStart = new Date(firstInterval.start).getTime();
    const firstEnd = new Date(firstInterval.end).getTime();

    const secondStart = new Date(secondInterval.start).getTime();
    const secondEnd = new Date(secondInterval.end).getTime();

    const start = Math.max(firstStart, secondStart);
    const end = Math.min(firstEnd, secondEnd);

    if (start < end) {
      result.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      });
    }

    if (firstEnd < secondEnd) {
      firstIndex += 1;
    } else {
      secondIndex += 1;
    }
  }

  return result;
}

function generateMeetingSlots(
  freeIntervals: BusyInterval[],
  durationMinutes: number,
): MeetingSlot[] {
  const durationMs = durationMinutes * 60 * 1000;

  return freeIntervals.flatMap((interval) => {
    const start = new Date(interval.start).getTime();
    const end = new Date(interval.end).getTime();

    const slots: MeetingSlot[] = [];

    for (let cursor = start; cursor + durationMs <= end; cursor += durationMs) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(cursor + durationMs).toISOString(),
      });
    }

    return slots;
  });
}

function normalizeCalendar(
  id: string,
  calendar: FreeBusyCalendar | undefined,
): AvailabilityCalendar {
  const errors = calendar?.errors ?? [];

  const accessible = errors.length === 0;

  const busy = (calendar?.busy ?? [])
    .filter(
      (interval): interval is { start: string; end: string } =>
        typeof interval.start === "string" &&
        typeof interval.end === "string" &&
        isValidDate(interval.start) &&
        isValidDate(interval.end),
    )
    .map((interval) => ({
      start: interval.start,
      end: interval.end,
    }));

  return {
    id,
    busy,
    accessible,
    errors,
  };
}

export function calculateAvailability({
  response,
  calendarIds,
  timeMin,
  timeMax,
  durationMinutes,
}: {
  response: unknown;
  calendarIds: string[];
  timeMin: string;
  timeMax: string;
  durationMinutes: number;
}): AvailabilityResult {
  if (!isValidDate(timeMin) || !isValidDate(timeMax)) {
    throw new Error("Invalid availability time range.");
  }

  if (new Date(timeMin).getTime() >= new Date(timeMax).getTime()) {
    throw new Error("Availability start time must be before end time.");
  }

  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    durationMinutes > 24 * 60
  ) {
    throw new Error("Meeting duration must be a positive number of minutes.");
  }

  const windowStart = new Date(timeMin).getTime();
  const windowEnd = new Date(timeMax).getTime();

  const freeBusyResponse = response as FreeBusyResponse;

  const responseCalendars = freeBusyResponse.calendars ?? {};

  const calendars = calendarIds.map((id) =>
    normalizeCalendar(id, responseCalendars[id]),
  );

  const primaryCalendar = calendars[0];

  if (!primaryCalendar) {
    throw new Error("A primary calendar is required.");
  }

  const primaryBusy = normalizeBusyIntervals(
    primaryCalendar.busy,
    windowStart,
    windowEnd,
  );

  const primaryFree = calculateFreeIntervals(
    primaryBusy,
    windowStart,
    windowEnd,
  );

  const attendeeCalendars = calendars.slice(1);

  const inaccessibleAttendees = attendeeCalendars.filter(
    (calendar) => !calendar.accessible,
  );

  const warnings: string[] = [];

  if (inaccessibleAttendees.length > 0) {
    const names = inaccessibleAttendees.map((calendar) => calendar.id);

    warnings.push(
      `Couldn't check availability for: ${names.join(", ")}. Showing times based on your calendar.`,
    );

    return {
      calendars,
      attendeeAvailability: "unknown",
      slots: generateMeetingSlots(primaryFree, durationMinutes),
      warnings,
    };
  }

  let commonFree = primaryFree;

  for (const attendee of attendeeCalendars) {
    const attendeeBusy = normalizeBusyIntervals(
      attendee.busy,
      windowStart,
      windowEnd,
    );

    const attendeeFree = calculateFreeIntervals(
      attendeeBusy,
      windowStart,
      windowEnd,
    );

    commonFree = intersectFreeIntervals(commonFree, attendeeFree);
  }

  return {
    calendars,
    attendeeAvailability: "available",
    slots: generateMeetingSlots(commonFree, durationMinutes),
    warnings,
  };
}
