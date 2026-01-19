import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mockEmployees } from '@/data/mockEmployees';

const EmployeeLogin: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Mock employee lookup - replace with Firebase later
    setTimeout(() => {
      const employee = mockEmployees.find(emp => emp.employeeId === employeeId.toUpperCase());
      
      if (employee) {
        // Store employee ID in sessionStorage for demo
        sessionStorage.setItem('currentEmployeeId', employee.employeeId);
        toast({
          title: `Welcome, ${employee.name}!`,
          description: "You've successfully signed in.",
        });
        navigate('/employee/dashboard');
      } else {
        toast({
          title: "Employee not found",
          description: "Please check your Employee ID and try again.",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary/50 mb-4">
            <User className="w-8 h-8 text-secondary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AttendanceHub</h1>
          <p className="text-muted-foreground mt-1">Employee Portal</p>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Employee Sign In</CardTitle>
            <CardDescription>
              Enter your Employee ID to view your attendance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  type="text"
                  placeholder="e.g., EMP001"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  required
                  className="h-11 font-mono tracking-wider"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'View My Attendance'
                )}
              </Button>
            </form>

            {/* Demo hint */}
            <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground text-center">
                <span className="font-medium">Demo IDs:</span> EMP001, EMP002, EMP003, EMP004, EMP005
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Admin link */}
        <div className="mt-6 text-center">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Admin Login
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Protected by office IP authentication
        </p>
      </div>
    </div>
  );
};

export default EmployeeLogin;
