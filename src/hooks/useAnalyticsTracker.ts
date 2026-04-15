import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function getSessionId(): string {
  let sid = sessionStorage.getItem("analytics_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("analytics_session_id", sid);
  }
  return sid;
}

interface TrackEventParams {
  eventType: string;
  productId?: string;
  productName?: string;
  productCategory?: string;
  sellerId?: string;
  metadata?: Record<string, unknown>;
}

export function useAnalyticsTracker() {
  const trackEvent = useCallback(
    ({
      eventType,
      productId,
      productName,
      productCategory,
      sellerId,
      metadata,
    }: TrackEventParams) => {
      const sessionId = getSessionId();

      // Fire-and-forget — intentionally no await
      supabase.auth.getUser().then(({ data }) => {
        const userId = data?.user?.id ?? null;

        // Skip tracking for admin users
        if (userId) {
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .then(({ data: roles }) => {
              const isAdmin = roles?.some((r) => (r.role as string) === "admin");
              if (isAdmin) return; // Don't record admin activity

              insertEvent({ eventType, productId, productName, productCategory, sellerId, sessionId, userId, metadata });
            });
        } else {
          insertEvent({ eventType, productId, productName, productCategory, sellerId, sessionId, userId, metadata });
        }
      });
    },
    []
  );

  return { trackEvent };
}

function insertEvent({
  eventType, productId, productName, productCategory, sellerId, sessionId, userId, metadata,
}: { eventType: string; productId?: string; productName?: string; productCategory?: string; sellerId?: string; sessionId: string; userId: string | null; metadata?: Record<string, unknown> }) {
  supabase
    .from("analytics_events" as any)
    .insert({
      event_type: eventType,
      product_id: productId ?? null,
      product_name: productName ?? null,
      product_category: productCategory ?? null,
      seller_id: sellerId ?? null,
      session_id: sessionId,
      user_id: userId,
      metadata: metadata ?? {},
    })
    .then(() => {});
}

// Standalone version for use outside React components (e.g. stores)
export function trackAnalyticsEvent(params: TrackEventParams) {
  const sessionId = getSessionId();

  supabase.auth.getUser().then(({ data }) => {
    const userId = data?.user?.id ?? null;

    if (userId) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .then(({ data: roles }) => {
          const isAdmin = roles?.some((r) => (r.role as string) === "admin");
          if (isAdmin) return;

          insertEvent({ ...params, sessionId, userId });
        });
    } else {
      insertEvent({ ...params, sessionId, userId });
    }
  });
}
