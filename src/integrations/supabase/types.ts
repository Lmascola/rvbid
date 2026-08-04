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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bids: {
        Row: {
          alias: string
          amount: number
          bidder_id: string | null
          created_at: string
          id: string
          listing_id: string
          source: string
        }
        Insert: {
          alias: string
          amount: number
          bidder_id?: string | null
          created_at?: string
          id?: string
          listing_id: string
          source?: string
        }
        Update: {
          alias?: string
          amount?: number
          bidder_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_addresses: {
        Row: {
          active: boolean
          address: string
          created_at: string
          currency: string
          id: string
          network: string
          qr_url: string | null
        }
        Insert: {
          active?: boolean
          address: string
          created_at?: string
          currency: string
          id?: string
          network?: string
          qr_url?: string | null
        }
        Update: {
          active?: boolean
          address?: string
          created_at?: string
          currency?: string
          id?: string
          network?: string
          qr_url?: string | null
        }
        Relationships: []
      }
      deposit_intents: {
        Row: {
          address: string
          amount: number
          created_at: string
          credited_at: string | null
          currency: string
          detected_amount: number | null
          detected_tx: string | null
          expires_at: string
          id: string
          network: string
          qr_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          address: string
          amount: number
          created_at?: string
          credited_at?: string | null
          currency?: string
          detected_amount?: number | null
          detected_tx?: string | null
          expires_at?: string
          id?: string
          network?: string
          qr_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          address?: string
          amount?: number
          created_at?: string
          credited_at?: string | null
          currency?: string
          detected_amount?: number | null
          detected_tx?: string | null
          expires_at?: string
          id?: string
          network?: string
          qr_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          note: string | null
          status: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          status?: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          status?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          id: string
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          id?: string
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          id?: string
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      legal_pages: {
        Row: {
          content: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          bid_count: number
          bid_visibility: string
          created_at: string
          current_bid: number
          description: string | null
          ends_at: string | null
          id: string
          images: string[]
          length_ft: number | null
          location: string | null
          make: string | null
          mileage: number | null
          model: string | null
          queue_order: number
          report_available: boolean
          report_price: number
          report_url: string | null
          rv_class: string | null
          sleeps: number | null
          sold_at: string | null
          sold_price: number | null
          starting_bid: number
          status: string
          title: string
          updated_at: string
          vin: string
          vin_masked: string | null
          winner_alias: string | null
          winner_id: string | null
          year: number | null
        }
        Insert: {
          bid_count?: number
          bid_visibility?: string
          created_at?: string
          current_bid?: number
          description?: string | null
          ends_at?: string | null
          id?: string
          images?: string[]
          length_ft?: number | null
          location?: string | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          queue_order?: number
          report_available?: boolean
          report_price?: number
          report_url?: string | null
          rv_class?: string | null
          sleeps?: number | null
          sold_at?: string | null
          sold_price?: number | null
          starting_bid?: number
          status?: string
          title: string
          updated_at?: string
          vin?: string
          vin_masked?: string | null
          winner_alias?: string | null
          winner_id?: string | null
          year?: number | null
        }
        Update: {
          bid_count?: number
          bid_visibility?: string
          created_at?: string
          current_bid?: number
          description?: string | null
          ends_at?: string | null
          id?: string
          images?: string[]
          length_ft?: number | null
          location?: string | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          queue_order?: number
          report_available?: boolean
          report_price?: number
          report_url?: string | null
          rv_class?: string | null
          sleeps?: number | null
          sold_at?: string | null
          sold_price?: number | null
          starting_bid?: number
          status?: string
          title?: string
          updated_at?: string
          vin?: string
          vin_masked?: string | null
          winner_alias?: string | null
          winner_id?: string | null
          year?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          listing_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alias: string
          balance: number
          created_at: string
          dob: string | null
          email: string
          first_name: string
          full_name: string
          id: string
          is_anonymous: boolean
          kyc_id_url: string | null
          kyc_selfie_url: string | null
          kyc_status: string
          last_name: string
          locked: number
          phone: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          alias: string
          balance?: number
          created_at?: string
          dob?: string | null
          email?: string
          first_name?: string
          full_name?: string
          id: string
          is_anonymous?: boolean
          kyc_id_url?: string | null
          kyc_selfie_url?: string | null
          kyc_status?: string
          last_name?: string
          locked?: number
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          alias?: string
          balance?: number
          created_at?: string
          dob?: string | null
          email?: string
          first_name?: string
          full_name?: string
          id?: string
          is_anonymous?: boolean
          kyc_id_url?: string | null
          kyc_selfie_url?: string | null
          kyc_status?: string
          last_name?: string
          locked?: number
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      report_orders: {
        Row: {
          amount: number
          created_at: string
          id: string
          listing_id: string
          report_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          listing_id: string
          report_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          listing_id?: string
          report_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          user_id?: string
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
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          currency: string
          destination: string
          id: string
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          destination?: string
          id?: string
          note?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          destination?: string
          id?: string
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_claim_status: { Args: never; Returns: Json }
      admin_delete_bid: { Args: { _bid_id: string }; Returns: Json }
      admin_listings: {
        Args: never
        Returns: {
          bid_count: number
          bid_visibility: string
          created_at: string
          current_bid: number
          description: string | null
          ends_at: string | null
          id: string
          images: string[]
          length_ft: number | null
          location: string | null
          make: string | null
          mileage: number | null
          model: string | null
          queue_order: number
          report_available: boolean
          report_price: number
          report_url: string | null
          rv_class: string | null
          sleeps: number | null
          sold_at: string | null
          sold_price: number | null
          starting_bid: number
          status: string
          title: string
          updated_at: string
          vin: string
          vin_masked: string | null
          winner_alias: string | null
          winner_id: string | null
          year: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_place_bid:
        | {
            Args: { _alias?: string; _amount: number; _listing_id: string }
            Returns: Json
          }
        | {
            Args: {
              _alias?: string
              _amount: number
              _created_at?: string
              _listing_id: string
            }
            Returns: Json
          }
      admin_set_close_time: {
        Args: { _listing_id: string; _sold_at: string }
        Returns: Json
      }
      admin_update_bid: {
        Args: {
          _alias?: string
          _amount?: number
          _bid_id: string
          _created_at?: string
        }
        Returns: Json
      }
      bootstrap_admin: { Args: never; Returns: string }
      claim_admin: { Args: never; Returns: Json }
      close_expired_auctions: { Args: never; Returns: number }
      create_deposit_intent: {
        Args: { _amount: number; _currency: string }
        Returns: {
          address: string
          amount: number
          created_at: string
          credited_at: string | null
          currency: string
          detected_amount: number | null
          detected_tx: string | null
          expires_at: string
          id: string
          network: string
          qr_url: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposit_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_deposit_intent: {
        Args: { _amount: number; _intent_id: string; _tx: string }
        Returns: Json
      }
      gen_alias: { Args: never; Returns: string }
      get_listing_vin: { Args: { _listing_id: string }; Returns: string }
      grant_admin_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      listing_bids: {
        Args: { _listing_id: string }
        Returns: {
          alias: string
          amount: number
          created_at: string
          id: string
          source: string
        }[]
      }
      locked_for_user: { Args: { _user_id: string }; Returns: number }
      my_vehicle_report: { Args: { _listing_id: string }; Returns: Json }
      place_bid: {
        Args: { _amount: number; _listing_id: string }
        Returns: Json
      }
      purchase_vehicle_report: { Args: { _listing_id: string }; Returns: Json }
      recompute_listing_bids: {
        Args: { _listing_id: string }
        Returns: undefined
      }
      sync_locked_for_listing: {
        Args: { _listing_id: string }
        Returns: undefined
      }
      sync_locked_funds: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
