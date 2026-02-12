import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { calendar } from "../../google/client";

// GET /google/calendar/:calendarId/events — List calendar events
export class CalendarListEvents extends OpenAPIRoute {
  public schema = {
    tags: ["Google Calendar"],
    summary: "List events from a Google Calendar",
    operationId: "google-calendar-list-events",
    request: {
      params: z.object({
        calendarId: z
          .string()
          .describe("Calendar ID (use 'primary' for the default calendar)"),
      }),
      query: z.object({
        timeMin: z
          .string()
          .optional()
          .describe("Lower bound (RFC3339) for filtering by start time"),
        timeMax: z
          .string()
          .optional()
          .describe("Upper bound (RFC3339) for filtering by start time"),
        maxResults: z
          .string()
          .optional()
          .describe("Maximum number of events to return"),
        singleEvents: z
          .string()
          .optional()
          .describe("Expand recurring events into instances (true/false)"),
        orderBy: z
          .string()
          .optional()
          .describe("Sort order: startTime or updated"),
      }),
    },
    responses: {
      "200": {
        description: "List of calendar events",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const saJson = (c.env as unknown as { GOOGLE_SERVICE_ACCOUNT: string }).GOOGLE_SERVICE_ACCOUNT;
    if (!saJson) {
      return c.json(
        { success: false, error: "GOOGLE_SERVICE_ACCOUNT secret not configured" },
        500,
      );
    }

    const query: Record<string, string> = {};
    if (data.query.timeMin) query.timeMin = data.query.timeMin;
    if (data.query.timeMax) query.timeMax = data.query.timeMax;
    if (data.query.maxResults) query.maxResults = data.query.maxResults;
    if (data.query.singleEvents) query.singleEvents = data.query.singleEvents;
    if (data.query.orderBy) query.orderBy = data.query.orderBy;

    const res = await calendar.listEvents(
      saJson,
      data.params.calendarId,
      Object.keys(query).length ? query : undefined,
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// GET /google/calendar/:calendarId/events/:eventId — Get a single event
export class CalendarGetEvent extends OpenAPIRoute {
  public schema = {
    tags: ["Google Calendar"],
    summary: "Get a single calendar event",
    operationId: "google-calendar-get-event",
    request: {
      params: z.object({
        calendarId: z.string().describe("Calendar ID"),
        eventId: z.string().describe("Event ID"),
      }),
    },
    responses: {
      "200": {
        description: "Calendar event",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const saJson = (c.env as unknown as { GOOGLE_SERVICE_ACCOUNT: string }).GOOGLE_SERVICE_ACCOUNT;
    if (!saJson) {
      return c.json(
        { success: false, error: "GOOGLE_SERVICE_ACCOUNT secret not configured" },
        500,
      );
    }

    const res = await calendar.getEvent(
      saJson,
      data.params.calendarId,
      data.params.eventId,
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// POST /google/calendar/:calendarId/events — Create a new event
export class CalendarCreateEvent extends OpenAPIRoute {
  public schema = {
    tags: ["Google Calendar"],
    summary: "Create a new calendar event",
    operationId: "google-calendar-create-event",
    request: {
      params: z.object({
        calendarId: z.string().describe("Calendar ID"),
      }),
      body: contentJson(
        z.object({
          summary: z.string().describe("Event title"),
          description: z.string().optional().describe("Event description"),
          location: z.string().optional().describe("Event location"),
          start: z
            .object({
              dateTime: z.string().optional().describe("RFC3339 start time"),
              date: z.string().optional().describe("Date for all-day events (YYYY-MM-DD)"),
              timeZone: z.string().optional().describe("IANA time zone"),
            })
            .describe("Start time"),
          end: z
            .object({
              dateTime: z.string().optional().describe("RFC3339 end time"),
              date: z.string().optional().describe("Date for all-day events (YYYY-MM-DD)"),
              timeZone: z.string().optional().describe("IANA time zone"),
            })
            .describe("End time"),
          attendees: z
            .array(z.object({ email: z.string() }))
            .optional()
            .describe("List of attendee emails"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Created event",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const saJson = (c.env as unknown as { GOOGLE_SERVICE_ACCOUNT: string }).GOOGLE_SERVICE_ACCOUNT;
    if (!saJson) {
      return c.json(
        { success: false, error: "GOOGLE_SERVICE_ACCOUNT secret not configured" },
        500,
      );
    }

    const res = await calendar.createEvent(
      saJson,
      data.params.calendarId,
      data.body,
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// DELETE /google/calendar/:calendarId/events/:eventId — Delete an event
export class CalendarDeleteEvent extends OpenAPIRoute {
  public schema = {
    tags: ["Google Calendar"],
    summary: "Delete a calendar event",
    operationId: "google-calendar-delete-event",
    request: {
      params: z.object({
        calendarId: z.string().describe("Calendar ID"),
        eventId: z.string().describe("Event ID"),
      }),
    },
    responses: {
      "200": {
        description: "Deletion result",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const saJson = (c.env as unknown as { GOOGLE_SERVICE_ACCOUNT: string }).GOOGLE_SERVICE_ACCOUNT;
    if (!saJson) {
      return c.json(
        { success: false, error: "GOOGLE_SERVICE_ACCOUNT secret not configured" },
        500,
      );
    }

    const res = await calendar.deleteEvent(
      saJson,
      data.params.calendarId,
      data.params.eventId,
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: { message: "Event deleted" } };
  }
}
