/**
 * Hand-written to match supabase/schema.sql until the project is linked
 * via the Supabase CLI. Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> --schema public
 */

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Preparing"
  | "Ready"
  | "Completed"
  | "Cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Ready",
  "Completed",
  "Cancelled",
];

export type PaymentStatus = "unpaid" | "paid";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          is_available: boolean;
          preparation_notice: string | null;
          allergens: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          preparation_notice?: string | null;
          allergens?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          label: string;
          price: number;
          image_url: string | null;
          is_available: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          label: string;
          price: number;
          image_url?: string | null;
          is_available?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_variants"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          pickup_date: string;
          pickup_time: string;
          notes: string | null;
          subtotal: number;
          total: number;
          status: OrderStatus;
          payment_status: PaymentStatus;
          stripe_checkout_session_id: string | null;
          notified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          pickup_date: string;
          pickup_time: string;
          notes?: string | null;
          subtotal: number;
          total: number;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          stripe_checkout_session_id?: string | null;
          notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string | null;
          product_id: string | null;
          product_name: string;
          variant_id: string | null;
          variant_label: string | null;
          quantity: number;
          unit_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          product_id?: string | null;
          product_name: string;
          variant_id?: string | null;
          variant_label?: string | null;
          quantity: number;
          unit_price: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
      homepage_photos: {
        Row: {
          id: string;
          section:
            | "hero"
            | "gallery"
            | "story_hero"
            | "story_beat_1"
            | "story_beat_2"
            | "story_beat_3";
          image_url: string;
          alt_text: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          section:
            | "hero"
            | "gallery"
            | "story_hero"
            | "story_beat_1"
            | "story_beat_2"
            | "story_beat_3";
          image_url: string;
          alt_text?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["homepage_photos"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_order_atomic: {
        Args: {
          p_order_row: Json;
          p_items: Json;
          p_max_orders_per_day: number;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      update_product_atomic: {
        Args: {
          p_product_id: string;
          p_product_row: Json;
          p_variants_to_update: Json;
          p_variants_to_insert: Json;
          p_variant_ids_to_delete: string[];
        };
        Returns: undefined;
      };
      check_rate_limit: {
        Args: {
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      prune_rate_limits: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
  };
}
