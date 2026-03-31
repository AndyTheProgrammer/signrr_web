export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          title: string
          file_path: string
          signed_file_path: string | null
          status: 'draft' | 'pending' | 'completed' | 'cancelled'
          signing_mode: 'simple' | 'positioned'
          owner_id: string
          current_signer_index: number
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          title: string
          file_path: string
          signed_file_path?: string | null
          status?: 'draft' | 'pending' | 'completed' | 'cancelled'
          signing_mode?: 'simple' | 'positioned'
          owner_id: string
          current_signer_index?: number
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          file_path?: string
          signed_file_path?: string | null
          status?: 'draft' | 'pending' | 'completed' | 'cancelled'
          signing_mode?: 'simple' | 'positioned'
          owner_id?: string
          current_signer_index?: number
          created_at?: string
          completed_at?: string | null
        }
      }
      signers: {
        Row: {
          id: string
          document_id: string
          email: string
          full_name: string | null
          signing_order: number
          status: 'pending' | 'signed'
          magic_token: string | null
          magic_token_expires_at: string | null
          signed_at: string | null
          signature_data: string | null
          signature_position: { x: number; y: number; page: number; width?: number } | null
          annotations_data: any[] | null
        }
        Insert: {
          id?: string
          document_id: string
          email: string
          full_name?: string | null
          signing_order: number
          status?: 'pending' | 'signed'
          magic_token?: string | null
          magic_token_expires_at?: string | null
          signed_at?: string | null
          signature_data?: string | null
          signature_position?: { x: number; y: number; page: number; width?: number } | null
          annotations_data?: any[] | null
        }
        Update: {
          id?: string
          document_id?: string
          email?: string
          full_name?: string | null
          signing_order?: number
          status?: 'pending' | 'signed'
          magic_token?: string | null
          magic_token_expires_at?: string | null
          signed_at?: string | null
          signature_data?: string | null
          signature_position?: { x: number; y: number; page: number; width?: number } | null
          annotations_data?: any[] | null
        }
      }
    }
  }
}

// Helper types for easier use
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type Signer = Database['public']['Tables']['signers']['Row']
export type DocumentStatus = 'draft' | 'pending' | 'completed' | 'cancelled'
export type SignerStatus = 'pending' | 'signed'
export type SigningMode = 'simple' | 'positioned'
export type SignaturePosition = { x: number; y: number; page: number; width?: number }

// Extended types with relations
export type DocumentWithSigners = Document & {
  signers: Signer[]
}
