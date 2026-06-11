-- 0043 down — remove the encrypted OpenAI key column
--
-- Keys already migrated off the plaintext column are NOT restored to it
-- (that would undo the security fix); re-enter the key after rollback.

ALTER TABLE system_settings
  DROP COLUMN IF EXISTS openai_api_key_encrypted;
