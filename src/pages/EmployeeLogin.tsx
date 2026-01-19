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
  WifiOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mockEmployees } from '@/data/mockEmployees';
import { Employee } from '@/types/employee';

const EmployeeLogin: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLookup = () => {
    if (!employeeId.trim()) return;
    
    setIsLoading(true);
    setTimeout(() => {
      const searchId = employeeId.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const employee = mockEmployees.find(emp => {
        const normalizedEmpId = emp.employeeId.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return normalizedEmpId === searchId;
      });
      
      if (employee) {
        setCurrentEmployee(employee);
        sessionStorage.setItem('currentEmployeeId', employee.employeeId);
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
      setIsLoading(false);
    }, 500);
  };

  const handleCheckIn = () => {
    if (currentEmployee) {
      const updatedEmployee = {
        ...currentEmployee,
        status: 'checked-in' as const,
        checkInTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setCurrentEmployee(updatedEmployee);
      toast({
        title: "Checked In Successfully!",
        description: `Welcome to work at ${updatedEmployee.checkInTime}`,
      });
    }
  };

  const handleCheckOut = () => {
    if (currentEmployee) {
      const updatedEmployee = {
        ...currentEmployee,
        status: 'checked-out' as const,
        checkOutTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setCurrentEmployee(updatedEmployee);
      toast({
        title: "Checked Out Successfully!",
        description: `See you tomorrow! Checked out at ${updatedEmployee.checkOutTime}`,
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
                    <span className="font-medium">Demo IDs:</span> EMP-001, EMP-002, EMP-003, EMP-004, EMP-005
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
                    <p className="text-xs text-muted-foreground">{currentEmployee.department} • {currentEmployee.employeeId}</p>
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

                {/* Check In/Out Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleCheckIn}
                    disabled={currentEmployee.status === 'checked-in' || !isConnected}
                    className="h-14 text-base"
                    variant={currentEmployee.status === 'checked-in' ? 'outline' : 'default'}
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    Check In
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
    </div>
  );
};

export default EmployeeLogin;
