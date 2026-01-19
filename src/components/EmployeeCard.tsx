import { Clock, LogIn, LogOut, User, Camera, Trash2 } from 'lucide-react';
import { Employee } from '@/types/employee';
import { Button } from '@/components/ui/button';
import { EditEmployeeScheduleDialog } from './EditEmployeeScheduleDialog';
import { FaceRegistrationDialog } from './FaceRegistrationDialog';
import { AttendanceHistoryDialog } from './AttendanceHistoryDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface EmployeeCardProps {
  employee: Employee;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onScheduleUpdate?: () => void;
  onDelete?: (id: string) => void;
}

const statusConfig = {
  'checked-in': {
    label: 'Checked In',
    className: 'bg-accent text-accent-foreground',
  },
  'checked-out': {
    label: 'Checked Out',
    className: 'bg-secondary text-muted-foreground',
  },
  'absent': {
    label: 'Absent',
    className: 'bg-destructive/10 text-destructive',
  },
};

export const EmployeeCard = ({ employee, onCheckIn, onCheckOut, onScheduleUpdate, onDelete }: EmployeeCardProps) => {
  const status = statusConfig[employee.status];

  // Format time for display
  const formatTime = (time?: string) => {
    if (!time) return '--:--';
    return time.slice(0, 5);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{employee.name}</h3>
            <p className="text-sm text-muted-foreground">{employee.employeeId}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
          {employee.faceDescriptor && employee.faceDescriptor.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Face ({employee.faceDescriptor.length})
            </span>
          )}
          {onScheduleUpdate && (
            <>
              <FaceRegistrationDialog
                employeeId={employee.id}
                employeeName={employee.name}
                hasFaceData={!!employee.faceDescriptor && employee.faceDescriptor.length > 0}
                faceDataCount={employee.faceDescriptor?.length || 0}
                onUpdate={onScheduleUpdate}
              />
              <EditEmployeeScheduleDialog
                employee={{
                  id: employee.id,
                  employee_id: employee.employeeId,
                  name: employee.name,
                  work_start_time: employee.workStartTime || '09:00:00',
                  work_end_time: employee.workEndTime || '17:00:00',
                  working_hours_per_day: employee.workingHoursPerDay || 8,
                  late_threshold_minutes: employee.lateThresholdMinutes || 15,
                }}
                onUpdate={onScheduleUpdate}
              />
            </>
          )}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete <strong>{employee.name}</strong> ({employee.employeeId})? 
                    This action cannot be undone and will also delete all their attendance records.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(employee.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>{employee.department}</span>
            <span className="flex items-center gap-1 text-xs">
              <Clock className="w-3 h-3" />
              {formatTime(employee.workStartTime)} - {formatTime(employee.workEndTime)}
            </span>
            {employee.checkInTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {employee.checkInTime}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <AttendanceHistoryDialog employee={employee} />
            {employee.status === 'absent' || employee.status === 'checked-out' ? (
              <Button 
                size="sm" 
                onClick={() => onCheckIn(employee.id)}
                className="gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Check In
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onCheckOut(employee.id)}
                className="gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Check Out
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
