-- Add face_descriptor column to employees table for storing face embeddings
ALTER TABLE public.employees 
ADD COLUMN face_descriptor JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.employees.face_descriptor IS 'Stores the 128-dimensional face descriptor array from face-api.js for facial recognition';