import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Loader2, 
  LogIn, 
  LogOut, 
  LayoutDashboard,
  Clock,
  CheckCircle2,
  Wifi,
  WifiOff,
  Camera
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/employee';
import { FaceCapture } from '@/components/FaceCapture';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const EmployeeLogin: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected] = useState(true);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [pendingAction, setPendingAction] = useState<'checkin' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLookup = async () => {
    if (!employeeId.trim()) return;
    
    setIsLoading(true);
    try {
      const searchId = employeeId.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      // Fetch employee from database
      const { data: employees, error } = await supabase
        .from('employees')
        .select('*');
      
      if (error) throw error;
      
      const employee = employees?.find(emp => {
        const normalizedEmpId = emp.employee_id.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return normalizedEmpId === searchId;
      });
      
      if (employee) {
        // Get today's attendance
        const today = new Date().toISOString().split('T')[0];
        const { data: attendance } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('date', today)
          .maybeSingle();
        
        const mappedEmployee: Employee = {
          id: employee.id,
          employeeId: employee.employee_id,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          avatar: employee.avatar_url ?? undefined,
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
          workStartTime: employee.work_start_time,
          workEndTime: employee.work_end_time,
          workingHoursPerDay: employee.working_hours_per_day,
          lateThresholdMinutes: employee.late_threshold_minutes,
          faceDescriptor: employee.face_descriptor as number[] | null,
        };
        
        setCurrentEmployee(mappedEmployee);
        sessionStorage.setItem('currentEmployeeId', employee.employee_id);
        toast({
          title: `Welcome, ${employee.name.split(' ')[0]}!`,
          description: "You can now check in or view your dashboard.",
        });
      } else {
        toast({
          title: "Employee not found",
          description: "Please check your Employee ID and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error looking up employee:', error);
      toast({
        title: "Error",
        description: "Failed to look up employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const performCheckIn = async () => {
    if (!currentEmployee) return;
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    // Check if late
    const workStart = currentEmployee.workStartTime || '09:00:00';
    const lateThreshold = currentEmployee.lateThresholdMinutes || 15;
    const [hours, minutes] = workStart.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes + lateThreshold, 0, 0);
    const isLate = new Date() > startTime;

    try {
      const { error } = await supabase.from('attendance_records').upsert({
        employee_id: currentEmployee.id,
        date: today,
        check_in_time: now,
        status: isLate ? 'late' : 'present',
        is_late: isLate,
      });

      if (error) throw error;

      setCurrentEmployee({
        ...currentEmployee,
        status: 'checked-in',
        checkInTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
      
      toast({
        title: isLate ? "Checked In (Late)" : "Checked In Successfully!",
        description: `Welcome to work at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      });
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Error",
        description: "Failed to check in. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCheckIn = () => {
    if (!currentEmployee) return;
    
    // If employee has face data, require face verification
    if (currentEmployee.faceDescriptor && currentEmployee.faceDescriptor.length > 0) {
      setPendingAction('checkin');
      setShowFaceVerification(true);
    } else {
      // No face data registered, proceed with normal check-in
      performCheckIn();
    }
  };

  const handleFaceVerified = (match: boolean, distance: number) => {
    if (match) {
      setShowFaceVerification(false);
      if (pendingAction === 'checkin') {
        performCheckIn();
      }
      setPendingAction(null);
    } else {
      toast({
        title: "Face Verification Failed",
        description: "Your face does not match our records. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCheckOut = async () => {
    if (!currentEmployee) return;
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({ check_out_time: now })
        .eq('employee_id', currentEmployee.id)
        .eq('date', today);

      if (error) throw error;

      setCurrentEmployee({
        ...currentEmployee,
        status: 'checked-out',
        checkOutTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
      
      toast({
        title: "Checked Out Successfully!",
        description: `See you tomorrow! Checked out at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      });
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: "Error",
        description: "Failed to check out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setCurrentEmployee(null);
    setEmployeeId('');
    sessionStorage.removeItem('currentEmployeeId');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <User className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AttendanceHub</h1>
          <p className="text-muted-foreground text-sm mt-1">Employee Check-In Portal</p>
        </div>

        {/* Connection Status */}
        <div className="flex justify-center mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            isConnected 
              ? 'bg-accent text-accent-foreground' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="font-medium">Office Network Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="font-medium">Not on Office Network</span>
              </>
            )}
          </div>
        </div>

        {/* Current Time Display */}
        <Card className="border-border/50 mb-4">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Current Time</span>
            </div>
            <div className="text-3xl font-bold text-foreground font-mono">
              {currentTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentTime.toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </CardContent>
        </Card>

        {/* Main Card */}
        <Card className="border-border/50 shadow-xl">
          <CardContent className="p-6">
            {!currentEmployee ? (
              /* Employee ID Input */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Enter Your Employee ID</Label>
                  <Input
                    id="employeeId"
                    type="text"
                    placeholder="e.g., EMP001"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    className="h-12 text-center font-mono text-lg tracking-widest"
                  />
                </div>

                <Button
                  onClick={handleLookup}
                  className="w-full h-11"
                  disabled={isLoading || !employeeId.trim() || !isConnected}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Looking up...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>

                {/* Demo hint */}
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground text-center">
                    <span className="font-medium">Enter your Employee ID to check in</span>
                  </p>
                </div>
              </div>
            ) : (
              /* Check In/Out Panel */
              <div className="space-y-5">
                {/* Employee Info */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{currentEmployee.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentEmployee.department} • {currentEmployee.employeeId}
                      {currentEmployee.faceDescriptor && (
                        <span className="inline-flex items-center gap-1 ml-2 text-primary">
                          <Camera className="w-3 h-3" />
                          Face ID
                        </span>
                      )}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                    Change
                  </Button>
                </div>

                {/* Current Status */}
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-2">Your Status</p>
                  <Badge 
                    className={`text-sm px-4 py-1 ${
                      currentEmployee.status === 'checked-in' 
                        ? 'bg-accent text-accent-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentEmployee.status === 'checked-in' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Checked In at {currentEmployee.checkInTime}
                      </>
                    ) : currentEmployee.checkOutTime ? (
                      <>Checked Out at {currentEmployee.checkOutTime}</>
                    ) : (
                      'Not Checked In'
                    )}
                  </Badge>
                </div>

                {/* Face verification notice */}
                {currentEmployee.faceDescriptor && currentEmployee.status !== 'checked-in' && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                    <p className="text-xs text-primary flex items-center justify-center gap-2">
                      <Camera className="w-4 h-4" />
                      Face verification required for check-in
                    </p>
                  </div>
                )}

                {/* Check In/Out Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleCheckIn}
                    disabled={currentEmployee.status === 'checked-in' || !isConnected}
                    className="h-14 text-base"
                    variant={currentEmployee.status === 'checked-in' ? 'outline' : 'default'}
                  >
                    {currentEmployee.faceDescriptor ? (
                      <>
                        <Camera className="w-5 h-5 mr-2" />
                        Verify & Check In
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5 mr-2" />
                        Check In
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCheckOut}
                    disabled={currentEmployee.status !== 'checked-in' || !isConnected}
                    variant="outline"
                    className="h-14 text-base"
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    Check Out
                  </Button>
                </div>

                {/* Dashboard Link */}
                <Link to="/employee/dashboard" className="block">
                  <Button variant="secondary" className="w-full h-11">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    View My Dashboard
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Link */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/login" className="hover:text-primary transition-colors">
            Admin Login →
          </Link>
        </p>
      </div>

      {/* Face Verification Dialog */}
      <Dialog open={showFaceVerification} onOpenChange={setShowFaceVerification}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Face Verification</DialogTitle>
            <DialogDescription>
              Please look at the camera to verify your identity before checking in.
            </DialogDescription>
          </DialogHeader>
          {currentEmployee?.faceDescriptor && (
            <FaceCapture
              mode="verify"
              existingDescriptor={currentEmployee.faceDescriptor}
              onCapture={() => {}}
              onVerified={handleFaceVerified}
              onCancel={() => {
                setShowFaceVerification(false);
                setPendingAction(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeLogin;
