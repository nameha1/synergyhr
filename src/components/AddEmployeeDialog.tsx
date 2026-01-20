import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDepartments } from '@/hooks/useDepartments';

interface AddEmployeeDialogProps {
  onAdd: () => void;
}

const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Request timed out. Please try again.'));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const AddEmployeeDialog = ({ onAdd }: AddEmployeeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('17:00');
  const [workingHours, setWorkingHours] = useState('8');
  const [lateThreshold, setLateThreshold] = useState('15');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { departmentNames, loading: loadingDepartments, refetch } = useDepartments();

  // Refetch departments when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      refetch();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !department || !employeeId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('employees').insert({
        employee_id: employeeId,
        name,
        email,
        department,
        work_start_time: workStartTime + ':00',
        work_end_time: workEndTime + ':00',
        working_hours_per_day: parseFloat(workingHours),
        late_threshold_minutes: parseInt(lateThreshold),
      });

      if (error) throw error;

      toast.success('Employee added successfully');
      setName('');
      setEmail('');
      setDepartment('');
      setEmployeeId('');
      setWorkStartTime('09:00');
      setWorkEndTime('17:00');
      setWorkingHours('8');
      setLateThreshold('15');
      setOpen(false);
      onAdd();
    } catch (error: unknown) {
      console.error('Error adding employee:', error);
      const err = error as { code?: string; message?: string };
      if (err?.code === '23505') {
        toast.error('Employee ID already exists');
      } else if (err?.message?.includes('timed out')) {
        toast.error('Add employee is taking too long. Please try again.');
      } else {
        toast.error('Failed to add employee');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Enter the employee details and configure their work schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="employeeId">Employee ID *</Label>
              <Input
                id="employeeId"
                placeholder="EMP-007"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.smith@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="department">Department *</Label>
              <Select value={department} onValueChange={setDepartment} disabled={loadingDepartments}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingDepartments ? "Loading..." : "Select department"} />
                </SelectTrigger>
                <SelectContent>
                  {departmentNames.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="border-t border-border pt-4 mt-2">
              <h4 className="font-medium text-sm mb-3">Work Schedule</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="workStartTime">Start Time</Label>
                  <Input
                    id="workStartTime"
                    type="time"
                    value={workStartTime}
                    onChange={(e) => setWorkStartTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="workEndTime">End Time</Label>
                  <Input
                    id="workEndTime"
                    type="time"
                    value={workEndTime}
                    onChange={(e) => setWorkEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="grid gap-2">
                  <Label htmlFor="workingHours">Hours/Day</Label>
                  <Input
                    id="workingHours"
                    type="number"
                    step="0.5"
                    min="1"
                    max="24"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lateThreshold">Late After (min)</Label>
                  <Input
                    id="lateThreshold"
                    type="number"
                    min="0"
                    max="120"
                    value={lateThreshold}
                    onChange={(e) => setLateThreshold(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
