import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  LogOut, 
  Clock, 
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { Employee } from '@/types/employee';
import { HRPolicyViewer } from '@/components/HRPolicyViewer';
import { supabase } from '@/integrations/supabase/client';

interface DayData {
  day: number;
  status: 'present' | 'absent' | 'weekend' | 'future';
  checkIn: string | null;
  checkOut: string | null;
  isLate: boolean;
  isToday: boolean;
  isFuture: boolean;
}

const EmployeeDashboard: React.FC = () => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch employee from database
  useEffect(() => {
    const fetchEmployee = async () => {
      const employeeId = sessionStorage.getItem('currentEmployeeId');
      if (!employeeId) {
        navigate('/employee');
        return;
      }
      
      const searchId = employeeId.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      const { data: employees, error } = await supabase
        .from('employees')
        .select('*');
      
      if (error) {
        console.error('Error fetching employee:', error);
        navigate('/employee');
        return;
      }
      
      const found = employees?.find(emp => {
        const normalizedEmpId = emp.employee_id.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return normalizedEmpId === searchId;
      });
      
      if (found) {
        // Get today's attendance
        const today = new Date().toISOString().split('T')[0];
        const { data: attendance } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', found.id)
          .eq('date', today)
          .maybeSingle();
        
        const mappedEmployee: Employee = {
          id: found.id,
          employeeId: found.employee_id,
          name: found.name,
          email: found.email,
          department: found.department,
          avatar: found.avatar_url ?? undefined,
          status: attendance?.check_out_time 
            ? 'checked-out' 
            : attendance?.check_in_time 
              ? 'checked-in' 
              : 'absent',
          checkInTime: attendance?.check_in_time 
            ? new Date(attendance.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : undefined,
          checkOutTime: attendance?.check_out_time
            ? new Date(attendance.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : undefined,
          workStartTime: found.work_start_time,
          workEndTime: found.work_end_time,
          workingHoursPerDay: found.working_hours_per_day,
          lateThresholdMinutes: found.late_threshold_minutes,
        };
        
        setEmployee(mappedEmployee);
      } else {
        navigate('/employee');
      }
      setIsLoading(false);
    };
    
    fetchEmployee();
  }, [navigate]);

  // Fetch attendance records for selected month
  useEffect(() => {
    const fetchMonthlyData = async () => {
      if (!employee) return;
      
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date();
      
      // Fetch attendance records for the month
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
        const isWeekend = date.getDay() === 5 || date.getDay() === 6; // Friday & Saturday are weekends
        const isFuture = date > today;
        const isToday = date.toDateString() === today.toDateString();
        
        const record = recordMap.get(dateStr);
        
        if (isWeekend) {
          data.push({ day, status: 'weekend', checkIn: null, checkOut: null, isLate: false, isToday, isFuture });
        } else if (isFuture) {
          data.push({ day, status: 'future', checkIn: null, checkOut: null, isLate: false, isToday, isFuture });
        } else if (record) {
          const checkInTime = record.check_in_time 
            ? new Date(record.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : null;
          const checkOutTime = record.check_out_time
            ? new Date(record.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : null;
          data.push({ 
            day, 
            status: 'present', 
            checkIn: checkInTime, 
            checkOut: checkOutTime, 
            isLate: record.is_late, 
            isToday, 
            isFuture 
          });
        } else {
          data.push({ day, status: 'absent', checkIn: null, checkOut: null, isLate: false, isToday, isFuture });
        }
      }
      
      setMonthlyData(data);
    };
    
    fetchMonthlyData();
  }, [employee, selectedMonth]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('currentEmployeeId');
    navigate('/employee');
  };

  const stats = {
    present: monthlyData.filter(d => d.status === 'present').length,
    absent: monthlyData.filter(d => d.status === 'absent').length,
    late: monthlyData.filter(d => d.isLate).length,
    workingDays: monthlyData.filter(d => d.status !== 'weekend' && d.status !== 'future').length,
  };

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1);
    if (next <= new Date()) {
      setSelectedMonth(next);
    }
  };

  if (isLoading || !employee) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri*', 'Sat*']; // * = Weekend
  const firstDayOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/employee">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">{employee.name}</p>
                <p className="text-xs text-muted-foreground">{employee.employeeId}</p>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Current Status Card */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Today's Status</p>
                <div className="flex items-center gap-2">
                  <Badge className={
                    employee.status === 'checked-in' 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }>
                    {employee.status === 'checked-in' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Checked In
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Checked In
                      </>
                    )}
                  </Badge>
                  {employee.checkInTime && (
                    <span className="text-sm text-muted-foreground">
                      at {employee.checkInTime}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">Now</span>
                </div>
                <p className="text-lg font-mono font-semibold text-foreground">
                  {currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="border-border/50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Working</p>
              <p className="text-xl font-bold text-foreground">{stats.workingDays}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-accent/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Present</p>
              <p className="text-xl font-bold text-accent-foreground">{stats.present}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-destructive/10">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Absent</p>
              <p className="text-xl font-bold text-destructive">{stats.absent}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-secondary/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Late</p>
              <p className="text-xl font-bold text-secondary-foreground">{stats.late}</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar View */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Monthly Attendance
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={previousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
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
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              
              {/* Day cells */}
              {monthlyData.map((dayData) => (
                <div
                  key={dayData.day}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition-colors ${
                    dayData.isToday 
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' 
                      : ''
                  } ${
                    dayData.status === 'weekend' 
                      ? 'bg-muted/30 text-muted-foreground' 
                      : dayData.status === 'future'
                      ? 'bg-background text-muted-foreground/50'
                      : dayData.status === 'absent'
                      ? 'bg-destructive/20 text-destructive'
                      : dayData.isLate
                      ? 'bg-secondary/40 text-secondary-foreground'
                      : 'bg-accent/30 text-accent-foreground'
                  }`}
                >
                  <span className="font-medium">{dayData.day}</span>
                  {dayData.isLate && dayData.status === 'present' && (
                    <AlertTriangle className="w-3 h-3 text-secondary-foreground absolute bottom-0.5" />
                  )}
                  {dayData.status === 'absent' && (
                    <XCircle className="w-3 h-3 absolute bottom-0.5" />
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-border/50 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-accent/30" />
                <span className="text-xs text-muted-foreground">Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-secondary/40 flex items-center justify-center">
                  <AlertTriangle className="w-2 h-2 text-secondary-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Late</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-destructive/20" />
                <span className="text-xs text-muted-foreground">Absent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-muted/30" />
                <span className="text-xs text-muted-foreground">Weekend</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Records Table */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base font-medium">Recent Records</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1">
              {monthlyData
                .filter(d => d.status === 'present' || d.status === 'absent')
                .slice(-7)
                .reverse()
                .map((record, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-2.5 rounded-lg ${
                      record.isToday ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        record.status === 'absent' 
                          ? 'bg-destructive' 
                          : record.isLate 
                          ? 'bg-secondary' 
                          : 'bg-accent'
                      }`} />
                      <span className="text-sm font-medium text-foreground">
                        {record.isToday ? 'Today' : `${selectedMonth.toLocaleDateString('en-US', { month: 'short' })} ${record.day}`}
                      </span>
                      {record.isLate && (
                        <Badge variant="outline" className="text-xs h-5 bg-secondary/20 text-secondary-foreground border-secondary/30">
                          Late
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {record.status === 'absent' ? (
                        <span className="text-destructive font-medium">Absent</span>
                      ) : (
                        <>
                          <div>
                            <span className="text-muted-foreground">In: </span>
                            <span className="font-mono text-foreground">{record.checkIn}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Out: </span>
                            <span className="font-mono text-foreground">{record.checkOut || '--:--'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* HR Policy Section */}
        <HRPolicyViewer />
      </main>
    </div>
  );
};

export default EmployeeDashboard;
