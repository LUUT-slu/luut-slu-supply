import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

// Primary admin email that auto-approves as primary seller
export const PRIMARY_ADMIN_EMAIL = "usual.suspect.118@gmail.com";

interface SellerApprovalStatus {
  isLoading: boolean;
  isApproved: boolean;
  isPending: boolean;
  isRejected: boolean;
  isBanned: boolean;
  sellerStatus: string | null;
  isPrimarySeller: boolean;
  isAdmin: boolean;
}

export function useSellerApproval(user: User | null): SellerApprovalStatus {
  const [status, setStatus] = useState<SellerApprovalStatus>({
    isLoading: true,
    isApproved: false,
    isPending: false,
    isRejected: false,
    isBanned: false,
    sellerStatus: null,
    isPrimarySeller: false,
    isAdmin: false,
  });

  useEffect(() => {
    if (!user) {
      setStatus({
        isLoading: false,
        isApproved: false,
        isPending: false,
        isRejected: false,
        isBanned: false,
        sellerStatus: null,
        isPrimarySeller: false,
        isAdmin: false,
      });
      return;
    }

    const checkApprovalStatus = async () => {
      try {
        // Check if user is admin - admins bypass all approval requirements
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        const isAdmin = !!adminRole || user.email === PRIMARY_ADMIN_EMAIL;

        // Admins are automatically approved with full access
        if (isAdmin) {
          setStatus({
            isLoading: false,
            isApproved: true,
            isPending: false,
            isRejected: false,
            isBanned: false,
            sellerStatus: "approved",
            isPrimarySeller: user.email === PRIMARY_ADMIN_EMAIL,
            isAdmin: true,
          });
          return;
        }

        // Check seller profile for non-admins
        const { data: profile } = await supabase
          .from("seller_profiles")
          .select("seller_status, is_approved, is_primary_seller")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          const sellerStatus = profile.seller_status || (profile.is_approved ? "approved" : "pending");
          setStatus({
            isLoading: false,
            isApproved: sellerStatus === "approved",
            isPending: sellerStatus === "pending",
            isRejected: sellerStatus === "rejected",
            isBanned: sellerStatus === "banned",
            sellerStatus,
            isPrimarySeller: profile.is_primary_seller || false,
            isAdmin: false,
          });
          return;
        }

        // Check for pending application
        const { data: application } = await supabase
          .from("seller_applications")
          .select("status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (application) {
          setStatus({
            isLoading: false,
            isApproved: application.status === "approved",
            isPending: application.status === "pending",
            isRejected: application.status === "rejected",
            isBanned: application.status === "banned",
            sellerStatus: application.status,
            isPrimarySeller: false,
            isAdmin: false,
          });
          return;
        }

        // No profile or application
        setStatus({
          isLoading: false,
          isApproved: false,
          isPending: false,
          isRejected: false,
          isBanned: false,
          sellerStatus: null,
          isPrimarySeller: false,
          isAdmin: false,
        });
      } catch (error) {
        console.error("Error checking seller approval:", error);
        setStatus({
          isLoading: false,
          isApproved: false,
          isPending: false,
          isRejected: false,
          isBanned: false,
          sellerStatus: null,
          isPrimarySeller: false,
          isAdmin: false,
        });
      }
    };

    checkApprovalStatus();
  }, [user]);

  return status;
}

export async function ensurePrimarySellerSetup(userId: string, email: string) {
  if (email !== PRIMARY_ADMIN_EMAIL) return;

  try {
    const { data: existingProfile } = await supabase
      .from("seller_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingProfile) {
      // Create primary seller profile for Luut SLU admin
      await supabase.from("seller_profiles").insert({
        user_id: userId,
        seller_name: "Luut SLU",
        seller_id: "LUUT-PRIMARY",
        is_approved: true,
        seller_status: "approved",
        is_primary_seller: true,
        approved_at: new Date().toISOString(),
        approved_by: userId,
      });
    } else {
      // Ensure it's marked as primary
      await supabase
        .from("seller_profiles")
        .update({
          is_primary_seller: true,
          is_approved: true,
          seller_status: "approved",
        })
        .eq("user_id", userId);
    }
  } catch (error) {
    console.error("Error setting up primary seller:", error);
  }
}
