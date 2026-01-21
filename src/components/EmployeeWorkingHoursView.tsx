"use client";

import { Clock, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface WorkingHoursViewProps {
  workStartTime?: string;
  workEndTime?: string;
  workingHoursPerDay?: number;
  lateThresholdMinutes?: number;
  weekendDays?: number[];
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const EmployeeWorkingHoursView = ({
  workStartTime = '09:00:00',
  workEndTime = '17:00:00',
  workingHoursPerDay = 8,
  lateThresholdMinutes = 15,
  weekendDays = [5, 6], // Default: Friday and Saturday
}: WorkingHoursViewProps) => {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const workingDays = Array.from({ length: 7 }, (_, i) => i).filter(
    (day) => !weekendDays.includes(day)
  );

  const lateTime = () => {
    const [hours, minutes] = workStartTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + lateThresholdMinutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return formatTime(`${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:00`);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Working Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Working Hours */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-accent/20 border border-accent/30">
            <p className="text-xs text-muted-foreground mb-1">Start Time</p>
            <p className="text-lg font-semibold text-accent-foreground">
              {formatTime(workStartTime)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">End Time</p>
            <p className="text-lg font-semibold text-foreground">
              {formatTime(workEndTime)}
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Daily Hours</span>
            </div>
            <span className="font-medium text-foreground">{workingHoursPerDay}h</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 border border-secondary/30">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-secondary-foreground" />
              <span className="text-sm text-muted-foreground">Late After</span>
            </div>
            <div className="text-right">
              <span className="font-medium text-secondary-foreground">{lateTime()}</span>
              <p className="text-xs text-muted-foreground">+{lateThresholdMinutes} min grace</p>
            </div>
          </div>
        </div>

        {/* Working Days */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Working Days</p>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 7 }, (_, i) => i).map((day) => {
              const isWorkDay = workingDays.includes(day);
              return (
                <Badge
                  key={day}
                  variant={isWorkDay ? 'default' : 'outline'}
                  className={`text-xs ${
                    !isWorkDay
                      ? 'bg-muted/30 text-muted-foreground border-muted'
                      : ''
                  }`}
                >
                  {shortDayNames[day]}
                </Badge>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Weekends:{' '}
            {weekendDays.map((d) => dayNames[d]).join(', ')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
