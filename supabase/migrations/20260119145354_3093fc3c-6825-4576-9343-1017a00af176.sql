-- Migrate face_descriptor from single descriptor to array of descriptors
-- The column is already JSONB, so we just need to migrate existing data

-- Update existing single descriptors to be wrapped in an array
UPDATE public.employees
SET face_descriptor = jsonb_build_array(face_descriptor)
WHERE face_descriptor IS NOT NULL 
  AND jsonb_typeof(face_descriptor) = 'array'
  AND jsonb_typeof(face_descriptor->0) = 'number';

-- Add a comment to clarify the new format
COMMENT ON COLUMN public.employees.face_descriptor IS 'Array of face descriptors (each descriptor is a 128-element number array) for multi-angle recognition';