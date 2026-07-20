/**
 * Hand-written to match supabase/migrations/*.sql. Once a real Supabase
 * project is linked, regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 * and reconcile any drift.
 */
import type {
  OrganisationType,
  OrganisationMemberRole,
  RequestStatus,
  ResponseStatus,
  IntroductionDecision,
} from "./domain";

type OrganisationStatus = "pending_verification" | "active" | "suspended";

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string;
          type: OrganisationType;
          name: string;
          status: OrganisationStatus;
          postcode_prefix: string | null;
          coverage_prefixes: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organisations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organisations"]["Row"]>;
        Relationships: [];
      };
      organisation_members: {
        Row: {
          id: string;
          organisation_id: string;
          user_id: string;
          role: OrganisationMemberRole;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organisation_members"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organisation_members"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          job_title: string | null;
          phone: string | null;
          contact_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      supplier_categories: {
        Row: {
          supplier_org_id: string;
          category_id: string;
        };
        Insert: Database["public"]["Tables"]["supplier_categories"]["Row"];
        Update: Partial<Database["public"]["Tables"]["supplier_categories"]["Row"]>;
        Relationships: [];
      };
      requests: {
        Row: {
          id: string;
          reference: string;
          provider_org_id: string;
          category_id: string;
          title: string;
          description: string;
          desired_outcome: string | null;
          mandatory_requirements: string | null;
          postcode_prefix: string;
          closing_date: string;
          status: RequestStatus;
          created_by: string;
          approved_by: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["requests"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["requests"]["Row"],
            "provider_org_id" | "category_id" | "title" | "description" | "postcode_prefix" | "closing_date" | "created_by"
          >;
        Update: Partial<Database["public"]["Tables"]["requests"]["Row"]>;
        Relationships: [];
      };
      request_admin_notes: {
        Row: {
          request_id: string;
          note: string;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["request_admin_notes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["request_admin_notes"]["Row"]>;
        Relationships: [];
      };
      responses: {
        Row: {
          id: string;
          request_id: string;
          supplier_org_id: string;
          summary: string;
          proposed_solution: string;
          one_off_cost: number | null;
          recurring_cost: number | null;
          vat_status: "inclusive" | "exclusive" | "not_applicable";
          timescale: string | null;
          status: ResponseStatus;
          created_by: string;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["responses"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["responses"]["Row"],
            "request_id" | "supplier_org_id" | "summary" | "proposed_solution" | "created_by"
          >;
        Update: Partial<Database["public"]["Tables"]["responses"]["Row"]>;
        Relationships: [];
      };
      request_attachments: {
        Row: {
          id: string;
          request_id: string;
          storage_path: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          visible_to_suppliers: boolean;
          uploaded_by: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["request_attachments"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["request_attachments"]["Row"],
            "request_id" | "storage_path" | "file_name" | "file_size" | "mime_type" | "uploaded_by"
          >;
        Update: Partial<Database["public"]["Tables"]["request_attachments"]["Row"]>;
        Relationships: [];
      };
      response_attachments: {
        Row: {
          id: string;
          response_id: string;
          storage_path: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          uploaded_by: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["response_attachments"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["response_attachments"]["Row"],
            "response_id" | "storage_path" | "file_name" | "file_size" | "mime_type" | "uploaded_by"
          >;
        Update: Partial<Database["public"]["Tables"]["response_attachments"]["Row"]>;
        Relationships: [];
      };
      provider_response_notes: {
        Row: {
          response_id: string;
          note: string;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["provider_response_notes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["provider_response_notes"]["Row"]>;
        Relationships: [];
      };
      introductions: {
        Row: {
          id: string;
          reference: string;
          request_id: string;
          response_id: string;
          provider_org_id: string;
          supplier_org_id: string;
          requested_by: string;
          requested_at: string;
          decision: IntroductionDecision;
          decision_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          contact_released_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["introductions"]["Row"]> &
          Pick<Database["public"]["Tables"]["introductions"]["Row"], "request_id" | "response_id">;
        Update: Partial<Database["public"]["Tables"]["introductions"]["Row"]>;
        Relationships: [];
      };
      message_threads: {
        Row: {
          id: string;
          request_id: string;
          supplier_org_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["message_threads"]["Row"]> &
          Pick<Database["public"]["Tables"]["message_threads"]["Row"], "request_id" | "supplier_org_id">;
        Update: Partial<Database["public"]["Tables"]["message_threads"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_org_id: string;
          sender_user_id: string;
          body: string;
          flagged: boolean;
          flag_reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> &
          Pick<Database["public"]["Tables"]["messages"]["Row"], "thread_id" | "sender_org_id" | "sender_user_id" | "body">;
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organisation_and_join: {
        Args: {
          p_org_type: OrganisationType;
          p_org_name: string;
          p_postcode_prefix: string | null;
          p_coverage_prefixes: string[] | null;
          p_full_name: string;
          p_job_title: string | null;
          p_phone: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      organisation_type: OrganisationType;
      organisation_status: OrganisationStatus;
      organisation_member_role: OrganisationMemberRole;
      request_status: RequestStatus;
      response_status: ResponseStatus;
      introduction_decision: IntroductionDecision;
    };
  };
}
