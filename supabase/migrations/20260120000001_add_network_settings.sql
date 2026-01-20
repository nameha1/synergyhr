-- Add ASN and CIDR network restriction settings
-- Office Network: AS131243 F N S (Dhaka, BD)
INSERT INTO public.office_settings (setting_key, setting_value, description) VALUES
('allowed_asns', '["131243"]'::jsonb, 'List of allowed ASNs (Autonomous System Numbers) for office network. Empty means no ASN restriction.'),
('allowed_cidrs', '["103.41.114.0/24"]'::jsonb, 'List of allowed CIDR ranges for office network. Empty means no CIDR restriction.')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, description = EXCLUDED.description;
