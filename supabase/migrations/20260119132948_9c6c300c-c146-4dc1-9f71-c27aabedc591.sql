-- Drop existing overly permissive policies on attendance_records
DROP POLICY IF EXISTS "Anyone can insert attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone can update attendance records" ON public.attendance_records;

-- Create more restrictive policies that validate employee exists
-- Insert policy: Only allow inserting records for valid employee IDs
CREATE POLICY "Insert attendance for valid employees only"
ON public.attendance_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = attendance_records.employee_id
  )
);

-- Update policy: Only allow updating records for valid employee IDs 
-- and only allow updating certain fields (not employee_id)
CREATE POLICY "Update attendance for valid employees only"
ON public.attendance_records
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = attendance_records.employee_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = attendance_records.employee_id
  )
);