-- Run this SQL in your Supabase SQL Editor to fix the missing network settings

-- Add allowed_asns setting (empty = no restriction)
INSERT INTO public.office_settings (setting_key, setting_value, description) 
VALUES ('allowed_asns', '[]'::jsonb, 'List of allowed ASNs (Autonomous System Numbers) for office network. Empty means no ASN restriction.')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Add allowed_cidrs setting (empty = no restriction)  
INSERT INTO public.office_settings (setting_key, setting_value, description)
VALUES ('allowed_cidrs', '[]'::jsonb, 'List of allowed CIDR ranges for office network. Empty means no CIDR restriction.')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- EXAMPLE: To configure your office ASN (replace 12345 with your actual ASN):
-- UPDATE public.office_settings 
-- SET setting_value = '["12345"]'::jsonb 
-- WHERE setting_key = 'allowed_asns';

-- EXAMPLE: To configure your office CIDR range:
-- UPDATE public.office_settings 
-- SET setting_value = '["103.41.114.0/24"]'::jsonb 
-- WHERE setting_key = 'allowed_cidrs';

-- View current settings:
SELECT setting_key, setting_value, description FROM public.office_settings ORDER BY setting_key;
