-- Create storage bucket for HR policy documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-policies', 'hr-policies', true);

-- Allow authenticated admins to upload files
CREATE POLICY "Admins can upload HR policies"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hr-policies' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow authenticated admins to update files
CREATE POLICY "Admins can update HR policies"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'hr-policies' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow authenticated admins to delete files
CREATE POLICY "Admins can delete HR policies"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'hr-policies' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow anyone to read HR policies (employees can view)
CREATE POLICY "Anyone can read HR policies"
ON storage.objects
FOR SELECT
USING (bucket_id = 'hr-policies');