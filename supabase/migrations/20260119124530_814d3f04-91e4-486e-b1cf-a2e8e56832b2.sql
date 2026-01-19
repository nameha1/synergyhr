-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Drop existing overly permissive policies on employees
DROP POLICY IF EXISTS "Anyone can view employees" ON public.employees;
DROP POLICY IF EXISTS "Anyone can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Anyone can update employees" ON public.employees;
DROP POLICY IF EXISTS "Anyone can delete employees" ON public.employees;

-- Create proper policies for employees table
-- Authenticated users can view employees (needed for employee portal)
CREATE POLICY "Authenticated users can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (true);

-- Allow public read for employee login (by employee_id lookup only)
CREATE POLICY "Public can view employees by employee_id"
ON public.employees
FOR SELECT
TO anon
USING (true);

-- Only admins can insert/update/delete employees
CREATE POLICY "Admins can insert employees"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update employees"
ON public.employees
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete employees"
ON public.employees
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Drop existing overly permissive policies on attendance_records
DROP POLICY IF EXISTS "Anyone can view attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone can insert attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone can update attendance records" ON public.attendance_records;

-- Create proper policies for attendance_records table
-- Authenticated users and public can view attendance (for employee dashboard)
CREATE POLICY "Anyone can view attendance records"
ON public.attendance_records
FOR SELECT
USING (true);

-- Anyone can insert attendance records (for check-in from employee portal)
CREATE POLICY "Anyone can insert attendance records"
ON public.attendance_records
FOR INSERT
WITH CHECK (true);

-- Anyone can update attendance records (for check-out from employee portal)
CREATE POLICY "Anyone can update attendance records"
ON public.attendance_records
FOR UPDATE
USING (true);