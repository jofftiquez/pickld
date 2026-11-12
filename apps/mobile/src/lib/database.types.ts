export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
      jars: {
        Row: {
          comment_count: number;
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
        };
        ComputedFields: 'jar_ends_at';
        Insert: {
          comment_count?: number;
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
          comment_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          id: string;
          moment_id: string | null;
          scores: NonNullable<Json>;
          second_opinion: Json | null;
          source: Database['public']['Enums']['mod_source'];
          status: Database['public']['Enums']['mod_status'];
        };
        ComputedFields: never;
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          id?: string;
          moment_id?: string | null;
          scores?: NonNullable<Json>;
          second_opinion?: Json | null;
          source: Database['public']['Enums']['mod_source'];
          status?: Database['public']['Enums']['mod_status'];
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          id?: string;
          moment_id?: string | null;
          scores?: NonNullable<Json>;
          second_opinion?: Json | null;
          source?: Database['public']['Enums']['mod_source'];
          status?: Database['public']['Enums']['mod_status'];
        };
        Relationships: [
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
            foreignKeyName: 'moderation_items_moment_id_fkey';
            columns: ['moment_id'];
            isOneToOne: false;
            referencedRelation: 'moments';
            referencedColumns: ['id'];
          },
        ];
      };
      moments: {
        Row: {
          added_at: string;
          caption: string | null;
          captured_at: string | null;
          edits: NonNullable<Json>;
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
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          caption?: string | null;
          captured_at?: string | null;
          edits?: NonNullable<Json>;
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
        };
        Update: {
          added_at?: string;
          caption?: string | null;
          captured_at?: string | null;
          edits?: NonNullable<Json>;
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
      notifications: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          jar_id: string | null;
          moment_id: string | null;
          read_at: string | null;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          jar_id?: string | null;
          moment_id?: string | null;
          read_at?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          jar_id?: string | null;
          moment_id?: string | null;
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
          username?: string;
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
          note?: string | null;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string;
          status?: string;
          target?: Database['public']['Enums']['target_type'];
          target_id?: string;
        };
        Relationships: [
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
          id: string;
          locale: string | null;
          name: string;
          slug: string;
          sort: number;
          store_product_id: string | null;
          tier: Database['public']['Enums']['pack_tier'];
          pack_usable: boolean | null;
        };
        ComputedFields: 'pack_usable';
        Insert: {
          artist_id?: string | null;
          available_from?: string | null;
          available_to?: string | null;
          id?: string;
          locale?: string | null;
          name: string;
          slug: string;
          sort?: number;
          store_product_id?: string | null;
          tier: Database['public']['Enums']['pack_tier'];
        };
        Update: {
          artist_id?: string | null;
          available_from?: string | null;
          available_to?: string | null;
          id?: string;
          locale?: string | null;
          name?: string;
          slug?: string;
          sort?: number;
          store_product_id?: string | null;
          tier?: Database['public']['Enums']['pack_tier'];
        };
        Relationships: [];
      };
      stickers: {
        Row: {
          asset_path: string;
          id: string;
          label: string;
          milestone_key: string | null;
          pack_id: string;
          slot_hint: Database['public']['Enums']['slot'] | null;
          sort: number;
          stamp: Database['public']['Enums']['sticker_stamp'] | null;
          tags: string[];
          sticker_usable: boolean | null;
        };
        ComputedFields: 'sticker_usable';
        Insert: {
          asset_path: string;
          id?: string;
          label: string;
          milestone_key?: string | null;
          pack_id: string;
          slot_hint?: Database['public']['Enums']['slot'] | null;
          sort?: number;
          stamp?: Database['public']['Enums']['sticker_stamp'] | null;
          tags?: string[];
        };
        Update: {
          asset_path?: string;
          id?: string;
          label?: string;
          milestone_key?: string | null;
          pack_id?: string;
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
      can_appeal: { Args: { item: string; uid?: string }; Returns: boolean };
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
      ensure_jar: {
        Args: { local_date: string; tz: string };
        Returns: {
          comment_count: number;
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
      grant_milestones: { Args: { uid: string }; Returns: string[] };
      has_pending_replacement: { Args: { moment_id: string }; Returns: boolean };
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
      moderation_apply: {
        Args: {
          p_decision: string;
          p_moment_id: string;
          p_pending_since: string;
          p_provider: string;
          p_reason?: string;
          p_scores?: Json;
        };
        Returns: string;
      };
      moderation_apply_comment: {
        Args: { p_comment_id: string; p_decision: string; p_provider: string; p_reason?: string; p_scores?: Json };
        Returns: string;
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
          username: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: false;
          isSetofReturn: true;
        };
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
      sticker_usable: {
        Args: {
          s: Omit<
            Database['public']['Tables']['stickers']['Row'],
            Database['public']['Tables']['stickers']['ComputedFields']
          >;
        };
        Returns: boolean;
      };
      username_available: { Args: { candidate: string }; Returns: string };
    };
    Enums: {
      day_slot: 'morning' | 'afternoon' | 'evening';
      day_type: 'early_bird' | 'coffee_first' | 'night_owl';
      jar_visibility: 'readers' | 'everyone' | 'only_me';
      mod_source: 'auto_check' | 'report' | 'appeal';
      mod_status: 'pending' | 'kept' | 'removed' | 'escalated';
      moment_status: 'uploading' | 'checking' | 'live' | 'removed';
      pack_source: 'free' | 'purchase' | 'earned' | 'subscription';
      pack_tier: 'free' | 'premium' | 'earned' | 'seasonal';
      profile_status: 'active' | 'suspended' | 'deleted';
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
      day_slot: ['morning', 'afternoon', 'evening'],
      day_type: ['early_bird', 'coffee_first', 'night_owl'],
      jar_visibility: ['readers', 'everyone', 'only_me'],
      mod_source: ['auto_check', 'report', 'appeal'],
      mod_status: ['pending', 'kept', 'removed', 'escalated'],
      moment_status: ['uploading', 'checking', 'live', 'removed'],
      pack_source: ['free', 'purchase', 'earned', 'subscription'],
      pack_tier: ['free', 'premium', 'earned', 'seasonal'],
      profile_status: ['active', 'suspended', 'deleted'],
      report_reason: ['sexual', 'harassment', 'violence', 'hate', 'spam', 'under_13', 'other'],
      slot: ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'],
      sticker_stamp: ['time', 'date', 'weekday', 'jar_number'],
      target_type: ['jar', 'moment', 'comment', 'profile'],
    },
  },
} as const;
