-- Add weekend_days column to employees table (array of day numbers 0=Sunday, 6=Saturday)
ALTER TABLE public.employees 
ADD COLUMN weekend_days integer[] NOT NULL DEFAULT '{5,6}'::integer[];

-- Create office_settings table for IP and geo-location configuration
CREATE TABLE public.office_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view settings (needed for employees to check location requirements)
CREATE POLICY "Anyone can view office settings" 
ON public.office_settings 
FOR SELECT 
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can insert office settings" 
ON public.office_settings 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update office settings" 
ON public.office_settings 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete office settings" 
ON public.office_settings 
FOR DELETE 
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_office_settings_updated_at
BEFORE UPDATE ON public.office_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default office settings
INSERT INTO public.office_settings (setting_key, setting_value, description) VALUES
('allowed_ips', '["*"]'::jsonb, 'List of allowed IP addresses for check-in/out. Use * to allow all.'),
('office_location', '{"latitude": 0, "longitude": 0, "radius_meters": 100, "enabled": false}'::jsonb, 'Office geo-location settings for check-in/out');