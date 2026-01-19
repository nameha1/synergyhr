-- Create departments table for admin-managed categories
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Everyone can view departments
CREATE POLICY "Anyone can view departments"
ON public.departments
FOR SELECT
USING (true);

-- Only admins can manage departments
CREATE POLICY "Admins can insert departments"
ON public.departments
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update departments"
ON public.departments
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete departments"
ON public.departments
FOR DELETE
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default departments
INSERT INTO public.departments (name, description) VALUES
  ('Engineering', 'Software development and technical teams'),
  ('Marketing', 'Marketing and communications'),
  ('Sales', 'Sales and business development'),
  ('Human Resources', 'HR and people operations'),
  ('Finance', 'Finance and accounting');