-- 0043 — Encrypted storage for the OpenAI API key
--
-- system_settings.openai_api_key was stored plaintext AND returned raw by
-- GET /api/settings to any authenticated user. The key now lives in
-- openai_api_key_encrypted (AES-256-GCM via server/lib/crypto-service.ts,
-- same scheme as email/SMTP credentials). SQL cannot run the app's cipher,
-- so the plaintext -> encrypted backfill happens once at boot
-- (ensureSettingsSecretsMigrated in server/bootstrap/services.ts), which
-- also NULLs the legacy plaintext column. The legacy column is kept
-- (always NULL after backfill) so this migration stays reversible; a later
-- release can drop it once the fleet has upgraded.

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS openai_api_key_encrypted text;
