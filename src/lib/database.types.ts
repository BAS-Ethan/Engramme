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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
          created_at?: string
          updated_at?: string
          fts?: never
        }
        Relationships: []
      }
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          folder_id: string | null
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          folder_id?: string | null
          name?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          folder_id?: string | null
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          project_id: string
          title: string
          done: boolean
          due_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          project_id?: string
          title?: string
          done?: boolean
          due_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          title?: string
          done?: boolean
          due_date?: string | null
          created_at?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          id: string
          user_id: string
          project_id: string
          name: string
          storage_path: string
          size: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          project_id?: string
          name?: string
          storage_path?: string
          size?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          name?: string
          storage_path?: string
          size?: number
          created_at?: string
        }
        Relationships: []
      }
      principles: {
        Row: {
          id: string
          user_id: string
          content: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          content?: string
          description?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          description?: string
          created_at?: string
        }
        Relationships: []
      }
      calendar_sources: {
        Row: {
          id: string
          user_id: string
          name: string
          url: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name?: string
          url?: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          url?: string
          color?: string
          created_at?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          id: string
          user_id: string
          content: string
          status: 'raw' | 'dig' | 'project' | 'dropped'
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          content?: string
          status?: 'raw' | 'dig' | 'project' | 'dropped'
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          status?: 'raw' | 'dig' | 'project' | 'dropped'
          tags?: string[]
          created_at?: string
          updated_at?: string
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
export type Folder = Database['public']['Tables']['folders']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type ProjectDocument = Database['public']['Tables']['project_documents']['Row']
export type Principle = Database['public']['Tables']['principles']['Row']
export type CalendarSource = Database['public']['Tables']['calendar_sources']['Row']
export type Idea = Database['public']['Tables']['ideas']['Row']
export type IdeaStatus = Idea['status']
