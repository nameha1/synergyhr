import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
  ArrowLeft,
  X,
  LogIn,
  Camera,
  Loader2
} from 'lucide-react';
import { Employee } from '@/types/employee';
import { HRPolicyViewer } from '@/components/HRPolicyViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocationVerification } from '@/hooks/useLocationVerification';
import { useOfficePass } from '@/hooks/useOfficePass';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Lazy load FaceCapture to reduce initial bundle (includes heavy face-api.js)
const FaceCapture = lazy(() => import('@/components/FaceCapture').then(m => ({ default: m.FaceCapture })));

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

const EmployeeDashboard: React.FC = () => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [pendingAction, setPendingAction] = useState<'checkin' | 'checkout' | null>(null);
  const [verificationStep, setVerificationStep] = useState<'face' | 'location' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    isVerifying: isVerifyingLocation,
    verifyLocation,
    reset: resetLocation,
  } = useLocationVerification();
  const {
    status: officeGateStatus,
    checkOfficePass,
    getValidPass,
    resetOfficePass,
  } = useOfficePass();

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
          faceDescriptor: found.face_descriptor as number[][] | null,
        };
        
        setEmployee(mappedEmployee);
        const pass = await checkOfficePass();
        if (!pass) {
          toast({
            title: "Office network required",
            description: "Please connect to the office network to access attendance features.",
            variant: "destructive",
          });
        }
      } else {
        navigate('/employee');
      }
      setIsLoading(false);
    };
    
    fetchEmployee();
  }, [navigate, checkOfficePass, toast]);

  // Fetch attendance records for selected month
  const fetchMonthlyData = useCallback(async () => {
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
  }, [employee, selectedMonth]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  // Real-time subscription for attendance updates
  useEffect(() => {
    if (!employee) return;

    type AttendanceRecordPayload = {
      date?: string;
      check_in_time?: string | null;
      check_out_time?: string | null;
    };

    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `employee_id=eq.${employee.id}`,
        },
        (payload) => {
          console.log('Real-time attendance update:', payload);
          
          // Refresh monthly data
          fetchMonthlyData();
          
          // Update today's status if it's a change for today
          const today = new Date().toISOString().split('T')[0];
          const record = payload.new as AttendanceRecordPayload | null;
          if (record?.date === today) {
            setEmployee(prev => prev ? {
              ...prev,
              status: record.check_out_time 
                ? 'checked-out' 
                : record.check_in_time 
                  ? 'checked-in' 
                  : 'absent',
              checkInTime: record.check_in_time 
                ? new Date(record.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : undefined,
              checkOutTime: record.check_out_time
                ? new Date(record.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : undefined,
            } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee, fetchMonthlyData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('currentEmployeeId');
    resetOfficePass();
    navigate('/employee');
  };

  // Check-in/Check-out handlers
  const performCheckIn = async () => {
    if (!employee) return;
    
    setIsProcessing(true);
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    // Check if late
    const workStart = employee.workStartTime || '09:00:00';
    const lateThreshold = employee.lateThresholdMinutes || 15;
    const [hours, minutes] = workStart.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes + lateThreshold, 0, 0);
    const isLate = new Date() > startTime;

    try {
      const pass = await getValidPass();
      if (!pass) {
        toast({
          title: "Office network required",
          description: "Please connect to the office network to check in.",
          variant: "destructive",
        });
        return;
      }

      const guardResponse = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'x-office-pass': pass },
      });
      if (!guardResponse.ok) {
        throw new Error('Office network check failed');
      }

      const { error } = await supabase.from('attendance_records').upsert({
        employee_id: employee.id,
        date: today,
        check_in_time: now,
        status: isLate ? 'late' : 'present',
        is_late: isLate,
      });

      if (error) throw error;

      setEmployee({
        ...employee,
        status: 'checked-in',
        checkInTime: currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
      
      toast({
        title: isLate ? "Checked In (Late)" : "Checked In Successfully!",
        description: `Welcome to work at ${currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      });
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Error",
        description: "Failed to check in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const performCheckOut = async () => {
    if (!employee) return;
    
    setIsProcessing(true);
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    try {
      const pass = await getValidPass();
      if (!pass) {
        toast({
          title: "Office network required",
          description: "Please connect to the office network to check out.",
          variant: "destructive",
        });
        return;
      }

      const guardResponse = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'x-office-pass': pass },
      });
      if (!guardResponse.ok) {
        throw new Error('Office network check failed');
      }

      const { error } = await supabase
        .from('attendance_records')
        .update({ check_out_time: now })
        .eq('employee_id', employee.id)
        .eq('date', today);

      if (error) throw error;

      setEmployee({
        ...employee,
        status: 'checked-out',
        checkOutTime: currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
      
      toast({
        title: "Checked Out Successfully!",
        description: `See you tomorrow! Checked out at ${currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      });
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: "Error",
        description: "Failed to check out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Start verification flow for check-in/check-out
  const startAttendanceAction = (action: 'checkin' | 'checkout') => {
    if (!employee) return;

    if (officeGateStatus !== 'allowed') {
      toast({
        title: "Office network required",
        description: "Please connect to the office network to check in/out.",
        variant: "destructive",
      });
      return;
    }

    setPendingAction(action);
    resetLocation();
    
    // If employee has face data, start with face verification
    if (employee.faceDescriptor && employee.faceDescriptor.length > 0) {
      setVerificationStep('face');
      setShowFaceVerification(true);
    } else {
      // No face data, go directly to location verification
      setVerificationStep('location');
      performLocationVerification(action);
    }
  };

  const handleFaceVerified = async (match: boolean, distance: number) => {
    if (match) {
      setShowFaceVerification(false);
      
      if (pendingAction === 'checkin' || pendingAction === 'checkout') {
        // Check-in/out needs location verification too
        setVerificationStep('location');
        await performLocationVerification(pendingAction);
      }
    } else {
      toast({
        title: "Face Verification Failed",
        description: "Your face does not match our records. Please try again.",
        variant: "destructive",
      });
    }
  };

  const performLocationVerification = async (action: 'checkin' | 'checkout') => {
    const result = await verifyLocation();
    
    if (result.success) {
      // Location verified, perform the action
      if (action === 'checkin') {
        await performCheckIn();
      } else {
        await performCheckOut();
      }
      setPendingAction(null);
      setVerificationStep(null);
    } else {
      toast({
        title: "Location Verification Failed",
        description: result.error || "You must be at the office to check in/out.",
        variant: "destructive",
      });
      setPendingAction(null);
      setVerificationStep(null);
    }
  };

  const cancelVerification = () => {
    setShowFaceVerification(false);
    setPendingAction(null);
    setVerificationStep(null);
    resetLocation();
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
        {/* Current Status Card with Check-in/Check-out */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Today's Status</p>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      employee.status === 'checked-in' 
                        ? 'bg-accent text-accent-foreground' 
                        : employee.status === 'checked-out'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-muted text-muted-foreground'
                    }>
                      {employee.status === 'checked-in' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Checked In
                        </>
                      ) : employee.status === 'checked-out' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Checked Out
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
                        In: {employee.checkInTime}
                      </span>
                    )}
                    {employee.checkOutTime && (
                      <span className="text-sm text-muted-foreground">
                        Out: {employee.checkOutTime}
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
              
              {/* Check-in/Check-out Button */}
              {employee.status !== 'checked-out' && (
                <Button
                  onClick={() => startAttendanceAction(employee.status === 'checked-in' ? 'checkout' : 'checkin')}
                  disabled={officeGateStatus !== 'allowed' || isProcessing || isVerifyingLocation || pendingAction !== null}
                  className={`w-full h-12 text-base ${
                    employee.status === 'checked-in'
                      ? 'bg-destructive hover:bg-destructive/90'
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  {isProcessing || isVerifyingLocation ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {verificationStep === 'face' ? 'Verifying Face...' : verificationStep === 'location' ? 'Verifying Location...' : 'Processing...'}
                    </>
                  ) : employee.status === 'checked-in' ? (
                    <>
                      <LogOut className="w-5 h-5 mr-2" />
                      Check Out
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5 mr-2" />
                      Check In
                    </>
                  )}
                </Button>
              )}
              
              {employee.status === 'checked-out' && (
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    You have completed your work day. See you tomorrow!
                  </p>
                </div>
              )}
              
              {/* Verification info */}
              {employee.faceDescriptor && employee.faceDescriptor.length > 0 && employee.status !== 'checked-out' && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Camera className="w-3 h-3" />
                  Face verification required
                </p>
              )}
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
                <button
                  key={dayData.day}
                  onClick={() => dayData.status !== 'future' && dayData.status !== 'weekend' && setSelectedDay(dayData)}
                  disabled={dayData.status === 'future' || dayData.status === 'weekend'}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition-all ${
                    dayData.isToday 
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' 
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
                    <AlertTriangle className="w-3 h-3 text-secondary-foreground absolute bottom-0.5" />
                  )}
                  {dayData.status === 'absent' && (
                    <XCircle className="w-3 h-3 absolute bottom-0.5" />
                  )}
                </button>
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

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedDay && new Date(selectedDay.date).toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDay && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge className={
                  selectedDay.status === 'absent'
                    ? 'bg-destructive/20 text-destructive'
                    : selectedDay.isLate
                    ? 'bg-secondary/40 text-secondary-foreground'
                    : 'bg-accent/30 text-accent-foreground'
                }>
                  {selectedDay.status === 'absent' ? (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Absent
                    </>
                  ) : selectedDay.isLate ? (
                    <>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Late
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Present
                    </>
                  )}
                </Badge>
              </div>

              {/* Time Details */}
              {selectedDay.status === 'present' && (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">Check In</span>
                      </div>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {selectedDay.checkIn || '--:--'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">Check Out</span>
                      </div>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        {selectedDay.checkOut || '--:--'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Working Hours */}
              {selectedDay.status === 'present' && selectedDay.checkIn && selectedDay.checkOut && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Working Hours</span>
                    <span className="font-medium text-foreground">
                      {(() => {
                        // Parse times and calculate duration
                        const parseTime = (t: string) => {
                          const [time, period] = t.split(' ');
                          const [h, m] = time.split(':').map(Number);
                          if (period === 'PM' && h !== 12) h += 12;
                          if (period === 'AM' && h === 12) h = 0;
                          return h * 60 + m;
                        };
                        const inMins = parseTime(selectedDay.checkIn!);
                        const outMins = parseTime(selectedDay.checkOut!);
                        const diff = outMins - inMins;
                        const hours = Math.floor(diff / 60);
                        const mins = diff % 60;
                        return `${hours}h ${mins}m`;
                      })()}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedDay.notes && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{selectedDay.notes}</p>
                </div>
              )}

              {/* Late Warning */}
              {selectedDay.isLate && (
                <div className="p-3 rounded-lg bg-secondary/20 border border-secondary/30">
                  <div className="flex items-center gap-2 text-secondary-foreground">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Arrived late on this day</span>
                  </div>
                </div>
              )}

              {/* Absent Message */}
              {selectedDay.status === 'absent' && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                  <XCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-destructive font-medium">No attendance record for this day</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Face Verification Dialog */}
      <Dialog open={showFaceVerification} onOpenChange={(open) => !open && cancelVerification()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Face Verification
            </DialogTitle>
          </DialogHeader>
          {showFaceVerification && employee?.faceDescriptor && (
            <Suspense fallback={
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }>
              <FaceCapture
                mode="verify"
                existingDescriptors={employee.faceDescriptor}
                onCapture={() => {}} // Not used in verify mode
                onVerified={handleFaceVerified}
                onCancel={cancelVerification}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeDashboard;
