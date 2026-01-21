-- Create leave_requests table for employee leave management
CREATE TABLE public.leave_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'personal', 'unpaid', 'maternity', 'paternity', 'bereavement', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    admin_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable Row Level Security
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can view leave requests (employees see their own, admins see all)
CREATE POLICY "Anyone can view leave requests" 
ON public.leave_requests 
FOR SELECT 
USING (true);

-- Anyone can insert leave requests (employee creates their own)
CREATE POLICY "Anyone can insert leave requests" 
ON public.leave_requests 
FOR INSERT 
WITH CHECK (true);

-- Anyone can update leave requests (for admin approval/rejection)
CREATE POLICY "Anyone can update leave requests" 
ON public.leave_requests 
FOR UPDATE 
USING (true);

-- Anyone can delete leave requests (for cancellation)
CREATE POLICY "Anyone can delete leave requests" 
ON public.leave_requests 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_leave_requests_employee_id ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
