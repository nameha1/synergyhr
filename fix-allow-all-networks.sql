-- Run this SQL in your Supabase SQL Editor to allow all networks (disable network restriction)

-- Set allowed_ips to wildcard (*) to allow all IPs
INSERT INTO public.office_settings (setting_key, setting_value, description) 
VALUES ('allowed_ips', '["*"]'::jsonb, 'List of allowed IP addresses. Use ["*"] to allow all IPs.')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = '["*"]'::jsonb;

-- Clear ASN restrictions
INSERT INTO public.office_settings (setting_key, setting_value, description) 
VALUES ('allowed_asns', '[]'::jsonb, 'List of allowed ASNs. Empty means no ASN restriction.')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = '[]'::jsonb;

-- Clear CIDR restrictions
INSERT INTO public.office_settings (setting_key, setting_value, description)
VALUES ('allowed_cidrs', '[]'::jsonb, 'List of allowed CIDR ranges. Empty means no CIDR restriction.')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = '[]'::jsonb;

-- Disable geo-location requirement
INSERT INTO public.office_settings (setting_key, setting_value, description)
VALUES ('office_location', '{"latitude": 0, "longitude": 0, "radius_meters": 100, "enabled": false}'::jsonb, 'Office location settings for geo-verification.')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = '{"latitude": 0, "longitude": 0, "radius_meters": 100, "enabled": false}'::jsonb;

-- Verify settings
SELECT setting_key, setting_value FROM public.office_settings ORDER BY setting_key;
