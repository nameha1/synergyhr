import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Coffee,
  Wifi,
  WifiOff,
  Building2
} from 'lucide-react';
import { mockEmployees } from '@/data/mockEmployees';
import { Employee } from '@/types/employee';
import { useToast } from '@/hooks/use-toast';

const EmployeeDashboard: React.FC = () => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const employeeId = sessionStorage.getItem('currentEmployeeId');
    if (!employeeId) {
      navigate('/employee');
      return;
    }
    
    const found = mockEmployees.find(emp => emp.employeeId === employeeId);
    if (found) {
      setEmployee(found);
    } else {
      navigate('/employee');
    }
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('currentEmployeeId');
    navigate('/employee');
  };

  const handleCheckIn = () => {
    if (employee) {
      setEmployee({
        ...employee,
        status: 'checked-in',
        checkInTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
      toast({
        title: "Checked In!",
        description: `Welcome to work, ${employee.name.split(' ')[0]}!`,
      });
    }
  };

  const handleCheckOut = () => {
    if (employee) {
      setEmployee({
        ...employee,
        status: 'checked-out',
        checkOutTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
      toast({
        title: "Checked Out!",
        description: "Have a great rest of your day!",
      });
    }
  };

  if (!employee) {
    return null;
  }

  const statusConfig = {
    'checked-in': { icon: CheckCircle2, label: 'Checked In', color: 'bg-accent text-accent-foreground' },
    'checked-out': { icon: XCircle, label: 'Checked Out', color: 'bg-muted text-muted-foreground' },
    'on-break': { icon: Coffee, label: 'On Break', color: 'bg-secondary text-secondary-foreground' },
    'absent': { icon: XCircle, label: 'Absent', color: 'bg-destructive/10 text-destructive' },
  };

  const currentStatus = statusConfig[employee.status];
  const StatusIcon = currentStatus.icon;

  // Mock attendance history
  const attendanceHistory = [
    { date: 'Today', checkIn: employee.checkInTime || '--:--', checkOut: employee.checkOutTime || '--:--', hours: employee.checkInTime ? '8h 30m' : '--' },
    { date: 'Yesterday', checkIn: '09:02 AM', checkOut: '06:15 PM', hours: '9h 13m' },
    { date: 'Mon, Jan 13', checkIn: '08:55 AM', checkOut: '05:45 PM', hours: '8h 50m' },
    { date: 'Fri, Jan 10', checkIn: '09:10 AM', checkOut: '06:00 PM', hours: '8h 50m' },
    { date: 'Thu, Jan 9', checkIn: '08:45 AM', checkOut: '05:30 PM', hours: '8h 45m' },
  ];

  // Mock stats
  const stats = {
    totalDays: 22,
    present: 20,
    absent: 1,
    late: 1,
    avgHours: '8h 42m',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{employee.name}</h1>
              <p className="text-sm text-muted-foreground">{employee.department} • {employee.employeeId}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isConnected 
                ? 'bg-accent text-accent-foreground' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4" />
                  <span className="font-medium hidden sm:inline">Office Network</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  <span className="font-medium hidden sm:inline">Not Connected</span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Current Time & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Time Card */}
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Current Time</span>
              </div>
              <div className="text-4xl font-bold text-foreground font-mono">
                {currentTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Your Status</span>
                </div>
                <Badge className={currentStatus.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {currentStatus.label}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Check In</p>
                  <p className="text-lg font-semibold text-foreground">
                    {employee.checkInTime || '--:--'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Check Out</p>
                  <p className="text-lg font-semibold text-foreground">
                    {employee.checkOutTime || '--:--'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                {employee.status !== 'checked-in' && (
                  <Button 
                    onClick={handleCheckIn} 
                    className="flex-1"
                    disabled={!isConnected}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Check In
                  </Button>
                )}
                {employee.status === 'checked-in' && (
                  <Button 
                    onClick={handleCheckOut} 
                    variant="outline" 
                    className="flex-1"
                    disabled={!isConnected}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Check Out
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Stats */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              This Month's Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Working Days</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalDays}</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/30">
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-2xl font-bold text-accent-foreground">{stats.present}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-destructive">{stats.absent}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Late</p>
                <p className="text-2xl font-bold text-secondary-foreground">{stats.late}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground">Avg Hours</p>
                <p className="text-2xl font-bold text-primary">{stats.avgHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance History */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attendanceHistory.map((record, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      record.checkIn !== '--:--' ? 'bg-accent' : 'bg-muted'
                    }`} />
                    <span className="font-medium text-foreground">{record.date}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <span className="text-muted-foreground">In: </span>
                      <span className="font-mono text-foreground">{record.checkIn}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">Out: </span>
                      <span className="font-mono text-foreground">{record.checkOut}</span>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <span className="font-medium text-primary">{record.hours}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
