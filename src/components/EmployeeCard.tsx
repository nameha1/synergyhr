import { Clock, LogIn, LogOut, User } from 'lucide-react';
import { Employee } from '@/types/employee';
import { Button } from '@/components/ui/button';

interface EmployeeCardProps {
  employee: Employee;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
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

export const EmployeeCard = ({ employee, onCheckIn, onCheckOut }: EmployeeCardProps) => {
  const status = statusConfig[employee.status];

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
        
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>
      
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>{employee.department}</span>
            {employee.checkInTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {employee.checkInTime}
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
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
