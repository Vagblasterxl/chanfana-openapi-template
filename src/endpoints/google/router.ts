import { Hono } from "hono";
import { fromHono } from "chanfana";

import { SheetsGet, SheetsUpdate, SheetsAppend, SheetsCreate } from "./sheets";
import { DriveList, DriveGet, DriveDelete } from "./drive";
import {
  CalendarListEvents,
  CalendarGetEvent,
  CalendarCreateEvent,
  CalendarDeleteEvent,
} from "./calendar";
import {
  GmailListMessages,
  GmailGetMessage,
  GmailSendMessage,
} from "./gmail";

export const googleRouter = fromHono(new Hono());

// --- Google Sheets ---
googleRouter.post("/sheets", SheetsCreate);
googleRouter.get("/sheets/:spreadsheetId", SheetsGet);
googleRouter.put("/sheets/:spreadsheetId", SheetsUpdate);
googleRouter.post("/sheets/:spreadsheetId/append", SheetsAppend);

// --- Google Drive ---
googleRouter.get("/drive", DriveList);
googleRouter.get("/drive/:fileId", DriveGet);
googleRouter.delete("/drive/:fileId", DriveDelete);

// --- Google Calendar ---
googleRouter.get("/calendar/:calendarId/events", CalendarListEvents);
googleRouter.get("/calendar/:calendarId/events/:eventId", CalendarGetEvent);
googleRouter.post("/calendar/:calendarId/events", CalendarCreateEvent);
googleRouter.delete(
  "/calendar/:calendarId/events/:eventId",
  CalendarDeleteEvent,
);

// --- Google Gmail ---
googleRouter.get("/gmail/messages", GmailListMessages);
googleRouter.get("/gmail/messages/:messageId", GmailGetMessage);
googleRouter.post("/gmail/messages/send", GmailSendMessage);
