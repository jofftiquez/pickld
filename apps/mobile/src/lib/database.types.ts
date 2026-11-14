export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_jobs: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['account_job_kind'];
          result_key: string | null;
          run_after: string;
          status: Database['public']['Enums']['account_job_status'];
          updated_at: string;
          user_id: string;
          account_delete_latest: string | null;
        };
        ComputedFields: 'account_delete_latest';
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          kind: Database['public']['Enums']['account_job_kind'];
          result_key?: string | null;
          run_after?: string;
          status?: Database['public']['Enums']['account_job_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['account_job_kind'];
          result_key?: string | null;
          run_after?: string;
          status?: Database['public']['Enums']['account_job_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_jobs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_jobs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      app_settings: {
        Row: {
          id: boolean;
          invite_period_ends_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          id?: boolean;
          invite_period_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          invite_period_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      appeals: {
        Row: {
          created_at: string;
          id: string;
          message: string | null;
          moderation_item_id: string;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          message?: string | null;
          moderation_item_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string | null;
          moderation_item_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appeals_moderation_item_id_fkey';
            columns: ['moderation_item_id'];
            isOneToOne: true;
            referencedRelation: 'moderation_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appeals_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appeals_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          data: NonNullable<Json>;
          id: number;
          target: Database['public']['Enums']['target_type'] | null;
          target_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: never;
          target?: Database['public']['Enums']['target_type'] | null;
          target_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: never;
          target?: Database['public']['Enums']['target_type'] | null;
          target_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_hidden: boolean;
          jar_id: string;
          moment_id: string | null;
          parent_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_hidden?: boolean;
          jar_id: string;
          moment_id?: string | null;
          parent_id?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_hidden?: boolean;
          jar_id?: string;
          moment_id?: string | null;
          parent_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_jar_id_fkey';
            columns: ['jar_id'];
            isOneToOne: false;
            referencedRelation: 'jars';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_moment_id_fkey';
            columns: ['moment_id'];
            isOneToOne: false;
            referencedRelation: 'moments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_hashes: {
        Row: {
          email_hash: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          email_hash: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          email_hash?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_hashes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_hashes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_match_calls: {
        Row: {
          called_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          called_at?: string;
          user_id: string;
        };
        Update: {
          called_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_match_calls_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_match_calls_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      csam_incidents: {
        Row: {
          created_at: string;
          id: string;
          match: NonNullable<Json>;
          matcher: string;
          moment_id: string | null;
          photo_path: string | null;
          reported_at: string | null;
          status: string;
          thumb_path: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          match?: NonNullable<Json>;
          matcher: string;
          moment_id?: string | null;
          photo_path?: string | null;
          reported_at?: string | null;
          status?: string;
          thumb_path?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          match?: NonNullable<Json>;
          matcher?: string;
          moment_id?: string | null;
          photo_path?: string | null;
          reported_at?: string | null;
          status?: string;
          thumb_path?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'csam_incidents_moment_id_fkey';
            columns: ['moment_id'];
            isOneToOne: false;
            referencedRelation: 'moments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'csam_incidents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'csam_incidents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      follows: {
        Row: {
          author_id: string;
          created_at: string;
          reader_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          created_at?: string;
          reader_id: string;
        };
        Update: {
          author_id?: string;
          created_at?: string;
          reader_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follows_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_reader_id_fkey';
            columns: ['reader_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_reader_id_fkey';
            columns: ['reader_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      invite_attempts: {
        Row: {
          created_at: string;
          key: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          key: string;
        };
        Update: {
          created_at?: string;
          key?: string;
        };
        Relationships: [];
      };
      invite_codes: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          disabled_at: string | null;
          expires_at: string | null;
          kind: Database['public']['Enums']['invite_kind'];
          max_uses: number;
          owner_id: string | null;
          set_no: number | null;
          slot: Database['public']['Enums']['slot'] | null;
          uses: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          disabled_at?: string | null;
          expires_at?: string | null;
          kind: Database['public']['Enums']['invite_kind'];
          max_uses?: number;
          owner_id?: string | null;
          set_no?: number | null;
          slot?: Database['public']['Enums']['slot'] | null;
          uses?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          disabled_at?: string | null;
          expires_at?: string | null;
          kind?: Database['public']['Enums']['invite_kind'];
          max_uses?: number;
          owner_id?: string | null;
          set_no?: number | null;
          slot?: Database['public']['Enums']['slot'] | null;
          uses?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'invite_codes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_codes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_codes_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_codes_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      invite_holders: {
        Row: {
          frozen_at: string | null;
          frozen_by: string | null;
          frozen_reason: string | null;
          unlocked_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          frozen_at?: string | null;
          frozen_by?: string | null;
          frozen_reason?: string | null;
          unlocked_at?: string | null;
          user_id: string;
        };
        Update: {
          frozen_at?: string | null;
          frozen_by?: string | null;
          frozen_reason?: string | null;
          unlocked_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invite_holders_frozen_by_fkey';
            columns: ['frozen_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_holders_frozen_by_fkey';
            columns: ['frozen_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_holders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_holders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      invite_links: {
        Row: {
          created_at: string;
          enabled: boolean;
          link_id: string;
          owner_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          enabled?: boolean;
          link_id: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          link_id?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invite_links_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_links_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      invite_redemptions: {
        Row: {
          code: string;
          id: string;
          invitee_id: string | null;
          invitee_suspended_at: string | null;
          redeemed_at: string;
          via_link: boolean;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          id?: string;
          invitee_id?: string | null;
          invitee_suspended_at?: string | null;
          redeemed_at?: string;
          via_link?: boolean;
        };
        Update: {
          code?: string;
          id?: string;
          invitee_id?: string | null;
          invitee_suspended_at?: string | null;
          redeemed_at?: string;
          via_link?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'invite_redemptions_code_fkey';
            columns: ['code'];
            isOneToOne: false;
            referencedRelation: 'invite_codes';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'invite_redemptions_invitee_id_fkey';
            columns: ['invitee_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_redemptions_invitee_id_fkey';
            columns: ['invitee_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      jars: {
        Row: {
          comment_count: number;
          cover_moment_id: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          is_full: boolean | null;
          like_count: number;
          local_date: string;
          moment_count: number;
          published_at: string | null;
          tz: string;
          updated_at: string;
          user_id: string;
          visibility: Database['public']['Enums']['jar_visibility'];
          visible_count: number;
          jar_ends_at: string | null;
          resolved_cover_id: string | null;
        };
        ComputedFields: 'jar_ends_at' | 'resolved_cover_id';
        Insert: {
          comment_count?: number;
          cover_moment_id?: string | null;
          created_at?: string;
          ends_at: string;
          id?: string;
          is_full?: never;
          like_count?: number;
          local_date: string;
          moment_count?: number;
          published_at?: string | null;
          tz: string;
          updated_at?: string;
          user_id: string;
          visibility?: Database['public']['Enums']['jar_visibility'];
          visible_count?: number;
        };
        Update: {
          comment_count?: number;
          cover_moment_id?: string | null;
          created_at?: string;
          ends_at?: string;
          id?: string;
          is_full?: never;
          like_count?: number;
          local_date?: string;
          moment_count?: number;
          published_at?: string | null;
          tz?: string;
          updated_at?: string;
          user_id?: string;
          visibility?: Database['public']['Enums']['jar_visibility'];
          visible_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'jars_cover_moment_id_fkey';
            columns: ['cover_moment_id'];
            isOneToOne: false;
            referencedRelation: 'moments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jars_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jars_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      milestones: {
        Row: {
          achieved_at: string;
          key: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          achieved_at?: string;
          key: string;
          user_id: string;
        };
        Update: {
          achieved_at?: string;
          key?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'milestones_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'milestones_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_items: {
        Row: {
          appeal_id: string | null;
          comment_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          id: string;
          jar_id: string | null;
          moment_id: string | null;
          profile_id: string | null;
          report_id: string | null;
          scores: NonNullable<Json>;
          second_opinion: Json | null;
          source: Database['public']['Enums']['mod_source'];
          status: Database['public']['Enums']['mod_status'];
        };
        ComputedFields: never;
        Insert: {
          appeal_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          id?: string;
          jar_id?: string | null;
          moment_id?: string | null;
          profile_id?: string | null;
          report_id?: string | null;
          scores?: NonNullable<Json>;
          second_opinion?: Json | null;
          source: Database['public']['Enums']['mod_source'];
          status?: Database['public']['Enums']['mod_status'];
        };
        Update: {
          appeal_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          id?: string;
          jar_id?: string | null;
          moment_id?: string | null;
          profile_id?: string | null;
          report_id?: string | null;
          scores?: NonNullable<Json>;
          second_opinion?: Json | null;
          source?: Database['public']['Enums']['mod_source'];
          status?: Database['public']['Enums']['mod_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_items_appeal_id_fkey';
            columns: ['appeal_id'];
            isOneToOne: false;
            referencedRelation: 'appeals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_items_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_items_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_items_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_items_jar_id_fkey';
            columns: ['jar_id'];
            isOneToOne: false;
            referencedRelation: 'jars';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_items_moment_id_fkey';
            columns: ['moment_id'];
            isOneToOne: false;
            referencedRelation: 'moments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_items_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_items_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_items_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'reports';
            referencedColumns: ['id'];
          },
        ];
      };
      moments: {
        Row: {
          added_at: string;
          caption: string | null;
          captured_at: string | null;
          comment_count: number;
          edits: NonNullable<Json>;
          hidden_at: string | null;
          id: string;
          is_backfilled: boolean;
          is_private: boolean;
          jar_id: string;
          like_count: number;
          pending_caption: string | null;
          pending_edits: Json | null;
          pending_photo_path: string | null;
          pending_since: string | null;
          pending_thumb_path: string | null;
          photo_path: string | null;
          replaces: string | null;
          slot: Database['public']['Enums']['slot'];
          status: Database['public']['Enums']['moment_status'];
          thumb_path: string | null;
          user_id: string;
          visibility: Database['public']['Enums']['jar_visibility'];
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          caption?: string | null;
          captured_at?: string | null;
          comment_count?: number;
          edits?: NonNullable<Json>;
          hidden_at?: string | null;
          id?: string;
          is_backfilled?: boolean;
          is_private?: boolean;
          jar_id: string;
          like_count?: number;
          pending_caption?: string | null;
          pending_edits?: Json | null;
          pending_photo_path?: string | null;
          pending_since?: string | null;
          pending_thumb_path?: string | null;
          photo_path?: string | null;
          replaces?: string | null;
          slot: Database['public']['Enums']['slot'];
          status?: Database['public']['Enums']['moment_status'];
          thumb_path?: string | null;
          user_id: string;
          visibility?: Database['public']['Enums']['jar_visibility'];
        };
        Update: {
          added_at?: string;
          caption?: string | null;
          captured_at?: string | null;
          comment_count?: number;
          edits?: NonNullable<Json>;
          hidden_at?: string | null;
          id?: string;
          is_backfilled?: boolean;
          is_private?: boolean;
          jar_id?: string;
          like_count?: number;
          pending_caption?: string | null;
          pending_edits?: Json | null;
          pending_photo_path?: string | null;
          pending_since?: string | null;
          pending_thumb_path?: string | null;
          photo_path?: string | null;
          replaces?: string | null;
          slot?: Database['public']['Enums']['slot'];
          status?: Database['public']['Enums']['moment_status'];
          thumb_path?: string | null;
          user_id?: string;
          visibility?: Database['public']['Enums']['jar_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'moments_jar_id_fkey';
            columns: ['jar_id'];
            isOneToOne: false;
            referencedRelation: 'jars';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moments_replaces_fkey';
            columns: ['replaces'];
            isOneToOne: false;
            referencedRelation: 'moments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_prefs: {
        Row: {
          appeal_decided: boolean;
          comment: boolean;
          friend_joined: boolean;
          full_jar: boolean;
          like: boolean;
          new_reader: boolean;
          quiet_end: string;
          quiet_hours: boolean;
          quiet_start: string;
          removed: boolean;
          reply: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          appeal_decided?: boolean;
          comment?: boolean;
          friend_joined?: boolean;
          full_jar?: boolean;
          like?: boolean;
          new_reader?: boolean;
          quiet_end?: string;
          quiet_hours?: boolean;
          quiet_start?: string;
          removed?: boolean;
          reply?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          appeal_decided?: boolean;
          comment?: boolean;
          friend_joined?: boolean;
          full_jar?: boolean;
          like?: boolean;
          new_reader?: boolean;
          quiet_end?: string;
          quiet_hours?: boolean;
          quiet_start?: string;
          removed?: boolean;
          reply?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          comment_id: string | null;
          created_at: string;
          id: string;
          jar_id: string | null;
          moment_id: string | null;
          push_result: string | null;
          pushed_at: string | null;
          read_at: string | null;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          jar_id?: string | null;
          moment_id?: string | null;
          push_result?: string | null;
          pushed_at?: string | null;
          read_at?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          actor_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          jar_id?: string | null;
          moment_id?: string | null;
          push_result?: string | null;
          pushed_at?: string | null;
          read_at?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_jar_id_fkey';
            columns: ['jar_id'];
            isOneToOne: false;
            referencedRelation: 'jars';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_moment_id_fkey';
            columns: ['moment_id'];
            isOneToOne: false;
            referencedRelation: 'moments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      onboarding_answers: {
        Row: {
          day_type: Database['public']['Enums']['day_type'] | null;
          mebusywith: string[];
          ootd: string | null;
          promise_accepted_at: string | null;
          user_id: string;
          whoamiwith: string[];
        };
        ComputedFields: never;
        Insert: {
          day_type?: Database['public']['Enums']['day_type'] | null;
          mebusywith?: string[];
          ootd?: string | null;
          promise_accepted_at?: string | null;
          user_id: string;
          whoamiwith?: string[];
        };
        Update: {
          day_type?: Database['public']['Enums']['day_type'] | null;
          mebusywith?: string[];
          ootd?: string | null;
          promise_accepted_at?: string | null;
          user_id?: string;
          whoamiwith?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'onboarding_answers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'onboarding_answers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      owned_packs: {
        Row: {
          acquired_at: string;
          pack_id: string;
          source: Database['public']['Enums']['pack_source'];
          store_transaction_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          acquired_at?: string;
          pack_id: string;
          source: Database['public']['Enums']['pack_source'];
          store_transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          acquired_at?: string;
          pack_id?: string;
          source?: Database['public']['Enums']['pack_source'];
          store_transaction_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'owned_packs_pack_id_fkey';
            columns: ['pack_id'];
            isOneToOne: false;
            referencedRelation: 'sticker_packs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'owned_packs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'owned_packs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      pack_thumbs: {
        Row: {
          created_at: string;
          pack_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          pack_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          pack_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pack_thumbs_pack_id_fkey';
            columns: ['pack_id'];
            isOneToOne: false;
            referencedRelation: 'sticker_packs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pack_thumbs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pack_thumbs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      photo_thumbhashes: {
        Row: {
          created_at: string;
          thumb_path: string;
          thumbhash: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          thumb_path: string;
          thumbhash: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          thumb_path?: string;
          thumbhash?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photo_thumbhashes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photo_thumbhashes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          author_count: number;
          avatar_path: string | null;
          bio: string | null;
          birthday: string;
          cover_path: string | null;
          created_at: string;
          default_visibility: Database['public']['Enums']['jar_visibility'];
          display_name: string;
          feed_seen_at: string | null;
          home_tz: string;
          id: string;
          jar_count: number;
          lid_color: string;
          reader_count: number;
          status: Database['public']['Enums']['profile_status'];
          suspended_until: string | null;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          author_count?: number;
          avatar_path?: string | null;
          bio?: string | null;
          birthday: string;
          cover_path?: string | null;
          created_at?: string;
          default_visibility?: Database['public']['Enums']['jar_visibility'];
          display_name: string;
          feed_seen_at?: string | null;
          home_tz?: string;
          id: string;
          jar_count?: number;
          lid_color?: string;
          reader_count?: number;
          status?: Database['public']['Enums']['profile_status'];
          suspended_until?: string | null;
          username: string;
        };
        Update: {
          author_count?: number;
          avatar_path?: string | null;
          bio?: string | null;
          birthday?: string;
          cover_path?: string | null;
          created_at?: string;
          default_visibility?: Database['public']['Enums']['jar_visibility'];
          display_name?: string;
          feed_seen_at?: string | null;
          home_tz?: string;
          id?: string;
          jar_count?: number;
          lid_color?: string;
          reader_count?: number;
          status?: Database['public']['Enums']['profile_status'];
          suspended_until?: string | null;
          username?: string;
        };
        Relationships: [];
      };
      push_tickets: {
        Row: {
          created_at: string;
          ticket_id: string;
          token: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ticket_id: string;
          token: string;
        };
        Update: {
          created_at?: string;
          ticket_id?: string;
          token?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          platform: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          platform: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          platform?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reactions: {
        Row: {
          created_at: string;
          target: Database['public']['Enums']['target_type'];
          target_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          target: Database['public']['Enums']['target_type'];
          target_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          target?: Database['public']['Enums']['target_type'];
          target_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reminder_settings: {
        Row: {
          enabled: boolean;
          local_time: string;
          slot: Database['public']['Enums']['day_slot'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          enabled?: boolean;
          local_time: string;
          slot: Database['public']['Enums']['day_slot'];
          user_id: string;
        };
        Update: {
          enabled?: boolean;
          local_time?: string;
          slot?: Database['public']['Enums']['day_slot'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reminder_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reminder_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          moderation_item_id: string | null;
          note: string | null;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          status: string;
          target: Database['public']['Enums']['target_type'];
          target_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          moderation_item_id?: string | null;
          note?: string | null;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          status?: string;
          target: Database['public']['Enums']['target_type'];
          target_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          moderation_item_id?: string | null;
          note?: string | null;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string;
          status?: string;
          target?: Database['public']['Enums']['target_type'];
          target_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_moderation_item_id_fkey';
            columns: ['moderation_item_id'];
            isOneToOne: false;
            referencedRelation: 'moderation_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reserved_usernames: {
        Row: {
          name: string;
        };
        ComputedFields: never;
        Insert: {
          name: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      sticker_packs: {
        Row: {
          artist_id: string | null;
          available_from: string | null;
          available_to: string | null;
          description: string | null;
          id: string;
          locale: string | null;
          name: string;
          published_at: string | null;
          slug: string;
          sort: number;
          status: string;
          store_product_id: string | null;
          tier: Database['public']['Enums']['pack_tier'];
          pack_usable: boolean | null;
        };
        ComputedFields: 'pack_usable';
        Insert: {
          artist_id?: string | null;
          available_from?: string | null;
          available_to?: string | null;
          description?: string | null;
          id?: string;
          locale?: string | null;
          name: string;
          published_at?: string | null;
          slug: string;
          sort?: number;
          status?: string;
          store_product_id?: string | null;
          tier: Database['public']['Enums']['pack_tier'];
        };
        Update: {
          artist_id?: string | null;
          available_from?: string | null;
          available_to?: string | null;
          description?: string | null;
          id?: string;
          locale?: string | null;
          name?: string;
          published_at?: string | null;
          slug?: string;
          sort?: number;
          status?: string;
          store_product_id?: string | null;
          tier?: Database['public']['Enums']['pack_tier'];
        };
        Relationships: [];
      };
      stickers: {
        Row: {
          art_height: number | null;
          art_version: number;
          art_width: number | null;
          asset_path: string;
          id: string;
          label: string;
          milestone_key: string | null;
          pack_id: string;
          retired_at: string | null;
          slot_hint: Database['public']['Enums']['slot'] | null;
          sort: number;
          stamp: Database['public']['Enums']['sticker_stamp'] | null;
          tags: string[];
          sticker_usable: boolean | null;
        };
        ComputedFields: 'sticker_usable';
        Insert: {
          art_height?: number | null;
          art_version?: number;
          art_width?: number | null;
          asset_path: string;
          id?: string;
          label: string;
          milestone_key?: string | null;
          pack_id: string;
          retired_at?: string | null;
          slot_hint?: Database['public']['Enums']['slot'] | null;
          sort?: number;
          stamp?: Database['public']['Enums']['sticker_stamp'] | null;
          tags?: string[];
        };
        Update: {
          art_height?: number | null;
          art_version?: number;
          art_width?: number | null;
          asset_path?: string;
          id?: string;
          label?: string;
          milestone_key?: string | null;
          pack_id?: string;
          retired_at?: string | null;
          slot_hint?: Database['public']['Enums']['slot'] | null;
          sort?: number;
          stamp?: Database['public']['Enums']['sticker_stamp'] | null;
          tags?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'stickers_pack_id_fkey';
            columns: ['pack_id'];
            isOneToOne: false;
            referencedRelation: 'sticker_packs';
            referencedColumns: ['id'];
          },
        ];
      };
      user_pack_prefs: {
        Row: {
          hidden: boolean;
          pack_id: string;
          sort: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          hidden?: boolean;
          pack_id: string;
          sort?: number;
          user_id: string;
        };
        Update: {
          hidden?: boolean;
          pack_id?: string;
          sort?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_pack_prefs_pack_id_fkey';
            columns: ['pack_id'];
            isOneToOne: false;
            referencedRelation: 'sticker_packs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_pack_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_pack_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      waitlist: {
        Row: {
          admitted_at: string | null;
          created_at: string;
          email: string;
          ip_hash: string | null;
          joined_at: string | null;
          notified_at: string | null;
          source: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          admitted_at?: string | null;
          created_at?: string;
          email: string;
          ip_hash?: string | null;
          joined_at?: string | null;
          notified_at?: string | null;
          source?: string;
          user_id?: string | null;
        };
        Update: {
          admitted_at?: string | null;
          created_at?: string;
          email?: string;
          ip_hash?: string | null;
          joined_at?: string | null;
          notified_at?: string | null;
          source?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          author_count: number;
          avatar_path: string | null;
          bio: string | null;
          cover_path: string | null;
          created_at: string;
          display_name: string;
          id: string;
          jar_count: number;
          lid_color: string;
          reader_count: number;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          author_count?: number | null;
          avatar_path?: string | null;
          bio?: string | null;
          cover_path?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string | null;
          jar_count?: number | null;
          lid_color?: string | null;
          reader_count?: number | null;
          username?: string | null;
        };
        Update: {
          author_count?: number | null;
          avatar_path?: string | null;
          bio?: string | null;
          cover_path?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string | null;
          jar_count?: number | null;
          lid_color?: string | null;
          reader_count?: number | null;
          username?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      account_delete_defer: { Args: { p_from: string; p_user: string }; Returns: undefined };
      account_delete_latest: {
        Args: {
          p_job: Omit<
            Database['public']['Tables']['account_jobs']['Row'],
            Database['public']['Tables']['account_jobs']['ComputedFields']
          >;
        };
        Returns: string;
      };
      account_delete_purge: { Args: { p_user: string }; Returns: boolean };
      account_delete_request: {
        Args: Record<PropertyKey, never>;
        Returns: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['account_job_kind'];
          result_key: string | null;
          run_after: string;
          status: Database['public']['Enums']['account_job_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'account_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      account_job_done: {
        Args: { p_id: string; p_result_key?: string };
        Returns: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['account_job_kind'];
          result_key: string | null;
          run_after: string;
          status: Database['public']['Enums']['account_job_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'account_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      account_job_fail: {
        Args: { p_error: string; p_id: string };
        Returns: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['account_job_kind'];
          result_key: string | null;
          run_after: string;
          status: Database['public']['Enums']['account_job_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'account_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      account_job_yield: {
        Args: { p_id: string };
        Returns: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['account_job_kind'];
          result_key: string | null;
          run_after: string;
          status: Database['public']['Enums']['account_job_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'account_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      account_jobs_claim: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['account_job_kind'];
          result_key: string | null;
          run_after: string;
          status: Database['public']['Enums']['account_job_status'];
          updated_at: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'account_jobs';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      account_purge: { Args: { p_user: string }; Returns: boolean };
      account_request_export: {
        Args: Record<PropertyKey, never>;
        Returns: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          kind: Database['public']['Enums']['account_job_kind'];
          result_key: string | null;
          run_after: string;
          status: Database['public']['Enums']['account_job_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'account_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admit_all_waiting: { Args: Record<PropertyKey, never>; Returns: number };
      admit_profiles: { Args: { p_actor: string; p_ids: string[]; p_reason: string }; Returns: number };
      admit_waiting: { Args: { p_count: number }; Returns: number };
      blocked_accounts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_path: string;
          blocked_at: string;
          display_name: string;
          id: string;
          username: string;
        }[];
      };
      can_appeal: { Args: { item: string; uid?: string }; Returns: boolean };
      can_view_comment_thread: { Args: { p_jar: string; p_moment: string; viewer: string }; Returns: boolean };
      can_view_jar: {
        Args: {
          j: Omit<Database['public']['Tables']['jars']['Row'], Database['public']['Tables']['jars']['ComputedFields']>;
          viewer: string;
        };
        Returns: boolean;
      };
      can_view_moment: {
        Args: {
          m: Omit<
            Database['public']['Tables']['moments']['Row'],
            Database['public']['Tables']['moments']['ComputedFields']
          >;
          viewer: string;
        };
        Returns: boolean;
      };
      can_view_target: {
        Args: { t: Database['public']['Enums']['target_type']; tid: string; viewer: string };
        Returns: boolean;
      };
      contact_hashes_pending: {
        Args: { p_limit?: number };
        Returns: {
          email: string;
          user_id: string;
        }[];
      };
      contact_hashes_save: { Args: { p_hashes: string[]; p_user_ids: string[] }; Returns: number };
      contact_match_take: { Args: { p_user: string }; Returns: string };
      contacts_match_find: {
        Args: { p_hashes: string[]; p_user: string };
        Returns: {
          avatar_path: string;
          display_name: string;
          id: string;
          is_following: boolean;
          username: string;
        }[];
      };
      delete_comment: { Args: { comment_id: string }; Returns: undefined };
      discover_jars_page: {
        Args: { cursor_at?: string; cursor_id?: string };
        Returns: {
          author_avatar_path: string;
          author_display_name: string;
          author_id: string;
          author_username: string;
          comment_count: number;
          cover_moment_id: string;
          feed_at: string;
          is_new: boolean;
          jar_id: string;
          last_caption: string;
          like_count: number;
          local_date: string;
          preview_moment_ids: string[];
          preview_thumb_paths: string[];
          published_at: string;
          visibility: Database['public']['Enums']['jar_visibility'];
          visible_count: number;
        }[];
      };
      discover_moments_page: {
        Args: { cursor_at?: string; cursor_id?: string };
        Returns: {
          added_at: string;
          author_avatar_path: string;
          author_display_name: string;
          author_id: string;
          author_username: string;
          caption: string;
          captured_at: string;
          comment_count: number;
          edits: Json;
          is_backfilled: boolean;
          jar_id: string;
          jar_local_date: string;
          jar_tz: string;
          jar_visible: boolean;
          like_count: number;
          liked: boolean;
          moment_id: string;
          slot: Database['public']['Enums']['slot'];
          visibility: Database['public']['Enums']['jar_visibility'];
        }[];
      };
      ensure_jar: {
        Args: { local_date: string; tz: string };
        Returns: {
          comment_count: number;
          cover_moment_id: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          is_full: boolean | null;
          like_count: number;
          local_date: string;
          moment_count: number;
          published_at: string | null;
          tz: string;
          updated_at: string;
          user_id: string;
          visibility: Database['public']['Enums']['jar_visibility'];
          visible_count: number;
        };
        SetofOptions: {
          from: '*';
          to: 'jars';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      feed_authors: {
        Args: Record<PropertyKey, never>;
        Returns: {
          author_id: string;
          avatar_path: string;
          display_name: string;
          has_new: boolean;
          latest_at: string;
          username: string;
        }[];
      };
      feed_page: {
        Args: { cursor_at?: string; cursor_id?: string };
        Returns: {
          author_avatar_path: string;
          author_display_name: string;
          author_id: string;
          author_username: string;
          comment_count: number;
          cover_moment_id: string;
          feed_at: string;
          is_new: boolean;
          jar_id: string;
          last_caption: string;
          like_count: number;
          local_date: string;
          preview_moment_ids: string[];
          preview_thumb_paths: string[];
          published_at: string;
          visibility: Database['public']['Enums']['jar_visibility'];
          visible_count: number;
        }[];
      };
      full_jars_today: {
        Args: { max_count?: number };
        Returns: {
          avatar_path: string;
          cover_moment_id: string;
          cover_slot: Database['public']['Enums']['slot'];
          display_name: string;
          jar_id: string;
          local_date: string;
          published_at: string;
          user_id: string;
          username: string;
        }[];
      };
      grant_milestones: { Args: { uid: string }; Returns: string[] };
      has_pending_replacement: { Args: { moment_id: string }; Returns: boolean };
      in_quiet_hours: { Args: { at: string; p_user: string }; Returns: boolean };
      invite_add_set: { Args: { p_owner: string; p_set_no: number }; Returns: undefined };
      invite_freeze: { Args: { p_note: string; p_user: string }; Returns: Json };
      invite_grant_set: { Args: { p_user: string }; Returns: Json };
      invite_link_reset: { Args: Record<PropertyKey, never>; Returns: string };
      invite_link_set: { Args: { p_enabled: boolean }; Returns: boolean };
      invite_moderator: { Args: Record<PropertyKey, never>; Returns: string };
      invite_new_link: { Args: { p_owner: string }; Returns: string };
      invite_owner_can_invite: { Args: { p_owner: string }; Returns: boolean };
      invite_period_active: { Args: Record<PropertyKey, never>; Returns: boolean };
      invite_redeem: { Args: { p_token: string }; Returns: Json };
      invite_setup: { Args: { p_owner: string; p_sets: number; p_unlocked: boolean }; Returns: undefined };
      invite_token: { Args: { p_len: number }; Returns: string };
      invite_unfreeze: { Args: { p_note: string; p_user: string }; Returns: Json };
      invite_usable_code: {
        Args: { p_lock?: boolean; p_token: string };
        Returns: {
          code: string;
          kind: Database['public']['Enums']['invite_kind'];
          owner_id: string;
          via_link: boolean;
        }[];
      };
      is_active_user: { Args: { uid?: string }; Returns: boolean };
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean };
      is_client_role: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_moderator: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_reserved_username: { Args: { candidate: string }; Returns: boolean };
      is_valid_tz: { Args: { name: string }; Returns: boolean };
      jar_ends_at: {
        Args: {
          j: Omit<Database['public']['Tables']['jars']['Row'], Database['public']['Tables']['jars']['ComputedFields']>;
        };
        Returns: string;
      };
      mark_feed_seen: { Args: Record<PropertyKey, never>; Returns: string };
      memories_month_recap: {
        Args: { month: string };
        Returns: {
          full_days: number;
          moment_count: number;
          strip: Json;
          top_slot: Database['public']['Enums']['slot'];
        }[];
      };
      memories_on_this_day: {
        Args: { today: string };
        Returns: {
          cover_moment_id: string;
          cover_slot: Database['public']['Enums']['slot'];
          cover_thumb_path: string;
          is_full: boolean;
          jar_id: string;
          local_date: string;
          moment_count: number;
        }[];
      };
      memories_year_summary: {
        Args: { year: number };
        Returns: {
          full_days: number;
          jars_filled: number;
          moment_count: number;
        }[];
      };
      mod_age_band: { Args: { p_birthday: string }; Returns: string };
      mod_analytics: { Args: { p_days?: number }; Returns: Json };
      mod_analytics_moments: {
        Args: Record<PropertyKey, never>;
        Returns: {
          added_at: string;
          day: string;
          edits: Json;
          id: string;
          slot: Database['public']['Enums']['slot'];
          user_id: string;
        }[];
      };
      mod_analytics_sticker_uses: {
        Args: Record<PropertyKey, never>;
        Returns: {
          day: string;
          moment_id: string;
          sticker_id: string;
          user_id: string;
        }[];
      };
      mod_analytics_stickers: { Args: { p_days?: number }; Returns: Json };
      mod_day_start: { Args: Record<PropertyKey, never>; Returns: string };
      mod_decide: { Args: { p_action: string; p_guideline?: string; p_item: string; p_note?: string }; Returns: Json };
      mod_lift_suspension: { Args: { p_note: string; p_user: string }; Returns: Json };
      mod_manual_suspension: {
        Args: { p_user: string };
        Returns: {
          actor_id: string;
          created_at: string;
          note: string;
        }[];
      };
      mod_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      mod_queue: {
        Args: { p_filter?: string; p_limit?: number };
        Returns: {
          appeal_message: string;
          caption: string;
          comment_body: string;
          created_at: string;
          id: string;
          kind: string;
          local_date: string;
          moment_id: string;
          owner_id: string;
          owner_joined: string;
          prior_removals: number;
          reason: string;
          report_count: number;
          score: number;
          slot: string;
          source: Database['public']['Enums']['mod_source'];
          status: Database['public']['Enums']['mod_status'];
          username: string;
          visible: boolean;
        }[];
      };
      mod_queue_page: {
        Args: { p_filter?: string; p_limit?: number; p_newest?: boolean; p_offset?: number };
        Returns: {
          appeal_message: string;
          caption: string;
          comment_body: string;
          created_at: string;
          id: string;
          kind: string;
          local_date: string;
          moment_id: string;
          owner_id: string;
          owner_joined: string;
          prior_removals: number;
          reason: string;
          report_count: number;
          score: number;
          slot: string;
          source: Database['public']['Enums']['mod_source'];
          status: Database['public']['Enums']['mod_status'];
          username: string;
          visible: boolean;
        }[];
      };
      mod_queue_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          all_open: number;
          auto_check: number;
          escalated: number;
          median_wait_seconds: number;
          open_appeals: number;
          pending: number;
          report: number;
        }[];
      };
      mod_require_moderator: { Args: Record<PropertyKey, never>; Returns: string };
      mod_sticker_thumbs: { Args: { p_days?: number }; Returns: Json };
      mod_studio_actor: { Args: Record<PropertyKey, never>; Returns: string };
      mod_studio_art_key: { Args: { p_name: string; p_pack: string }; Returns: Json };
      mod_studio_create_pack: { Args: { p_description?: string; p_name: string; p_slug: string }; Returns: Json };
      mod_studio_description: { Args: { p: string }; Returns: string };
      mod_studio_edit_pack: { Args: { p_description?: string; p_name: string; p_pack: string }; Returns: Json };
      mod_studio_edit_sticker: {
        Args: {
          p_label: string;
          p_slot_hint?: Database['public']['Enums']['slot'];
          p_sticker: string;
          p_tags?: string[];
        };
        Returns: Json;
      };
      mod_studio_publish: { Args: { p_pack: string }; Returns: Json };
      mod_studio_put_art: {
        Args: { p_height: number; p_label: string; p_name: string; p_pack: string; p_width: number };
        Returns: Json;
      };
      mod_studio_set_retired: { Args: { p_retired: boolean; p_sticker: string }; Returns: Json };
      mod_studio_text: { Args: { p: string; p_max: number }; Returns: string };
      mod_studio_valid_part: { Args: { p: string; p_max: number }; Returns: boolean };
      mod_suspend: { Args: { p_note: string; p_user: string }; Returns: Json };
      mod_user: { Args: { p_user: string }; Returns: Json };
      mod_user_moments: {
        Args: { p_limit?: number; p_user: string };
        Returns: {
          added_at: string;
          caption: string;
          hidden: boolean;
          id: string;
          local_date: string;
          moderation: string;
          slot: Database['public']['Enums']['slot'];
          status: Database['public']['Enums']['moment_status'];
          visibility: Database['public']['Enums']['jar_visibility'];
        }[];
      };
      mod_user_search: {
        Args: { p_limit?: number; p_query: string };
        Returns: {
          created_at: string;
          display_name: string;
          id: string;
          moment_count: number;
          open_reports: number;
          status: Database['public']['Enums']['profile_status'];
          strikes: number;
          suspended_until: string;
          username: string;
        }[];
      };
      mod_user_search_page: {
        Args: { p_limit?: number; p_offset?: number; p_query: string; p_sort?: string };
        Returns: {
          created_at: string;
          display_name: string;
          id: string;
          moment_count: number;
          open_reports: number;
          status: Database['public']['Enums']['profile_status'];
          strikes: number;
          suspended_until: string;
          total: number;
          username: string;
        }[];
      };
      mod_user_stats: { Args: { p_days?: number; p_user: string }; Returns: Json };
      mod_waitlist: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string; p_state?: string };
        Returns: {
          created_at: string;
          email: string;
          source: string;
          state: string;
          total: number;
        }[];
      };
      mod_waitlist_export: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          email: string;
          source: string;
          state: string;
        }[];
      };
      mod_waitlist_remove: { Args: { p_email: string; p_note: string }; Returns: Json };
      mod_waitlist_state: { Args: { p_admitted: string; p_user: string }; Returns: string };
      mod_waitlist_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      moderation_apply: {
        Args: {
          p_decision: string;
          p_moment_id: string;
          p_pending_since: string;
          p_provider: string;
          p_reason?: string;
          p_scores?: Json;
          p_second_opinion?: Json;
        };
        Returns: string;
      };
      moderation_apply_comment: {
        Args: { p_comment_id: string; p_decision: string; p_provider: string; p_reason?: string; p_scores?: Json };
        Returns: string;
      };
      moderation_csam_block: {
        Args: {
          p_match: Json;
          p_matcher: string;
          p_moment_id: string;
          p_pending_since: string;
          p_photo_path: string;
          p_thumb_path: string;
        };
        Returns: string;
      };
      moderation_lift_suspensions: { Args: Record<PropertyKey, never>; Returns: number };
      moment_default_visibility: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['jar_visibility'];
      };
      moment_jar: {
        Args: { p_jar: string };
        Returns: {
          comment_count: number;
          id: string;
          like_count: number;
          local_date: string;
          moment_count: number;
          tz: string;
          user_id: string;
          visible_count: number;
        }[];
      };
      moment_photo_paths: {
        Args: { ids: string[] };
        Returns: {
          moment_id: string;
          pending_photo_path: string;
          pending_thumb_path: string;
          photo_path: string;
          thumb_path: string;
        }[];
      };
      moments_feed_page: {
        Args: { cursor_at?: string; cursor_id?: string };
        Returns: {
          added_at: string;
          author_avatar_path: string;
          author_display_name: string;
          author_id: string;
          author_username: string;
          caption: string;
          captured_at: string;
          comment_count: number;
          edits: Json;
          is_backfilled: boolean;
          jar_id: string;
          jar_local_date: string;
          jar_tz: string;
          jar_visible: boolean;
          like_count: number;
          liked: boolean;
          moment_id: string;
          slot: Database['public']['Enums']['slot'];
          visibility: Database['public']['Enums']['jar_visibility'];
        }[];
      };
      month_jars: {
        Args: { month: string };
        Returns: {
          cover_moment_id: string;
          cover_slot: Database['public']['Enums']['slot'];
          cover_thumb_path: string;
          is_full: boolean;
          jar_id: string;
          local_date: string;
          moment_count: number;
          published_at: string;
          tz: string;
          visibility: Database['public']['Enums']['jar_visibility'];
        }[];
      };
      my_invites: { Args: Record<PropertyKey, never>; Returns: Json };
      my_pending_moments: {
        Args: Record<PropertyKey, never>;
        Returns: {
          moment_id: string;
          pending_caption: string;
          pending_edits: Json;
          pending_photo_path: string;
          pending_since: string;
          pending_thumb_path: string;
        }[];
      };
      my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: {
          author_count: number;
          avatar_path: string | null;
          bio: string | null;
          birthday: string;
          cover_path: string | null;
          created_at: string;
          default_visibility: Database['public']['Enums']['jar_visibility'];
          display_name: string;
          feed_seen_at: string | null;
          home_tz: string;
          id: string;
          jar_count: number;
          lid_color: string;
          reader_count: number;
          status: Database['public']['Enums']['profile_status'];
          suspended_until: string | null;
          username: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      my_removal: {
        Args: { p_moment: string };
        Returns: {
          appeal_status: string;
          can_appeal: boolean;
          guideline: string;
          item_id: string;
        }[];
      };
      my_waitlist_status: { Args: Record<PropertyKey, never>; Returns: string };
      notify: {
        Args: {
          p_actor?: string;
          p_comment?: string;
          p_jar?: string;
          p_moment?: string;
          p_type: string;
          p_user: string;
        };
        Returns: undefined;
      };
      notify_friend_joined: { Args: { p_friends: string[]; p_new_user: string }; Returns: number };
      pack_thumb_count: { Args: { p_pack: string; viewer: string }; Returns: number };
      pack_thumbs: {
        Args: Record<PropertyKey, never>;
        Returns: {
          mine: boolean;
          pack_id: string;
          thumbs: number;
        }[];
      };
      pack_usable: {
        Args: {
          p: Omit<
            Database['public']['Tables']['sticker_packs']['Row'],
            Database['public']['Tables']['sticker_packs']['ComputedFields']
          >;
        };
        Returns: boolean;
      };
      public_jar: { Args: { p_id: string }; Returns: Json };
      public_profile: { Args: { p_username: string }; Returns: Json };
      public_sticker_catalog: {
        Args: Record<PropertyKey, never>;
        Returns: {
          asset_path: string;
          label: string;
          pack_name: string;
          pack_slug: string;
          pack_sort: number;
          pack_tier: Database['public']['Enums']['pack_tier'];
          slot_hint: Database['public']['Enums']['slot'];
          sort: number;
          stamp: Database['public']['Enums']['sticker_stamp'];
          sticker_id: string;
          tags: string[];
        }[];
      };
      push_receipts_settle: { Args: { p_dead_tokens: string[]; p_ticket_ids: string[] }; Returns: number };
      push_retry: { Args: { p_ids: string[] }; Returns: undefined };
      push_take: {
        Args: { p_limit?: number; p_settle?: string };
        Returns: {
          actor_name: string;
          comment_body: string;
          comment_id: string;
          id: string;
          jar_id: string;
          jar_local_date: string;
          moment_id: string;
          tokens: string[];
          type: string;
          user_id: string;
        }[];
      };
      push_tickets_due: {
        Args: { p_limit?: number };
        Returns: {
          ticket_id: string;
          token: string;
        }[];
      };
      push_tickets_save: { Args: { p_ticket_ids: string[]; p_tokens: string[] }; Returns: undefined };
      resolved_cover_id: {
        Args: {
          j: Omit<Database['public']['Tables']['jars']['Row'], Database['public']['Tables']['jars']['ComputedFields']>;
        };
        Returns: string;
      };
      search_follow_list: {
        Args: { lim?: number; list: string; owner: string; query?: string };
        Returns: {
          avatar_path: string;
          display_name: string;
          follows_viewer: boolean;
          id: string;
          is_following: boolean;
          username: string;
        }[];
      };
      search_people: {
        Args: { max_count?: number; query: string };
        Returns: {
          avatar_path: string;
          display_name: string;
          id: string;
          is_reading: boolean;
          lid_color: string;
          reader_count: number;
          username: string;
        }[];
      };
      set_pack_thumb: { Args: { p_on: boolean; p_pack: string }; Returns: Json };
      sticker_usable: {
        Args: {
          s: Omit<
            Database['public']['Tables']['stickers']['Row'],
            Database['public']['Tables']['stickers']['ComputedFields']
          >;
        };
        Returns: boolean;
      };
      store_purchases_sync: { Args: { p_purchases: Json; p_user: string }; Returns: Json };
      strike_count: { Args: { p_user: string }; Returns: number };
      submit_report: {
        Args: {
          note?: string;
          reason: Database['public']['Enums']['report_reason'];
          target: Database['public']['Enums']['target_type'];
          target_id: string;
        };
        Returns: undefined;
      };
      suggested_authors: {
        Args: { max_count?: number };
        Returns: {
          avatar_path: string;
          display_name: string;
          id: string;
          lid_color: string;
          mutual_count: number;
          reader_count: number;
          username: string;
        }[];
      };
      username_available: { Args: { candidate: string }; Returns: string };
      waiting_position: { Args: Record<PropertyKey, never>; Returns: number };
      waitlist_join:
        | { Args: { p_email: string; p_ip_hash: string; p_source?: string }; Returns: string }
        | { Args: { p_source?: string }; Returns: string };
    };
    Enums: {
      account_job_kind: 'export' | 'delete';
      account_job_status: 'pending' | 'running' | 'done' | 'failed';
      day_slot: 'morning' | 'afternoon' | 'evening';
      day_type: 'early_bird' | 'coffee_first' | 'night_owl';
      invite_kind: 'personal' | 'waitlist' | 'admin';
      jar_visibility: 'readers' | 'everyone' | 'only_me';
      mod_source: 'auto_check' | 'report' | 'appeal';
      mod_status: 'pending' | 'kept' | 'removed' | 'escalated';
      moment_status: 'uploading' | 'checking' | 'live' | 'removed';
      pack_source: 'free' | 'purchase' | 'earned' | 'subscription';
      pack_tier: 'free' | 'premium' | 'earned' | 'seasonal';
      profile_status: 'active' | 'suspended' | 'deleted' | 'waiting';
      report_reason: 'sexual' | 'harassment' | 'violence' | 'hate' | 'spam' | 'under_13' | 'other';
      slot: 'whereami' | 'mebusywith' | 'whoamiwith' | 'ootd' | 'selfie' | 'morning' | 'afternoon' | 'evening';
      sticker_stamp: 'time' | 'date' | 'weekday' | 'jar_number';
      target_type: 'jar' | 'moment' | 'comment' | 'profile';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_job_kind: ['export', 'delete'],
      account_job_status: ['pending', 'running', 'done', 'failed'],
      day_slot: ['morning', 'afternoon', 'evening'],
      day_type: ['early_bird', 'coffee_first', 'night_owl'],
      invite_kind: ['personal', 'waitlist', 'admin'],
      jar_visibility: ['readers', 'everyone', 'only_me'],
      mod_source: ['auto_check', 'report', 'appeal'],
      mod_status: ['pending', 'kept', 'removed', 'escalated'],
      moment_status: ['uploading', 'checking', 'live', 'removed'],
      pack_source: ['free', 'purchase', 'earned', 'subscription'],
      pack_tier: ['free', 'premium', 'earned', 'seasonal'],
      profile_status: ['active', 'suspended', 'deleted', 'waiting'],
      report_reason: ['sexual', 'harassment', 'violence', 'hate', 'spam', 'under_13', 'other'],
      slot: ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'],
      sticker_stamp: ['time', 'date', 'weekday', 'jar_number'],
      target_type: ['jar', 'moment', 'comment', 'profile'],
    },
  },
} as const;
