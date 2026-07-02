import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures a customer_profiles row exists for the signed-in user and
 * fills in name/avatar/auth_provider from social-login metadata.
 * Also fires a Shopify sync (non-blocking) for new social signups.
 */
export function useEnsureCustomerProfile() {
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ensure = async (user: { id: string; email?: string | null; user_metadata?: any; app_metadata?: any }) => {
      if (handledRef.current.has(user.id)) return;
      handledRef.current.add(user.id);

      const meta = user.user_metadata ?? {};
      const appMeta = user.app_metadata ?? {};
      const fullName = meta.full_name ?? meta.name ?? null;
      const avatarUrl = meta.avatar_url ?? meta.picture ?? null;
      const provider = appMeta.provider ?? "email";

      const { data: existing } = await supabase
        .from("customer_profiles")
        .select("user_id, full_name, avatar_url, auth_provider, shopify_customer_id, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("customer_profiles").insert({
          user_id: user.id,
          email: user.email ?? null,
          full_name: fullName,
          avatar_url: avatarUrl,
          auth_provider: provider,
          signup_source: provider,
        });
      } else {
        const updates: Record<string, any> = {};
        if (!existing.full_name && fullName) updates.full_name = fullName;
        if (!existing.avatar_url && avatarUrl) updates.avatar_url = avatarUrl;
        if (!existing.auth_provider || existing.auth_provider === "email") {
          if (provider && provider !== "email") updates.auth_provider = provider;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("customer_profiles").update(updates).eq("user_id", user.id);
        }
      }

      // Fire Shopify sync for social signups. Failures are surfaced (not silently swallowed)
      // so they show up in logs; the order-time customer sync in create-draft-order is the
      // authoritative sync and records its own failures on orders.shopify_sync_error.
      if (provider !== "email") {
        supabase.functions
          .invoke("sync-shopify-customer", { body: { user_id: user.id } })
          .then(({ error }) => {
            if (error) console.error("[shopify-sync] signup sync failed:", error);
          })
          .catch((e) => console.error("[shopify-sync] signup sync error:", e));
      }

    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setTimeout(() => ensure(session.user), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) ensure(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);
}
