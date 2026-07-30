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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      collection_recipes: {
        Row: {
          collection_id: string
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cooking_history: {
        Row: {
          cooked_at: string
          created_at: string
          id: string
          notes: string | null
          recipe_id: string
          servings_made: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cooked_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          recipe_id: string
          servings_made?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cooked_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          recipe_id?: string
          servings_made?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cooking_photos: {
        Row: {
          cooking_history_id: string
          created_at: string
          id: string
          storage_bucket: string
          storage_path: string
          user_id: string
        }
        Insert: {
          cooking_history_id: string
          created_at?: string
          id?: string
          storage_bucket: string
          storage_path: string
          user_id: string
        }
        Update: {
          cooking_history_id?: string
          created_at?: string
          id?: string
          storage_bucket?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      early_access_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      kitchen_items: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          ingredient_name: string
          normalized_name: string | null
          status: string
          storage_location: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          ingredient_name: string
          normalized_name?: string | null
          status?: string
          storage_location?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          ingredient_name?: string
          normalized_name?: string | null
          status?: string
          storage_location?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plan_entries: {
        Row: {
          cooking_history_id: string | null
          created_at: string
          id: string
          meal_type: string
          notes: string | null
          planned_date: string
          position: number
          recipe_id: string
          servings: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cooking_history_id?: string | null
          created_at?: string
          id?: string
          meal_type?: string
          notes?: string | null
          planned_date: string
          position?: number
          recipe_id: string
          servings?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cooking_history_id?: string | null
          created_at?: string
          id?: string
          meal_type?: string
          notes?: string | null
          planned_date?: string
          position?: number
          recipe_id?: string
          servings?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          display_name: string
          id: string
          importance: string
          position: number
          preparation_note: string | null
          quantity_text: string | null
          raw_text: string | null
          recipe_id: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          importance?: string
          position?: number
          preparation_note?: string | null
          quantity_text?: string | null
          raw_text?: string | null
          recipe_id: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          importance?: string
          position?: number
          preparation_note?: string | null
          quantity_text?: string | null
          raw_text?: string | null
          recipe_id?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          created_at: string
          id: string
          instruction: string
          position: number
          recipe_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instruction: string
          position?: number
          recipe_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instruction?: string
          position?: number
          recipe_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          archived_at: string | null
          cook_time_minutes: number | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          prep_time_minutes: number | null
          servings: number | null
          cover_storage_bucket: string | null
          cover_storage_path: string | null
          cover_source: string | null
          cover_cooking_photo_id: string | null
          source_title: string | null
          source_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          prep_time_minutes?: number | null
          servings?: number | null
          cover_storage_bucket?: string | null
          cover_storage_path?: string | null
          cover_source?: string | null
          cover_cooking_photo_id?: string | null
          source_title?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          prep_time_minutes?: number | null
          servings?: number | null
          cover_storage_bucket?: string | null
          cover_storage_path?: string | null
          cover_source?: string | null
          cover_cooking_photo_id?: string | null
          source_title?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_item_sources: {
        Row: {
          created_at: string
          id: string
          meal_plan_entry_id: string | null
          meal_type_snapshot: string | null
          planned_date_snapshot: string | null
          raw_quantity_text: string | null
          recipe_id: string | null
          recipe_title_snapshot: string
          shopping_list_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_plan_entry_id?: string | null
          meal_type_snapshot?: string | null
          planned_date_snapshot?: string | null
          raw_quantity_text?: string | null
          recipe_id?: string | null
          recipe_title_snapshot: string
          shopping_list_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_plan_entry_id?: string | null
          meal_type_snapshot?: string | null
          planned_date_snapshot?: string | null
          raw_quantity_text?: string | null
          recipe_id?: string | null
          recipe_title_snapshot?: string
          shopping_list_item_id?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_purchased: boolean
          note: string | null
          position: number
          purchased_at: string | null
          quantity_text: string | null
          shopping_list_id: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_purchased?: boolean
          note?: string | null
          position?: number
          purchased_at?: string | null
          quantity_text?: string | null
          shopping_list_id: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_purchased?: boolean
          note?: string | null
          position?: number
          purchased_at?: string | null
          quantity_text?: string | null
          shopping_list_id?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_lists: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          language: string
          measurement_system: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          language?: string
          measurement_system?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          language?: string
          measurement_system?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_shopping_list_items: {
        Args: {
          p_shopping_list_id: string
          p_items: Json
        }
        Returns: string[]
      }
      save_recipe_with_details: {
        Args: {
          p_recipe_id: string | null
          p_title: string
          p_description: string | null
          p_servings: number | null
          p_prep_time_minutes: number | null
          p_cook_time_minutes: number | null
          p_notes: string | null
          p_ingredients: Json
          p_steps: Json
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
