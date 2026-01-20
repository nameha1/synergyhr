import React, { useState, useEffect, lazy, Suspense } from 'react';
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
  Camera,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/employee';
import { useLocationVerification } from '@/hooks/useLocationVerification';
import { useOfficePass } from '@/hooks/useOfficePass';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Lazy load FaceCapture to reduce initial bundle (includes heavy face-api.js)
const FaceCapture = lazy(() => import('@/components/FaceCapture').then(m => ({ default: m.FaceCapture })));

const EmployeeLogin: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [pendingAction, setPendingAction] = useState<'checkin' | 'checkout' | 'dashboard' | null>(null);
  const [verificationStep, setVerificationStep] = useState<'face' | 'location' | null>(null);
  const { toast } = useToast();
  
  const {
    isVerifying: isVerifyingLocation,
    ipAllowed,
    locationAllowed,
    error: locationError,
    verifyLocation,
    reset: resetLocation,
  } = useLocationVerification();
  const {
    status: officeGateStatus,
    checkOfficePass,
    getValidPass,
    resetOfficePass,
  } = useOfficePass();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLookup = async () => {
    if (!employeeId.trim()) return;
    
    setIsLoading(true);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Request timed out",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    }, 10000); // 10 second timeout
    
    try {
      const searchId = employeeId.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      // Fetch employee from database
      const { data: employees, error } = await supabase
        .from('employees')
        .select('*');
      
      clearTimeout(timeoutId);
      
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
          faceDescriptor: employee.face_descriptor as number[][] | null,
          weekendDays: employee.weekend_days || [5, 6],
        };
        
        setCurrentEmployee(mappedEmployee);
        sessionStorage.setItem('currentEmployeeId', employee.employee_id);
        const pass = await checkOfficePass();
        if (!pass) {
          toast({
            title: "Office network required",
            description: "Please connect to the office network to access attendance features.",
            variant: "destructive",
          });
        }
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
      clearTimeout(timeoutId);
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

  const performCheckOut = async () => {
    if (!currentEmployee) return;
    
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

  // Start verification flow for check-in/check-out
  const startAttendanceAction = (action: 'checkin' | 'checkout') => {
    if (!currentEmployee) return;

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
    if (currentEmployee.faceDescriptor && currentEmployee.faceDescriptor.length > 0) {
      setVerificationStep('face');
      setShowFaceVerification(true);
    } else {
      // No face data, go directly to location verification
      setVerificationStep('location');
      performLocationVerification(action);
    }
  };

  // Start dashboard access flow (face verification only)
  const startDashboardAccess = () => {
    if (!currentEmployee) return;

    if (officeGateStatus !== 'allowed') {
      toast({
        title: "Office network required",
        description: "Please connect to the office network to access the dashboard.",
        variant: "destructive",
      });
      return;
    }

    // If employee has face data, require face verification for dashboard
    if (currentEmployee.faceDescriptor && currentEmployee.faceDescriptor.length > 0) {
      setPendingAction('dashboard');
      setVerificationStep('face');
      setShowFaceVerification(true);
    } else {
      // No face data, allow dashboard access directly
      window.location.href = '/employee/dashboard';
    }
  };

  const handleFaceVerified = async (match: boolean, distance: number) => {
    if (match) {
      setShowFaceVerification(false);
      
      if (pendingAction === 'dashboard') {
        // Dashboard access only needs face verification
        setPendingAction(null);
        setVerificationStep(null);
        window.location.href = '/employee/dashboard';
      } else if (pendingAction === 'checkin' || pendingAction === 'checkout') {
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

  const handleReset = () => {
    setCurrentEmployee(null);
    setEmployeeId('');
    sessionStorage.removeItem('currentEmployeeId');
    setPendingAction(null);
    setVerificationStep(null);
    resetLocation();
    resetOfficePass();
  };

  const cancelVerification = () => {
    setShowFaceVerification(false);
    setPendingAction(null);
    setVerificationStep(null);
    resetLocation();
  };

  // Determine connection status based on location verification results
  const isConnected = officeGateStatus === 'allowed' ? true : officeGateStatus === 'blocked' ? false : ipAllowed !== false;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        {/* Admin Portal Link */}
        <div className="absolute -top-12 right-0">
          <Link to="/admin/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Admin Portal →
          </Link>
        </div>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <User className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AttendanceHub</h1>
          <p className="text-muted-foreground text-sm mt-1">Employee Check-In Portal</p>
        </div>

        {/* Connection/Location Status */}
        <div className="flex justify-center gap-2 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            isConnected 
              ? 'bg-accent text-accent-foreground' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="font-medium">Network OK</span>
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
                  disabled={isLoading || !employeeId.trim()}
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
                      {currentEmployee.faceDescriptor && currentEmployee.faceDescriptor.length > 0 && (
                        <span className="inline-flex items-center gap-1 ml-2 text-primary">
                          <Camera className="w-3 h-3" />
                          Face ID ({currentEmployee.faceDescriptor.length})
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

                {/* Verification requirements notice */}
                {currentEmployee.status !== 'checked-in' && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-primary flex items-center justify-center gap-2 flex-wrap">
                      {currentEmployee.faceDescriptor && currentEmployee.faceDescriptor.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          Face verification
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Location check
                      </span>
                      <span className="flex items-center gap-1">
                        <Wifi className="w-3 h-3" />
                        IP verification
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      Required for check-in/out
                    </p>
                  </div>
                )}

                {/* Location verification in progress */}
                {verificationStep === 'location' && isVerifyingLocation && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Verifying location...</span>
                    </div>
                  </div>
                )}

                {/* Location error display */}
                {locationError && verificationStep === 'location' && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-sm text-destructive">{locationError}</span>
                    </div>
                  </div>
                )}

                {/* Check In/Out Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => startAttendanceAction('checkin')}
                    disabled={officeGateStatus !== 'allowed' || currentEmployee.status === 'checked-in' || isVerifyingLocation}
                    className="h-14 text-base"
                    variant={currentEmployee.status === 'checked-in' ? 'outline' : 'default'}
                  >
                    {isVerifyingLocation && pendingAction === 'checkin' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-5 h-5 mr-2" />
                        Check In
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => startAttendanceAction('checkout')}
                    disabled={officeGateStatus !== 'allowed' || currentEmployee.status !== 'checked-in' || isVerifyingLocation}
                    variant="outline"
                    className="h-14 text-base"
                  >
                    {isVerifyingLocation && pendingAction === 'checkout' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <LogOut className="w-5 h-5 mr-2" />
                        Check Out
                      </>
                    )}
                  </Button>
                </div>

                {/* Dashboard Link */}
                <Button 
                  variant="secondary" 
                  className="w-full h-11"
                  onClick={startDashboardAccess}
                  disabled={officeGateStatus !== 'allowed'}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  View My Dashboard
                  {currentEmployee.faceDescriptor && (
                    <Camera className="w-3 h-3 ml-2 opacity-70" />
                  )}
                </Button>
                
                {currentEmployee.faceDescriptor && (
                  <p className="text-xs text-muted-foreground text-center">
                    Face verification required for dashboard access
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Link */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/admin/login" className="hover:text-primary transition-colors">
            Admin Login →
          </Link>
        </p>
      </div>

      {/* Face Verification Dialog */}
      <Dialog open={showFaceVerification} onOpenChange={(open) => !open && cancelVerification()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Face Verification</DialogTitle>
            <DialogDescription>
              {pendingAction === 'dashboard' 
                ? "Please verify your identity to access your dashboard."
                : "Please look at the camera to verify your identity before checking in/out."
              }
            </DialogDescription>
          </DialogHeader>
          {currentEmployee?.faceDescriptor && currentEmployee.faceDescriptor.length > 0 && (
            <Suspense fallback={
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }>
              <FaceCapture
                mode="verify"
                existingDescriptors={currentEmployee.faceDescriptor}
                onCapture={() => {}}
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

export default EmployeeLogin;
