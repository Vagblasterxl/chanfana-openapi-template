/**
 * Generic Google API HTTP client for Cloudflare Workers.
 * Handles authentication and request forwarding to any Google API.
 */

import { getAccessToken, GOOGLE_SCOPES } from "./auth";

export interface GoogleApiOptions {
  method?: string;
  path: string;
  baseUrl?: string;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface GoogleApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export async function googleApi<T = unknown>(
  serviceAccountJson: string,
  options: GoogleApiOptions,
): Promise<GoogleApiResponse<T>> {
  const token = await getAccessToken(serviceAccountJson, GOOGLE_SCOPES);

  const baseUrl = options.baseUrl || "https://www.googleapis.com";
  const url = new URL(options.path, baseUrl);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const init: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    init.body =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), init);
  const data: T = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

// Convenience helpers for each Google service
export const sheets = {
  baseUrl: "https://sheets.googleapis.com",

  get(saJson: string, spreadsheetId: string, range?: string) {
    const path = range
      ? `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
      : `/v4/spreadsheets/${spreadsheetId}`;
    return googleApi(saJson, { path, baseUrl: this.baseUrl });
  },

  update(
    saJson: string,
    spreadsheetId: string,
    range: string,
    values: unknown[][],
  ) {
    return googleApi(saJson, {
      method: "PUT",
      path: `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      baseUrl: this.baseUrl,
      query: { valueInputOption: "USER_ENTERED" },
      body: { range, values },
    });
  },

  append(
    saJson: string,
    spreadsheetId: string,
    range: string,
    values: unknown[][],
  ) {
    return googleApi(saJson, {
      method: "POST",
      path: `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append`,
      baseUrl: this.baseUrl,
      query: { valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS" },
      body: { range, values },
    });
  },

  create(saJson: string, title: string) {
    return googleApi(saJson, {
      method: "POST",
      path: "/v4/spreadsheets",
      baseUrl: this.baseUrl,
      body: { properties: { title } },
    });
  },
};

export const drive = {
  baseUrl: "https://www.googleapis.com",

  list(saJson: string, query?: Record<string, string>) {
    return googleApi(saJson, {
      path: "/drive/v3/files",
      query: { fields: "files(id,name,mimeType,modifiedTime,size)", ...query },
    });
  },

  get(saJson: string, fileId: string) {
    return googleApi(saJson, {
      path: `/drive/v3/files/${fileId}`,
      query: { fields: "id,name,mimeType,modifiedTime,size,webViewLink,webContentLink" },
    });
  },

  delete(saJson: string, fileId: string) {
    return googleApi(saJson, {
      method: "DELETE",
      path: `/drive/v3/files/${fileId}`,
    });
  },
};

export const calendar = {
  baseUrl: "https://www.googleapis.com",

  listEvents(
    saJson: string,
    calendarId: string = "primary",
    query?: Record<string, string>,
  ) {
    return googleApi(saJson, {
      path: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      query,
    });
  },

  getEvent(saJson: string, calendarId: string, eventId: string) {
    return googleApi(saJson, {
      path: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    });
  },

  createEvent(saJson: string, calendarId: string, event: unknown) {
    return googleApi(saJson, {
      method: "POST",
      path: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      body: event,
    });
  },

  deleteEvent(saJson: string, calendarId: string, eventId: string) {
    return googleApi(saJson, {
      method: "DELETE",
      path: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    });
  },
};

export const gmail = {
  baseUrl: "https://gmail.googleapis.com",

  listMessages(saJson: string, query?: Record<string, string>) {
    return googleApi(saJson, {
      path: "/gmail/v1/users/me/messages",
      baseUrl: this.baseUrl,
      query,
    });
  },

  getMessage(saJson: string, messageId: string, format: string = "full") {
    return googleApi(saJson, {
      path: `/gmail/v1/users/me/messages/${messageId}`,
      baseUrl: this.baseUrl,
      query: { format },
    });
  },

  send(saJson: string, raw: string) {
    return googleApi(saJson, {
      method: "POST",
      path: "/gmail/v1/users/me/messages/send",
      baseUrl: this.baseUrl,
      body: { raw },
    });
  },
};
