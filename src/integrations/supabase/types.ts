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
      audit_loglari: {
        Row: {
          aciklama: string
          created_at: string
          hedef_personel_id: string | null
          id: string
          islem_turu: string
          yonetici_id: string | null
        }
        Insert: {
          aciklama?: string
          created_at?: string
          hedef_personel_id?: string | null
          id?: string
          islem_turu: string
          yonetici_id?: string | null
        }
        Update: {
          aciklama?: string
          created_at?: string
          hedef_personel_id?: string | null
          id?: string
          islem_turu?: string
          yonetici_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_loglari_yonetici_id_fkey"
            columns: ["yonetici_id"]
            isOneToOne: false
            referencedRelation: "personel"
            referencedColumns: ["id"]
          },
        ]
      }
      bloklar: {
        Row: {
          blok_adi: string
          created_at: string
          id: string
        }
        Insert: {
          blok_adi: string
          created_at?: string
          id?: string
        }
        Update: {
          blok_adi?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      giris_denemeleri: {
        Row: {
          deneme_tarihi: string
          id: string
          kaynak_ozeti: string
          telefon: string
        }
        Insert: {
          deneme_tarihi?: string
          id?: string
          kaynak_ozeti?: string
          telefon: string
        }
        Update: {
          deneme_tarihi?: string
          id?: string
          kaynak_ozeti?: string
          telefon?: string
        }
        Relationships: []
      }
      gorevler: {
        Row: {
          aciklama: string | null
          aciliyet: string
          blok_id: string
          durum: string
          id: string
          is_basligi: string
          is_turu: string
          olusturma_tarihi: string
          personel_id: string | null
          planlanan_tarih: string
        }
        Insert: {
          aciklama?: string | null
          aciliyet?: string
          blok_id: string
          durum?: string
          id?: string
          is_basligi: string
          is_turu?: string
          olusturma_tarihi?: string
          personel_id?: string | null
          planlanan_tarih?: string
        }
        Update: {
          aciklama?: string | null
          aciliyet?: string
          blok_id?: string
          durum?: string
          id?: string
          is_basligi?: string
          is_turu?: string
          olusturma_tarihi?: string
          personel_id?: string | null
          planlanan_tarih?: string
        }
        Relationships: [
          {
            foreignKeyName: "gorevler_blok_id_fkey"
            columns: ["blok_id"]
            isOneToOne: false
            referencedRelation: "bloklar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gorevler_personel_id_fkey"
            columns: ["personel_id"]
            isOneToOne: false
            referencedRelation: "personel"
            referencedColumns: ["id"]
          },
        ]
      }
      is_loglari: {
        Row: {
          foto_url: string | null
          gorev_id: string
          id: string
          personel_notu: string | null
          tamamlanma_tarihi: string
        }
        Insert: {
          foto_url?: string | null
          gorev_id: string
          id?: string
          personel_notu?: string | null
          tamamlanma_tarihi?: string
        }
        Update: {
          foto_url?: string | null
          gorev_id?: string
          id?: string
          personel_notu?: string | null
          tamamlanma_tarihi?: string
        }
        Relationships: [
          {
            foreignKeyName: "is_loglari_gorev_id_fkey"
            columns: ["gorev_id"]
            isOneToOne: false
            referencedRelation: "gorevler"
            referencedColumns: ["id"]
          },
        ]
      }
      personel: {
        Row: {
          ad_soyad: string
          aktif: boolean
          created_at: string
          durum_guncelleme: string
          id: string
          mesai_durumu: string
          mfa_aktif: boolean
          mfa_secret_enc: string | null
          oturum_surumu: number
          pin_hash: string | null
          pin_kodu: string | null
          rol: string
          telefon: string
        }
        Insert: {
          ad_soyad: string
          aktif?: boolean
          created_at?: string
          durum_guncelleme?: string
          id?: string
          mesai_durumu?: string
          mfa_aktif?: boolean
          mfa_secret_enc?: string | null
          oturum_surumu?: number
          pin_hash?: string | null
          pin_kodu?: string | null
          rol?: string
          telefon: string
        }
        Update: {
          ad_soyad?: string
          aktif?: boolean
          created_at?: string
          durum_guncelleme?: string
          id?: string
          mesai_durumu?: string
          mfa_aktif?: boolean
          mfa_secret_enc?: string | null
          oturum_surumu?: number
          pin_hash?: string | null
          pin_kodu?: string | null
          rol?: string
          telefon?: string
        }
        Relationships: []
      }
      personel_konumlari: {
        Row: {
          boylam: number
          dogruluk: number | null
          enlem: number
          id: string
          kayit_tarihi: string
          personel_id: string
        }
        Insert: {
          boylam: number
          dogruluk?: number | null
          enlem: number
          id?: string
          kayit_tarihi?: string
          personel_id: string
        }
        Update: {
          boylam?: number
          dogruluk?: number | null
          enlem?: number
          id?: string
          kayit_tarihi?: string
          personel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personel_konumlari_personel_id_fkey"
            columns: ["personel_id"]
            isOneToOne: false
            referencedRelation: "personel"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gorev_tamamla_atomik: {
        Args: {
          p_foto_yolu: string
          p_gorev_id: string
          p_personel_notu: string
        }
        Returns: undefined
      }
      personel_yonet_atomik: {
        Args: {
          p_audit_aciklama: string
          p_hedef_id: string | null
          p_islem: string
          p_pin_degisti?: boolean
          p_veri: Json
          p_yonetici_id: string
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
