import { z } from "zod";

import type {
  CalendarAttendee,
  CalendarConferenceData,
  CalendarEvent,
  CalendarEventTime,
  CalendarPerson,
} from "@/types/calendar";
import { getTenant } from "@/server/lib/tenant";
import {
  calculateAvailability,
  type AvailabilityResult,
} from "@/server/lib/calendar-availability";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

const calendarRangeBaseSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  timeZone: z.string().min(1),
  query: z.string().optional(),
});

const calendarRangeSchema = calendarRangeBaseSchema
  .refine(({ start, end }) => new Date(start) < new Date(end), {
    message: "Calendar range end must be after the start.",
    path: ["end"],
  })
  .refine(({ timeZone }) => isValidTimeZone(timeZone), {
    message: "Calendar timezone must be a valid IANA timezone.",
    path: ["timeZone"],
  });

const calendarRefreshRangeSchema = calendarRangeBaseSchema.omit({
  query: true,
});

const availabilityInputSchema = z.object({
  timeMin: z.string().datetime(),
  timeMax: z.string().datetime(),
  timeZone: z.string().optional(),
  durationMinutes: z.number().int().min(1).max(1440),
  calendarIds: z.array(z.string().min(1)).min(1),
});

type RawCalendarEvent = {
  entity_id: string;
  updated_at: Date;
  data: {
    summary?: string;
    description?: string;
    location?: string;
    status?: string;
    start?: { date?: string; dateTime?: string; timeZone?: string };
    end?: { date?: string; dateTime?: string; timeZone?: string };
    attendees?: Array<{
      email?: string;
      displayName?: string;
      responseStatus?: string;
      organizer?: boolean;
      self?: boolean;
    }>;
    htmlLink?: string;
    colorId?: string;
    recurrence?: string[];
    recurringEventId?: string;
    originalStartTime?: {
      date?: string;
      dateTime?: string;
      timeZone?: string;
    };
    organizer?: { email?: string; displayName?: string; self?: boolean };
    creator?: { email?: string; displayName?: string; self?: boolean };
    visibility?: string;
    transparency?: string;
    conferenceData?: {
      entryPoints?: Array<{
        entryPointType?: string;
        uri?: string;
        label?: string;
      }>;
    };
    createdAt?: string | Date | null;
    created?: string;
    updated?: string;
  };
};

const CACHE_PAGE_SIZE = 100;

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function mapEventTime(
  value?: { date?: string; dateTime?: string; timeZone?: string },
): CalendarEventTime | null {
  if (value?.dateTime) {
    return {
      type: "timed",
      dateTime: value.dateTime,
      ...(value.timeZone ? { timeZone: value.timeZone } : {}),
    };
  }

  if (value?.date) {
    return {
      type: "allDay",
      date: value.date,
    };
  }

  return null;
}

function mapPerson(
  value?: { email?: string; displayName?: string; self?: boolean },
): CalendarPerson | undefined {
  if (!value) return undefined;

  return {
    ...(value.email ? { email: value.email } : {}),
    ...(value.displayName ? { displayName: value.displayName } : {}),
    ...(value.self !== undefined ? { self: value.self } : {}),
  };
}

function mapCreatedAt(value?: string | Date | null): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function eventStartTimestamp(event: RawCalendarEvent): number {
  const start = event.data.start?.dateTime ?? event.data.start?.date;
  return start ? toTimestamp(start) : 0;
}

