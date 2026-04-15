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
        supabase
          .from("analytics_events" as any)
          .insert({
            event_type: eventType,
            product_id: productId ?? null,
            product_name: productName ?? null,
            product_category: productCategory ?? null,
            seller_id: sellerId ?? null,
            session_id: sessionId,
            user_id: data?.user?.id ?? null,
            metadata: metadata ?? {},
          })
          .then(() => {});
      });
    },
    []
  );

  return { trackEvent };
}

// Standalone version for use outside React components (e.g. stores)
export function trackAnalyticsEvent(params: TrackEventParams) {
  const sessionId = getSessionId();

  supabase.auth.getUser().then(({ data }) => {
    supabase
      .from("analytics_events" as any)
      .insert({
        event_type: params.eventType,
        product_id: params.productId ?? null,
        product_name: params.productName ?? null,
        product_category: params.productCategory ?? null,
        seller_id: params.sellerId ?? null,
        session_id: sessionId,
        user_id: data?.user?.id ?? null,
        metadata: params.metadata ?? {},
      })
      .then(() => {});
  });
}
