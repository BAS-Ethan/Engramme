export interface Database {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          tags: string[]
          created_at: string
          updated_at: string
          fts: string
        }
        Insert: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          tags?: string[]
          created_at?: string
          updated_at?: string
          fts?: never
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          tags?: string[]
          created_at?: string
          updated_at?: string
          fts?: never
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Note = Database['public']['Tables']['notes']['Row']
