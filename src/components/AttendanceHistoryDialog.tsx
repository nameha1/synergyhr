import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/employee';

interface DayData {
  day: number;
  date: string;
  status: 'present' | 'absent' | 'weekend' | 'future';
  checkIn: string | null;
  checkOut: string | null;
  isLate: boolean;
  isToday: boolean;
  isFuture: boolean;
  notes?: string | null;
}

interface AttendanceHistoryDialogProps {
  employee: Employee;
}

export const AttendanceHistoryDialog: React.FC<AttendanceHistoryDialogProps> = ({ employee }) => {
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState<DayData[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMonthlyData = async () => {
    if (!open) return;
    setIsLoading(true);
    
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`;
    
    const { data: records } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('date', startDate)
      .lte('date', endDate);
    
    const recordMap = new Map(records?.map(r => [r.date, r]) || []);
    
    const data: DayData[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isWeekend = date.getDay() === 5 || date.getDay() === 6;
      const isFuture = date > today;
      const isToday = date.toDateString() === today.toDateString();
      
      const record = recordMap.get(dateStr);
      
      if (isWeekend) {
        data.push({ day, date: dateStr, status: 'weekend', checkIn: null, checkOut: null, isLate: false, isToday, isFuture });
      } else if (isFuture) {
        data.push({ day, date: dateStr, status: 'future', checkIn: null, checkOut: null, isLate: false, isToday, isFuture });
      } else if (record) {
        const checkInTime = record.check_in_time 
          ? new Date(record.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;
        const checkOutTime = record.check_out_time
          ? new Date(record.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;
        data.push({ 
          day, 
          date: dateStr,
          status: 'present', 
          checkIn: checkInTime, 
          checkOut: checkOutTime, 
          isLate: record.is_late, 
          isToday, 
          isFuture,
          notes: record.notes 
        });
      } else {
        data.push({ day, date: dateStr, status: 'absent', checkIn: null, checkOut: null, isLate: false, isToday, isFuture });
      }
    }
    
    setMonthlyData(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMonthlyData();
  }, [open, selectedMonth, employee.id]);

  const stats = {
    present: monthlyData.filter(d => d.status === 'present').length,
    absent: monthlyData.filter(d => d.status === 'absent').length,
    late: monthlyData.filter(d => d.isLate).length,
    workingDays: monthlyData.filter(d => d.status !== 'weekend' && d.status !== 'future').length,
  };

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1);
    if (next <= new Date()) {
      setSelectedMonth(next);
      setSelectedDay(null);
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri*', 'Sat*'];
  const firstDayOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
          <History className="w-4 h-4 mr-1" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Attendance History - {employee.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Monthly Stats */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="border-border/50">
                <CardContent className="p-2 text-center">
                  <p className="text-xs text-muted-foreground">Working</p>
                  <p className="text-lg font-bold text-foreground">{stats.workingDays}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-accent/20">
                <CardContent className="p-2 text-center">
                  <p className="text-xs text-muted-foreground">Present</p>
                  <p className="text-lg font-bold text-accent-foreground">{stats.present}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-destructive/10">
                <CardContent className="p-2 text-center">
                  <p className="text-xs text-muted-foreground">Absent</p>
                  <p className="text-lg font-bold text-destructive">{stats.absent}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-secondary/30">
                <CardContent className="p-2 text-center">
                  <p className="text-xs text-muted-foreground">Late</p>
                  <p className="text-lg font-bold text-secondary-foreground">{stats.late}</p>
                </CardContent>
              </Card>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={previousMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium">
                {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={nextMonth}
                disabled={selectedMonth.getMonth() === new Date().getMonth() && selectedMonth.getFullYear() === new Date().getFullYear()}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Calendar */}
            <div className="border rounded-lg p-3 bg-muted/20">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {monthlyData.map((dayData) => (
                  <button
                    key={dayData.day}
                    onClick={() => dayData.status !== 'future' && dayData.status !== 'weekend' && setSelectedDay(dayData)}
                    disabled={dayData.status === 'future' || dayData.status === 'weekend'}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition-all ${
                      dayData.isToday 
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' 
                        : ''
                    } ${
                      selectedDay?.day === dayData.day 
                        ? 'ring-2 ring-primary' 
                        : ''
                    } ${
                      dayData.status === 'weekend' 
                        ? 'bg-muted/30 text-muted-foreground cursor-default' 
                        : dayData.status === 'future'
                        ? 'bg-background text-muted-foreground/50 cursor-default'
                        : dayData.status === 'absent'
                        ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 cursor-pointer'
                        : dayData.isLate
                        ? 'bg-secondary/40 text-secondary-foreground hover:bg-secondary/50 cursor-pointer'
                        : 'bg-accent/30 text-accent-foreground hover:bg-accent/40 cursor-pointer'
                    }`}
                  >
                    <span className="font-medium">{dayData.day}</span>
                    {dayData.isLate && dayData.status === 'present' && (
                      <AlertTriangle className="w-2.5 h-2.5 text-secondary-foreground absolute bottom-0.5" />
                    )}
                    {dayData.status === 'absent' && (
                      <XCircle className="w-2.5 h-2.5 absolute bottom-0.5" />
                    )}
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-border/50 justify-center">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-accent/30" />
                  <span className="text-xs text-muted-foreground">Present</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-secondary/40" />
                  <span className="text-xs text-muted-foreground">Late</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-destructive/20" />
                  <span className="text-xs text-muted-foreground">Absent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-muted/30" />
                  <span className="text-xs text-muted-foreground">Weekend</span>
                </div>
              </div>
            </div>

            {/* Day Detail */}
            {selectedDay && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">
                      {new Date(selectedDay.date).toLocaleDateString('en-US', { 
                        weekday: 'long',
                        month: 'short', 
                        day: 'numeric'
                      })}
                    </h4>
                    <Badge className={
                      selectedDay.status === 'absent'
                        ? 'bg-destructive/20 text-destructive'
                        : selectedDay.isLate
                        ? 'bg-secondary/40 text-secondary-foreground'
                        : 'bg-accent/30 text-accent-foreground'
                    }>
                      {selectedDay.status === 'absent' ? (
                        <><XCircle className="w-3 h-3 mr-1" /> Absent</>
                      ) : selectedDay.isLate ? (
                        <><AlertTriangle className="w-3 h-3 mr-1" /> Late</>
                      ) : (
                        <><CheckCircle2 className="w-3 h-3 mr-1" /> Present</>
                      )}
                    </Badge>
                  </div>

                  {selectedDay.status === 'present' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Check In</p>
                          <p className="font-mono font-medium text-foreground">{selectedDay.checkIn || '--:--'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Check Out</p>
                          <p className="font-mono font-medium text-foreground">{selectedDay.checkOut || '--:--'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedDay.notes && (
                    <div className="p-2 rounded bg-background/50">
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm text-foreground">{selectedDay.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
