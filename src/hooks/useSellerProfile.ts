import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export interface SellerProfile {
  id: string;
  user_id: string;
  seller_name: string;
  seller_id: string | null;
  logo_url: string | null;
  shop_description: string | null;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;
  categories: string[] | null;
  instagram_url: string | null;
  is_approved: boolean;
  is_primary_seller: boolean | null;
  seller_status: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

async function tryRepairProfile(user: User): Promise<SellerProfile | null> {
  // If the user has an approved seller_application but no seller_profiles row, create it.
  try {
    const { data: app } = await supabase
      .from("seller_applications")
      .select("name, business_name, location, whatsapp, categories, status")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!app) return null;

    const sellerName =
      (app.business_name && app.business_name.trim()) ||
      (app.name && app.name.trim()) ||
      (user.email ? user.email.split("@")[0] : "Seller");

    const { data: inserted, error: insertError } = await supabase
      .from("seller_profiles")
      .insert({
        user_id: user.id,
        seller_name: sellerName,
        location: app.location ?? null,
        whatsapp: app.whatsapp ?? null,
        categories: app.categories ?? null,
        is_approved: true,
        seller_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      console.error("[useSellerProfile] repair insert failed:", insertError);
      return null;
    }
    return (inserted as unknown as SellerProfile) ?? null;
  } catch (err) {
    console.error("[useSellerProfile] repair error:", err);
    return null;
  }
}

export function useSellerProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const repairAttemptedRef = useRef(false);

  const loadFor = useCallback(async (currentUser: User) => {
    setError(null);
    const { data: profileData, error: profileError } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("[useSellerProfile] load error:", profileError);
      setError(profileError.message);
      setProfile(null);
      return;
    }

    if (profileData) {
      setProfile(profileData as unknown as SellerProfile);
      return;
    }

    // No profile — try one auto-repair from an approved application.
    if (!repairAttemptedRef.current) {
      repairAttemptedRef.current = true;
      const repaired = await tryRepairProfile(currentUser);
      if (repaired) {
        setProfile(repaired);
        return;
      }
    }
    setProfile(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(session.user);
      await loadFor(session.user);
      if (!cancelled) setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          // Defer the supabase call to avoid deadlocks inside the callback
          setTimeout(() => {
            loadFor(session.user).finally(() => setLoading(false));
          }, 0);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadFor]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    repairAttemptedRef.current = false;
    await loadFor(user);
    setLoading(false);
  }, [user, loadFor]);

  return { user, profile, loading, error, refreshProfile };
}
