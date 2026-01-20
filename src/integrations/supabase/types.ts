export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_inventory: {
        Row: {
          id: string
          product_id: string | null
          qty_on_hand: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          qty_on_hand?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          qty_on_hand?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "seller_products"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          meetup_notes: string | null
          phone: string | null
          preferred_location: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          meetup_notes?: string | null
          phone?: string | null
          preferred_location?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          meetup_notes?: string | null
          phone?: string | null
          preferred_location?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by_admin_id: string
          assignment_status: string | null
          commission_amount_calculated: number | null
          commission_type: string | null
          commission_value: number
          id: string
          order_id: string | null
          partner_id: string
          responded_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by_admin_id: string
          assignment_status?: string | null
          commission_amount_calculated?: number | null
          commission_type?: string | null
          commission_value?: number
          id?: string
          order_id?: string | null
          partner_id: string
          responded_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by_admin_id?: string
          assignment_status?: string | null
          commission_amount_calculated?: number | null
          commission_type?: string | null
          commission_value?: number
          id?: string
          order_id?: string | null
          partner_id?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_user_id: string
          created_at: string | null
          event_payload: Json | null
          event_type: string
          id: string
          order_id: string | null
        }
        Insert: {
          actor_user_id: string
          created_at?: string | null
          event_payload?: Json | null
          event_type: string
          id?: string
          order_id?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string | null
          event_payload?: Json | null
          event_type?: string
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_image_url: string | null
          product_name: string
          quantity: number
          seller_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_image_url?: string | null
          product_name: string
          quantity?: number
          seller_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string
          quantity?: number
          seller_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "seller_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          assigned_at: string | null
          assigned_partner_id: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          currency_code: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          id: string
          line_items: Json
          location: string
          no_sale_at: string | null
          note: string | null
          order_number: number
          order_status: string | null
          order_token: string | null
          partner_commission: number | null
          partner_commission_status: string | null
          pickup_time_window: string | null
          preferred_date: string
          settlement_status: string | null
          status: string
          total_price: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          assigned_partner_id?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          customer_name: string
          customer_phone?: string | null
          customer_user_id?: string | null
          id?: string
          line_items: Json
          location: string
          no_sale_at?: string | null
          note?: string | null
          order_number?: number
          order_status?: string | null
          order_token?: string | null
          partner_commission?: number | null
          partner_commission_status?: string | null
          pickup_time_window?: string | null
          preferred_date: string
          settlement_status?: string | null
          status?: string
          total_price: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          assigned_partner_id?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          id?: string
          line_items?: Json
          location?: string
          no_sale_at?: string | null
          note?: string | null
          order_number?: number
          order_status?: string | null
          order_token?: string | null
          partner_commission?: number | null
          partner_commission_status?: string | null
          pickup_time_window?: string | null
          preferred_date?: string
          settlement_status?: string | null
          status?: string
          total_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_cash_ledger: {
        Row: {
          commission_amount: number
          created_at: string | null
          gross_collected: number
          id: string
          ledger_status: string | null
          net_owed_to_admin: number | null
          order_id: string | null
          partner_id: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string | null
          gross_collected?: number
          id?: string
          ledger_status?: string | null
          net_owed_to_admin?: number | null
          order_id?: string | null
          partner_id: string
        }
        Update: {
          commission_amount?: number
          created_at?: string | null
          gross_collected?: number
          id?: string
          ledger_status?: string | null
          net_owed_to_admin?: number | null
          order_id?: string | null
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_cash_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          partner_name: string
          phone: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          partner_name: string
          phone?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          partner_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      partner_settlements: {
        Row: {
          id: string
          partner_id: string
          settled_at: string | null
          settled_by_admin_id: string
          settlement_amount: number
          settlement_note: string | null
        }
        Insert: {
          id?: string
          partner_id: string
          settled_at?: string | null
          settled_by_admin_id: string
          settlement_amount: number
          settlement_note?: string | null
        }
        Update: {
          id?: string
          partner_id?: string
          settled_at?: string | null
          settled_by_admin_id?: string
          settlement_amount?: number
          settlement_note?: string | null
        }
        Relationships: []
      }
      partner_stock: {
        Row: {
          id: string
          last_updated_at: string | null
          partner_id: string
          product_id: string | null
          qty_on_hand: number
          variant_id: string | null
        }
        Insert: {
          id?: string
          last_updated_at?: string | null
          partner_id: string
          product_id?: string | null
          qty_on_hand?: number
          variant_id?: string | null
        }
        Update: {
          id?: string
          last_updated_at?: string | null
          partner_id?: string
          product_id?: string | null
          qty_on_hand?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "seller_products"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_stock_movements: {
        Row: {
          created_at: string | null
          id: string
          movement_type: string
          note: string | null
          partner_id: string
          product_id: string | null
          qty_change: number
          related_order_id: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          movement_type: string
          note?: string | null
          partner_id: string
          product_id?: string | null
          qty_change: number
          related_order_id?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          partner_id?: string
          product_id?: string | null
          qty_change?: number
          related_order_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "seller_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_stock_movements_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          created_at: string
          currency_code: string
          id: string
          price_amount: number
          product_handle: string
          product_id: string
          product_image_url: string | null
          product_title: string
          quantity: number
          seller_user_id: string | null
          sold_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          id?: string
          price_amount: number
          product_handle: string
          product_id: string
          product_image_url?: string | null
          product_title: string
          quantity?: number
          seller_user_id?: string | null
          sold_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          id?: string
          price_amount?: number
          product_handle?: string
          product_id?: string
          product_image_url?: string | null
          product_title?: string
          quantity?: number
          seller_user_id?: string | null
          sold_at?: string
          variant_id?: string
        }
        Relationships: []
      }
      seller_applications: {
        Row: {
          categories: string[] | null
          created_at: string
          id: string
          location: string | null
          name: string
          proof_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          whatsapp: string
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      seller_products: {
        Row: {
          category: string | null
          clicks_count: number
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          location: string | null
          name: string
          price: number
          quantity: number
          seller_id: string
          shopify_product_id: string | null
          status: string
          updated_at: string
          views_count: number
        }
        Insert: {
          category?: string | null
          clicks_count?: number
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          location?: string | null
          name: string
          price: number
          quantity?: number
          seller_id: string
          shopify_product_id?: string | null
          status?: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          category?: string | null
          clicks_count?: number
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          location?: string | null
          name?: string
          price?: number
          quantity?: number
          seller_id?: string
          shopify_product_id?: string | null
          status?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          categories: string[] | null
          created_at: string
          id: string
          instagram_url: string | null
          is_approved: boolean
          is_primary_seller: boolean | null
          location: string | null
          logo_url: string | null
          phone: string | null
          seller_id: string | null
          seller_name: string
          seller_status: string | null
          shop_description: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          categories?: string[] | null
          created_at?: string
          id?: string
          instagram_url?: string | null
          is_approved?: boolean
          is_primary_seller?: boolean | null
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          seller_id?: string | null
          seller_name: string
          seller_status?: string | null
          shop_description?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          categories?: string[] | null
          created_at?: string
          id?: string
          instagram_url?: string | null
          is_approved?: boolean
          is_primary_seller?: boolean | null
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          seller_id?: string | null
          seller_name?: string
          seller_status?: string | null
          shop_description?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verified_sellers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      weekly_best_sellers: {
        Row: {
          currency_code: string | null
          price: number | null
          product_handle: string | null
          product_id: string | null
          product_image_url: string | null
          product_title: string | null
          total_sold: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      format_order_number: { Args: { order_num: number }; Returns: string }
      get_partner_totals: { Args: { p_partner_id?: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_partner: { Args: { _user_id: string }; Returns: boolean }
      rpc_add_partner_stock: {
        Args: {
          p_note?: string
          p_partner_id: string
          p_product_id: string
          p_quantity: number
        }
        Returns: Json
      }
      rpc_admin_add_inventory: {
        Args: { p_product_id: string; p_qty?: number; p_variant_id?: string }
        Returns: Json
      }
      rpc_admin_allocate_stock_to_partner: {
        Args: {
          p_partner_id: string
          p_product_id: string
          p_qty?: number
          p_variant_id?: string
        }
        Returns: Json
      }
      rpc_assign_order: {
        Args: {
          p_commission_type?: string
          p_commission_value?: number
          p_order_id: string
          p_partner_id: string
        }
        Returns: Json
      }
      rpc_mark_completed: {
        Args: { p_gross_collected?: number; p_order_id: string }
        Returns: Json
      }
      rpc_mark_no_sale: {
        Args: { p_note?: string; p_order_id: string }
        Returns: Json
      }
      rpc_partner_respond: {
        Args: {
          p_decline_reason?: string
          p_order_id: string
          p_response: string
        }
        Returns: Json
      }
      rpc_remove_partner_stock: {
        Args: {
          p_movement_type?: string
          p_note?: string
          p_partner_id: string
          p_product_id: string
          p_quantity: number
        }
        Returns: Json
      }
      rpc_settle_partner: {
        Args: { p_partner_id: string; p_settlement_note?: string }
        Returns: Json
      }
      rpc_undo_completed: { Args: { p_order_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "partner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "partner"],
    },
  },
} as const
