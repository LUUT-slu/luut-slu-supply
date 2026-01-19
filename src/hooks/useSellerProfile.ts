import { useState, useEffect } from "react";
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

export function useSellerProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setLoading(false);
        return;
      }

      setUser(session.user);

      const { data: profileData } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as unknown as SellerProfile);
      }
      
      setLoading(false);
    };

    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          const { data: profileData } = await supabase
            .from("seller_profiles")
            .select("*")
            .eq("user_id", session.user.id)
            .maybeSingle();
          
          if (profileData) {
            setProfile(profileData as unknown as SellerProfile);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    
    const { data: profileData } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (profileData) {
      setProfile(profileData as unknown as SellerProfile);
    }
  };

  return { user, profile, loading, refreshProfile };
}
