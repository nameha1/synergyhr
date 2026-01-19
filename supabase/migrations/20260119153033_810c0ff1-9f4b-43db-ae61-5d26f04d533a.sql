-- Add unique constraint on setting_key to enable upsert operations
ALTER TABLE public.office_settings ADD CONSTRAINT office_settings_setting_key_unique UNIQUE (setting_key);