function mapEvent(event: RawCalendarEvent): CalendarEvent | null {
  const start = mapEventTime(event.data.start);
  const end = mapEventTime(event.data.end);

  if (!start || !end) {
    return null;
  }

  const attendees: CalendarAttendee[] =
    event.data.attendees?.map((attendee) => ({
      ...(attendee.email ? { email: attendee.email } : {}),
      ...(attendee.displayName ? { displayName: attendee.displayName } : {}),
      ...(attendee.responseStatus
        ? { responseStatus: attendee.responseStatus }
        : {}),
      ...(attendee.organizer !== undefined
        ? { organizer: attendee.organizer }
        : {}),
      ...(attendee.self !== undefined ? { self: attendee.self } : {}),
    })) ?? [];

  const conferenceData: CalendarConferenceData | undefined =
    event.data.conferenceData?.entryPoints
      ? {
          entryPoints: event.data.conferenceData.entryPoints.map((entry) => ({
            ...(entry.entryPointType
              ? { entryPointType: entry.entryPointType }
              : {}),
            ...(entry.uri ? { uri: entry.uri } : {}),
            ...(entry.label ? { label: entry.label } : {}),
          })),
        }
      : undefined;

  const createdAt = mapCreatedAt(event.data.createdAt ?? event.data.created);
  const updatedAt = event.data.updated ?? event.updated_at.toISOString();

  return {
    id: event.entity_id,
    summary: event.data.summary ?? "",
    description: event.data.description ?? "",
    location: event.data.location ?? "",
    status: event.data.status ?? "",
    start,
    end,
    attendees,
    htmlLink: event.data.htmlLink ?? "",
    ...(event.data.colorId ? { colorId: event.data.colorId } : {}),
    ...(event.data.recurrence ? { recurrence: event.data.recurrence } : {}),
    ...(event.data.recurringEventId
      ? { recurringEventId: event.data.recurringEventId }
      : {}),
    ...(event.data.originalStartTime
      ? { originalStartTime: mapEventTime(event.data.originalStartTime) ?? undefined }
      : {}),
    ...(event.data.organizer
      ? { organizer: mapPerson(event.data.organizer) }
      : {}),
    ...(event.data.creator ? { creator: mapPerson(event.data.creator) } : {}),
    ...(event.data.visibility
      ? { visibility: event.data.visibility }
      : {}),
    ...(event.data.transparency
      ? { transparency: event.data.transparency }
      : {}),
    ...(conferenceData ? { conferenceData } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    timestamp: eventStartTimestamp(event),
  };
}

function dedupeByEntityId<T extends { entity_id: string; updated_at: Date }>(
  items: T[],
): T[] {
  const byEntityId = new Map<string, T>();

  for (const item of items) {
    const existing = byEntityId.get(item.entity_id);

    if (!existing || item.updated_at > existing.updated_at) {
      byEntityId.set(item.entity_id, item);
    }
  }

  return Array.from(byEntityId.values());
}

function calendarDateInTimeZone(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function eventIntersectsRange(
  event: CalendarEvent,
  start: Date,
  end: Date,
  timeZone: string,
): boolean {
  if (event.start.type === "allDay" || event.end.type === "allDay") {
    const rangeStartDate = calendarDateInTimeZone(start, timeZone);
    const rangeEndDate = calendarDateInTimeZone(
      new Date(end.getTime() - 1),
      timeZone,
    );

    const eventStartDate =
      event.start.type === "allDay"
        ? event.start.date
        : calendarDateInTimeZone(new Date(event.start.dateTime), timeZone);
    const eventEndExclusiveDate =
      event.end.type === "allDay"
        ? event.end.date
        : calendarDateInTimeZone(new Date(event.end.dateTime), timeZone);

    return eventStartDate <= rangeEndDate && eventEndExclusiveDate > rangeStartDate;
  }

  const eventStart = new Date(event.start.dateTime).getTime();
  const eventEnd = new Date(event.end.dateTime).getTime();

  if (Number.isNaN(eventStart) || Number.isNaN(eventEnd)) return false;

  return eventStart < end.getTime() && eventEnd > start.getTime();
}

function sortCalendarEvents(a: CalendarEvent, b: CalendarEvent): number {
  const aStart =
    a.start.type === "allDay" ? toTimestamp(`${a.start.date}T00:00:00Z`) : toTimestamp(a.start.dateTime);
  const bStart =
    b.start.type === "allDay" ? toTimestamp(`${b.start.date}T00:00:00Z`) : toTimestamp(b.start.dateTime);

  if (a.start.type !== b.start.type) {
    return a.start.type === "allDay" ? -1 : 1;
  }

  if (aStart !== bStart) return aStart - bStart;

  return a.id.localeCompare(b.id);
}

async function listAllCachedEvents(
  tenant: Awaited<ReturnType<typeof getTenant>>,
  query?: string,
): Promise<RawCalendarEvent[]> {
  const events: RawCalendarEvent[] = [];
  let offset = 0;
  let previousFirstEntityId: string | undefined;

  while (true) {
    const page = query?.trim()
      ? await tenant.googlecalendar.db.events.search({
          data: {
            summary: { contains: query.trim() },
          },
          limit: CACHE_PAGE_SIZE,
          offset,
        })
      : await tenant.googlecalendar.db.events.list({
          limit: CACHE_PAGE_SIZE,
          offset,
        });

    const typedPage = page as RawCalendarEvent[];

    if (typedPage.length === 0) break;

    const firstEntityId = typedPage[0]?.entity_id;
    if (firstEntityId && firstEntityId === previousFirstEntityId) {
      break;
    }

    events.push(...typedPage);
    previousFirstEntityId = firstEntityId;

    if (typedPage.length < CACHE_PAGE_SIZE) break;

    offset += CACHE_PAGE_SIZE;
  }

  return events;
}

function filterAndSortCalendarEvents(
  events: RawCalendarEvent[],
  range: { start: Date; end: Date; timeZone: string },
): CalendarEvent[] {
  return dedupeByEntityId(events)
    .map(mapEvent)
    .filter((event): event is CalendarEvent => event !== null)
    .filter((event) =>
      eventIntersectsRange(event, range.start, range.end, range.timeZone),
    )
    .sort(sortCalendarEvents);
}

function mapLegacyEvent(event: CalendarEvent) {
  const start =
    event.start.type === "timed" ? event.start.dateTime : event.start.date;
  const end = event.end.type === "timed" ? event.end.dateTime : event.end.date;

  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    status: event.status,
    start,
    end,
    attendees: event.attendees
      .map((attendee) => {
        if (attendee.displayName && attendee.email) {
          return `${attendee.displayName} <${attendee.email}>`;
        }

        return attendee.email ?? attendee.displayName ?? "";
      })
      .filter(Boolean),
    htmlLink: event.htmlLink,
    createdAt: event.createdAt ? new Date(event.createdAt) : null,
    timestamp: event.timestamp,
  };
}

function filterLegacyEventsByWeek(
  events: RawCalendarEvent[],
  weekStart: Date,
  weekEnd: Date,
): ReturnType<typeof mapLegacyEvent>[] {
  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();

  return dedupeByEntityId(events)
    .map(mapEvent)
    .filter((event): event is CalendarEvent => event !== null)
    .map(mapLegacyEvent)
    .filter((event) => {
      const timestamp = Date.parse(event.start);
      return (
        !Number.isNaN(timestamp) &&
        timestamp >= startMs &&
        timestamp < endMs
      );
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

export const calendarRouter = createTRPCRouter({
  getEvents: protectedProcedure
    .input(calendarRangeSchema)
    .query(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);
      const start = new Date(input.start);
      const end = new Date(input.end);
      const cachedEvents = await listAllCachedEvents(tenant, input.query);

      return filterAndSortCalendarEvents(cachedEvents, {
        start,
        end,
        timeZone: input.timeZone,
      });
    }),

  searchEvents: protectedProcedure
    .input(
      paginationSchema.extend({
        query: z.string(),
        weekStart: z.string().datetime(),
        weekEnd: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const weekStart = new Date(input.weekStart);
      const weekEnd = new Date(input.weekEnd);

      const events = await listAllCachedEvents(tenant, input.query);

      return filterLegacyEventsByWeek(events, weekStart, weekEnd);
    }),

  refreshEventsRange: protectedProcedure
    .input(calendarRefreshRangeSchema)
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const result = await tenant.googlecalendar.api.events.getMany({
        calendarId: "primary",
        timeMin: input.start,
        timeMax: input.end,
        timeZone: input.timeZone,
        maxResults: 2500,
        singleEvents: true,
        orderBy: "startTime",
      });

      return {
        synced: result.items?.length ?? 0,
      };
    }),

  refreshEvents: protectedProcedure
    .input(
      z.object({
        weekStart: z.string().datetime(),
        weekEnd: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const result = await tenant.googlecalendar.api.events.getMany({
        calendarId: "primary",
        timeMin: input.weekStart,
        timeMax: input.weekEnd,
        maxResults: 100,
        singleEvents: true,
        orderBy: "startTime",
      });

      return {
        synced: result.items?.length ?? 0,
      };
    }),

  getAvailability: protectedProcedure
    .input(availabilityInputSchema)
    .query(async ({ ctx, input }): Promise<AvailabilityResult> => {
      const tenant = await getTenant(ctx.session.user.id);

      const response =
        await tenant.googlecalendar.api.calendar.getAvailability({
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          timeZone: input.timeZone,
          items: input.calendarIds.map((id) => ({
            id,
          })),
        });

      return calculateAvailability({
        response,
        calendarIds: input.calendarIds,
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        durationMinutes: input.durationMinutes,
      });
    }),

  createDraft: protectedProcedure
    .input(
      z.object({
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().datetime(),
        end: z.string().datetime(),
        attendees: z.array(z.string().email()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const event = await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        sendUpdates: "none",
        event: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          status: "tentative",
          start: {
            dateTime: input.start,
          },
          end: {
            dateTime: input.end,
          },
          attendees: input.attendees?.map((email) => ({
            email,
          })),
        },
      });

      return {
        id: event.id ?? "",
        htmlLink: event.htmlLink ?? "",
      };
    }),

  sendInvite: protectedProcedure
    .input(
      z.object({
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().datetime(),
        end: z.string().datetime(),
        attendees: z.array(z.string().email()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const event = await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        sendUpdates: "all",
        event: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: {
            dateTime: input.start,
          },
          end: {
            dateTime: input.end,
          },
          attendees: input.attendees.map((email) => ({
            email,
          })),
        },
      });

      return {
        id: event.id ?? "",
        htmlLink: event.htmlLink ?? "",
      };
    }),

  updateEvent: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().datetime(),
        end: z.string().datetime(),
        attendees: z.array(z.string().email()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const event = await tenant.googlecalendar.api.events.update({
        calendarId: "primary",
        id: input.id,
        sendUpdates: "all",
        event: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: {
            dateTime: input.start,
          },
          end: {
            dateTime: input.end,
          },
          attendees: input.attendees?.map((email) => ({
            email,
          })),
        },
      });

      return {
        id: event.id ?? input.id,
        htmlLink: event.htmlLink ?? "",
      };
    }),

  deleteEvent: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      await tenant.googlecalendar.api.events.delete({
        calendarId: "primary",
        id: input.id,
        sendUpdates: "all",
      });

      return {
        id: input.id,
      };
    }),
});