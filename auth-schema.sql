CREATE TYPE "user_status" AS ENUM (
  'active',
  'invited',
  'disabled',
  'deleted'
);

CREATE TYPE "identity_provider" AS ENUM (
  'email_password',
  'google',
  'apple'
);

CREATE TYPE "invite_status" AS ENUM (
  'active',
  'redeemed',
  'expired',
  'revoked'
);

CREATE TYPE "device_platform" AS ENUM (
  'ios',
  'android',
  'web'
);

CREATE TYPE "otp_purpose" AS ENUM (
  'login',
  'signup',
  'verify_phone'
);

CREATE TYPE "token_type" AS ENUM (
  'password_reset',
  'email_verify',
  'phone_verify'
);

CREATE TYPE "audit_action" AS ENUM (
  'login_success',
  'login_failed',
  'logout',
  'token_refresh',
  'password_reset_requested',
  'password_reset_completed',
  'email_verification_sent',
  'email_verified',
  'social_login_google',
  'social_login_apple',
  'social_account_linked',
  'membership_switched',
  'invite_created',
  'invite_redeemed',
  'user_disabled'
);

CREATE TABLE "tenants" (
  "id" uuid PRIMARY KEY,
  "name" varchar(160) NOT NULL,
  "slug" varchar(80) UNIQUE NOT NULL,
  "is_personal_tenant" boolean NOT NULL DEFAULT false,
  "owner_user_id" uuid NOT NULL,
  "base_currency" char(3) NOT NULL DEFAULT 'USD',
  "default_language" varchar(8) NOT NULL DEFAULT 'es',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "branches" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "code" varchar(40),
  "timezone" varchar(64) NOT NULL DEFAULT 'America/Caracas',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY,
  "email" varchar(254) UNIQUE NOT NULL,
  "email_verified" boolean NOT NULL DEFAULT false,
  "password_hash" varchar(255),
  "first_name" varchar(120),
  "last_name" varchar(120),
  "display_name" varchar(180),
  "dni" varchar(20) UNIQUE,
  "primary_phone" varchar(32) UNIQUE,
  "phone_verified" boolean NOT NULL DEFAULT false,
  "avatar_url" text,
  "status" user_status NOT NULL DEFAULT 'active',
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "user_settings" (
  "user_id" uuid PRIMARY KEY,
  "preferred_language" varchar(8) NOT NULL DEFAULT 'es',
  "preferred_channel" varchar(16),
  "marketing_consent" boolean NOT NULL DEFAULT false,
  "preferred_currency" char(3) NOT NULL DEFAULT 'USD',
  "dark_mode" boolean NOT NULL DEFAULT false,
  "notifications_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "auth_identities" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "provider" identity_provider NOT NULL,
  "provider_user_id" varchar(255) NOT NULL,
  "provider_email" varchar(254),
  "provider_name" varchar(200),
  "provider_avatar_url" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "user_memberships" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "default_branch_id" uuid,
  "is_owner" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_selected_branch_id" uuid,
  "last_selected_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "membership_settings" (
  "membership_id" uuid PRIMARY KEY,
  "preferred_branch_id" uuid,
  "preferred_professional_user_id" uuid,
  "notes" text,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY,
  "code" varchar(40) UNIQUE NOT NULL,
  "name" varchar(120) NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY,
  "code" varchar(80) UNIQUE NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "membership_role_assignments" (
  "id" uuid PRIMARY KEY,
  "membership_id" uuid NOT NULL,
  "branch_id" uuid,
  "role_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "tenant_id" uuid,
  "membership_id" uuid,
  "token_hash" varchar(255) UNIQUE NOT NULL,
  "device_id" uuid,
  "ip_address" inet,
  "user_agent" text,
  "issued_at" timestamptz NOT NULL DEFAULT (now()),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "revoke_reason" varchar(160),
  "replaced_by_token_id" uuid
);

CREATE TABLE "auth_otps" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid,
  "phone" varchar(32) NOT NULL,
  "purpose" otp_purpose NOT NULL,
  "otp_hash" varchar(255) NOT NULL,
  "attempts" int NOT NULL DEFAULT 0,
  "max_attempts" int NOT NULL DEFAULT 5,
  "sent_via" varchar(16) NOT NULL DEFAULT 'sms',
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "auth_one_time_tokens" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "type" token_type NOT NULL,
  "token_hash" varchar(255) UNIQUE NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "requested_ip" inet,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tenant_invite_codes" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "branch_id" uuid,
  "code" varchar(32) UNIQUE NOT NULL,
  "role_id" uuid NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "status" invite_status NOT NULL DEFAULT 'active',
  "expires_at" timestamptz,
  "max_uses" int NOT NULL DEFAULT 1,
  "used_count" int NOT NULL DEFAULT 0,
  "redeemed_by_user_id" uuid,
  "redeemed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "user_devices" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "device_uid" varchar(128) UNIQUE NOT NULL,
  "platform" device_platform NOT NULL,
  "app_variant" varchar(24) NOT NULL,
  "fcm_token" text,
  "biometrics_enabled" boolean NOT NULL DEFAULT false,
  "last_seen_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "auth_audit_logs" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid,
  "user_id" uuid,
  "membership_id" uuid,
  "action" audit_action NOT NULL,
  "success" boolean NOT NULL DEFAULT true,
  "failure_reason" varchar(200),
  "ip_address" inet,
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "branches" ("tenant_id", "name");

CREATE UNIQUE INDEX ON "branches" ("tenant_id", "code");

CREATE INDEX ON "users" ("email");

CREATE INDEX ON "users" ("primary_phone");

CREATE INDEX ON "users" ("status");

CREATE UNIQUE INDEX ON "auth_identities" ("provider", "provider_user_id");

CREATE UNIQUE INDEX ON "auth_identities" ("user_id", "provider");

CREATE UNIQUE INDEX ON "user_memberships" ("user_id", "tenant_id");

CREATE INDEX ON "user_memberships" ("tenant_id", "is_active");

CREATE UNIQUE INDEX ON "membership_role_assignments" ("membership_id", "branch_id", "role_id");

CREATE INDEX ON "refresh_tokens" ("user_id", "expires_at");

CREATE INDEX ON "refresh_tokens" ("token_hash");

CREATE INDEX ON "auth_otps" ("phone", "purpose", "expires_at");

CREATE INDEX ON "auth_one_time_tokens" ("user_id", "type", "expires_at");

CREATE INDEX ON "tenant_invite_codes" ("tenant_id", "status");

CREATE INDEX ON "tenant_invite_codes" ("code");

CREATE INDEX ON "user_devices" ("user_id", "platform");

CREATE INDEX ON "auth_audit_logs" ("tenant_id", "created_at");

CREATE INDEX ON "auth_audit_logs" ("user_id", "created_at");

CREATE INDEX ON "auth_audit_logs" ("action", "created_at");

ALTER TABLE "tenants" ADD FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id");

ALTER TABLE "branches" ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id");

ALTER TABLE "user_settings" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "auth_identities" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "user_memberships" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "user_memberships" ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id");

ALTER TABLE "user_memberships" ADD FOREIGN KEY ("default_branch_id") REFERENCES "branches" ("id");

ALTER TABLE "user_memberships" ADD FOREIGN KEY ("last_selected_branch_id") REFERENCES "branches" ("id");

ALTER TABLE "membership_settings" ADD FOREIGN KEY ("membership_id") REFERENCES "user_memberships" ("id");

ALTER TABLE "membership_settings" ADD FOREIGN KEY ("preferred_branch_id") REFERENCES "branches" ("id");

ALTER TABLE "membership_settings" ADD FOREIGN KEY ("preferred_professional_user_id") REFERENCES "users" ("id");

ALTER TABLE "membership_role_assignments" ADD FOREIGN KEY ("membership_id") REFERENCES "user_memberships" ("id");

ALTER TABLE "membership_role_assignments" ADD FOREIGN KEY ("branch_id") REFERENCES "branches" ("id");

ALTER TABLE "membership_role_assignments" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("id");

ALTER TABLE "role_permissions" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("id");

ALTER TABLE "role_permissions" ADD FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id");

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id");

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("membership_id") REFERENCES "user_memberships" ("id");

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("device_id") REFERENCES "user_devices" ("id");

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens" ("id");

ALTER TABLE "auth_otps" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "auth_one_time_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "tenant_invite_codes" ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id");

ALTER TABLE "tenant_invite_codes" ADD FOREIGN KEY ("branch_id") REFERENCES "branches" ("id");

ALTER TABLE "tenant_invite_codes" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("id");

ALTER TABLE "tenant_invite_codes" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "tenant_invite_codes" ADD FOREIGN KEY ("redeemed_by_user_id") REFERENCES "users" ("id");

ALTER TABLE "user_devices" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "auth_audit_logs" ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id");

ALTER TABLE "auth_audit_logs" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "auth_audit_logs" ADD FOREIGN KEY ("membership_id") REFERENCES "user_memberships" ("id");
