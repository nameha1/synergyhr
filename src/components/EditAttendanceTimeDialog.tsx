import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditAttendanceTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendanceRecord: {
    id?: string;  // Optional for new records
    employee_id: string;
    employee_name: string;
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
  } | null;
  onSuccess?: () => void;
}

export const EditAttendanceTimeDialog: React.FC<EditAttendanceTimeDialogProps> = ({
  open,
  onOpenChange,
  attendanceRecord,
  onSuccess,
}) => {
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (attendanceRecord) {
      // Convert timestamps to time input format (HH:MM)
      if (attendanceRecord.check_in_time) {
        const checkInDate = new Date(attendanceRecord.check_in_time);
        const hours = String(checkInDate.getHours()).padStart(2, '0');
        const minutes = String(checkInDate.getMinutes()).padStart(2, '0');
        setCheckInTime(`${hours}:${minutes}`);
      } else {
        setCheckInTime('');
      }

      if (attendanceRecord.check_out_time) {
        const checkOutDate = new Date(attendanceRecord.check_out_time);
        const hours = String(checkOutDate.getHours()).padStart(2, '0');
        const minutes = String(checkOutDate.getMinutes()).padStart(2, '0');
        setCheckOutTime(`${hours}:${minutes}`);
      } else {
        setCheckOutTime('');
      }
    }
  }, [attendanceRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!attendanceRecord) return;

    setIsSubmitting(true);

    try {
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Authentication required');
        return;
      }

      // Construct full datetime strings with timezone
      const date = attendanceRecord.date;
      let checkInDateTime = null;
      let checkOutDateTime = null;

      if (checkInTime) {
        // Create a date object in local timezone and convert to ISO
        const localDate = new Date(`${date}T${checkInTime}:00`);
        checkInDateTime = localDate.toISOString();
      }

      if (checkOutTime) {
        // Create a date object in local timezone and convert to ISO
        const localDate = new Date(`${date}T${checkOutTime}:00`);
        checkOutDateTime = localDate.toISOString();
      }

      // Call the API endpoint
      const response = await fetch('/api/attendance/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          attendanceId: attendanceRecord.id,
          employeeId: attendanceRecord.employee_id,
          date: attendanceRecord.date,
          checkInTime: checkInDateTime,
          checkOutTime: checkOutDateTime,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update attendance');
      }

      toast.success('Attendance times updated successfully');
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearCheckIn = () => {
    setCheckInTime('');
  };

  const handleClearCheckOut = () => {
    setCheckOutTime('');
  };

  if (!attendanceRecord) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {attendanceRecord.id ? 'Edit Attendance Time' : 'Add Attendance Time'}
          </DialogTitle>
          <DialogDescription>
            {attendanceRecord.id ? 'Update' : 'Add'} check-in and check-out times for {attendanceRecord.employee_name} on{' '}
            {new Date(attendanceRecord.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="checkInTime">Check-In Time</Label>
            <div className="flex gap-2">
              <Input
                id="checkInTime"
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="flex-1"
              />
              {checkInTime && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleClearCheckIn}
                  title="Clear check-in time"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkOutTime">Check-Out Time</Label>
            <div className="flex gap-2">
              <Input
                id="checkOutTime"
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="flex-1"
              />
              {checkOutTime && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleClearCheckOut}
                  title="Clear check-out time"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
