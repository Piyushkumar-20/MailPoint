export type CalendarEventTime =
  | {
      type: "timed";
      dateTime: string;
      timeZone?: string;
    }
  | {
      type: "allDay";
      date: string;
    };

export type CalendarAttendee = {
  email?: string;
  displayName?: string;
  responseStatus?: string;
  organizer?: boolean;
  self?: boolean;
};

export type CalendarPerson = {
  email?: string;
  displayName?: string;
  self?: boolean;
};

export type CalendarConferenceData = {
  entryPoints?: Array<{
    entryPointType?: string;
    uri?: string;
    label?: string;
  }>;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  description: string;
  location: string;
  status: string;
  start: CalendarEventTime;
  end: CalendarEventTime;
  attendees: CalendarAttendee[];
  htmlLink: string;
  colorId?: string;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: CalendarEventTime;
  organizer?: CalendarPerson;
  creator?: CalendarPerson;
  visibility?: string;
  transparency?: string;
  conferenceData?: CalendarConferenceData;
  createdAt?: string | null;
  updatedAt?: string | null;
  timestamp: number;
};

export type CalendarRange = {
  start: string;
  end: string;
  timeZone: string;
};

export type CalendarView = "month" | "week" | "day" | "agenda";
