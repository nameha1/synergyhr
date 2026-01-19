import { useState } from 'react';
import { Clock, Settings } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  work_start_time: string;
  work_end_time: string;
  working_hours_per_day: number;
  late_threshold_minutes: number;
}

interface EditEmployeeScheduleDialogProps {
  employee: Employee;
  onUpdate: () => void;
}

export const EditEmployeeScheduleDialog = ({ employee, onUpdate }: EditEmployeeScheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [workStartTime, setWorkStartTime] = useState(employee.work_start_time.slice(0, 5));
  const [workEndTime, setWorkEndTime] = useState(employee.work_end_time.slice(0, 5));
  const [workingHours, setWorkingHours] = useState(employee.working_hours_per_day.toString());
  const [lateThreshold, setLateThreshold] = useState(employee.late_threshold_minutes.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('employees')
        .update({
          work_start_time: workStartTime + ':00',
          work_end_time: workEndTime + ':00',
          working_hours_per_day: parseFloat(workingHours),
          late_threshold_minutes: parseInt(lateThreshold),
        })
        .eq('id', employee.id);

      if (error) throw error;

      toast.success('Schedule updated successfully');
      onUpdate();
      setOpen(false);
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('Failed to update schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Edit Work Schedule
            </DialogTitle>
            <DialogDescription>
              Configure work schedule for {employee.name} ({employee.employee_id})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
            <div className="grid gap-2">
              <Label htmlFor="workingHours">Working Hours per Day</Label>
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
              <Label htmlFor="lateThreshold">Late Threshold (minutes)</Label>
              <Input
                id="lateThreshold"
                type="number"
                min="0"
                max="120"
                value={lateThreshold}
                onChange={(e) => setLateThreshold(e.target.value)}
                placeholder="Minutes after start time to consider late"
              />
              <p className="text-xs text-muted-foreground">
                Employee is marked late if checked in after this many minutes past start time
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
