import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO 8601, e.g. "2026-06-20T10:00:00"
  endDateTime: string;
  timeZone?: string;     // IANA name, defaults to "America/St_Lucia"
  calendarId?: string;   // defaults to "primary"
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string; // direct link to the event in Google Calendar
}

export function useCreateCalendarEvent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEvent = async (input: CalendarEventInput): Promise<CalendarEventResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-calendar-event", {
        body: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.startDateTime, timeZone: input.timeZone ?? "America/St_Lucia" },
          end: { dateTime: input.endDateTime, timeZone: input.timeZone ?? "America/St_Lucia" },
          calendarId: input.calendarId,
        },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);

      return { eventId: data.eventId, htmlLink: data.htmlLink };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create calendar event";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createEvent, loading, error };
}
