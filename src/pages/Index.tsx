import { useState, useMemo, useEffect } from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { Header } from '@/components/Header';
import { StatsCard } from '@/components/StatsCard';
import { EmployeeCard } from '@/components/EmployeeCard';
import { AddEmployeeDialog } from '@/components/AddEmployeeDialog';
import { DepartmentManagementDialog } from '@/components/DepartmentManagementDialog';
import { OfficeSettingsDialog } from '@/components/OfficeSettingsDialog';
import { HolidayManagementDialog } from '@/components/HolidayManagementDialog';
import { SearchFilter } from '@/components/SearchFilter';
import { HRPolicyUpload } from '@/components/HRPolicyUpload';
import { MonthlyHoursSummary } from '@/components/MonthlyHoursSummary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Employee, AttendanceStats, AttendanceStatus } from '@/types/employee';
import { useLocationVerification } from '@/hooks/useLocationVerification';
import { toast } from 'sonner';

// Map database employee to frontend Employee type
type DbEmployee = {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  avatar_url?: string | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
  working_hours_per_day?: number | null;
  late_threshold_minutes?: number | null;
  face_descriptor?: number[][] | null;
  weekend_days?: string[] | null;
};

const mapDbEmployee = (dbEmployee: DbEmployee): Employee => ({
  id: dbEmployee.id,
  employeeId: dbEmployee.employee_id,
  name: dbEmployee.name,
  email: dbEmployee.email,
  department: dbEmployee.department,
  avatar: dbEmployee.avatar_url,
  status: 'absent', // Will be updated based on the selected date's attendance
  isLate: false,
  workStartTime: dbEmployee.work_start_time,
  workEndTime: dbEmployee.work_end_time,
  workingHoursPerDay: dbEmployee.working_hours_per_day,
  lateThresholdMinutes: dbEmployee.late_threshold_minutes,
  faceDescriptor: dbEmployee.face_descriptor,
  weekendDays: dbEmployee.weekend_days,
});

const Index = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const getToday = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(getToday);
  const {
    isVerifying: isVerifyingLocation,
    ipAllowed,
    locationAllowed,
    currentIp,
    error: locationError,
    verifyLocation,
  } = useLocationVerification();

  const fetchEmployees = async (date?: string) => {
    try {
      const targetDate = date ?? selectedDate ?? getToday();
      
      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (employeesError) throw employeesError;

      // Fetch attendance for the selected date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('date', targetDate);

      if (attendanceError) throw attendanceError;

      // Map attendance to employees
      const attendanceMap = new Map(
        attendanceData?.map((a) => [a.employee_id, a]) || []
      );

      const mappedEmployees = employeesData?.map((emp) => {
        const attendance = attendanceMap.get(emp.id);
        const employee = mapDbEmployee(emp);
        
        if (attendance) {
          employee.attendanceId = attendance.id;
          employee.isLate = attendance.is_late;
          if (attendance.check_out_time) {
            employee.status = 'checked-out';
            employee.checkOutTime = new Date(attendance.check_out_time).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
          } else if (attendance.check_in_time) {
            employee.status = 'checked-in';
          }
          if (attendance.check_in_time) {
            employee.checkInTime = new Date(attendance.check_in_time).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
          }
        }
        
        return employee;
      }) || [];

      setEmployees(mappedEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    verifyLocation();
  }, [verifyLocation]);

  useEffect(() => {
    if (locationError) {
      toast.error(locationError);
    }
  }, [locationError]);

  const departments = useMemo(() => {
    return [...new Set(employees.map((emp) => emp.department))];
  }, [employees]);

  const stats: AttendanceStats = useMemo(() => {
    return {
      total: employees.length,
      checkedIn: employees.filter((emp) => emp.status === 'checked-in').length,
      checkedOut: employees.filter((emp) => emp.status === 'checked-out').length,
      absent: employees.filter((emp) => emp.status === 'absent').length,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
      const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [employees, searchQuery, statusFilter, departmentFilter]);

  const handleCheckIn = async (id: string) => {
    const today = getToday();
    if (selectedDate !== today) {
      toast.error('Check-ins are only available for today.');
      return;
    }
    const now = new Date().toISOString();
    const employee = employees.find((e) => e.id === id);
    
    if (!employee) return;

    // Check if late
    const workStart = employee.workStartTime || '09:00:00';
    const lateThreshold = employee.lateThresholdMinutes || 15;
    const [hours, minutes] = workStart.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes + lateThreshold, 0, 0);
    const isLate = new Date() > startTime;

    try {
      const { error } = await supabase.from('attendance_records').upsert({
        employee_id: id,
        date: today,
        check_in_time: now,
        status: isLate ? 'late' : 'present',
        is_late: isLate,
      });

      if (error) throw error;

      toast.success(isLate ? 'Checked in (Late)' : 'Checked in successfully');
      fetchEmployees(selectedDate);
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Failed to check in');
    }
  };

  const handleCheckOut = async (id: string) => {
    const today = getToday();
    if (selectedDate !== today) {
      toast.error('Check-outs are only available for today.');
      return;
    }
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({ check_out_time: now })
        .eq('employee_id', id)
        .eq('date', today);

      if (error) throw error;

      toast.success('Checked out successfully');
      fetchEmployees(selectedDate);
    } catch (error) {
      console.error('Error checking out:', error);
      toast.error('Failed to check out');
    }
  };

  const handleToggleLate = async (employee: Employee) => {
    const nextIsLate = !employee.isLate;

    try {
      if (employee.attendanceId) {
        const { error } = await supabase
          .from('attendance_records')
          .update({ is_late: nextIsLate, status: nextIsLate ? 'late' : 'present' })
          .eq('id', employee.attendanceId);

        if (error) throw error;
      } else if (nextIsLate) {
        const { error } = await supabase.from('attendance_records').insert({
          employee_id: employee.id,
          date: selectedDate,
          status: 'late',
          is_late: true,
        });

        if (error) throw error;
      } else {
        return;
      }

      toast.success(nextIsLate ? 'Late flag added' : 'Late flag removed');
      fetchEmployees(selectedDate);
    } catch (error) {
      console.error('Error updating late flag:', error);
      toast.error('Failed to update late flag');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // First delete attendance records for this employee
      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .delete()
        .eq('employee_id', id);

      if (attendanceError) throw attendanceError;

      // Then delete the employee
      const { error: employeeError } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (employeeError) throw employeeError;

      toast.success('Employee deleted successfully');
      fetchEmployees(selectedDate);
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
  };

  const statusBadgeConfig: Record<AttendanceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'checked-in': { label: 'Checked In', variant: 'default' },
    'checked-out': { label: 'Checked Out', variant: 'secondary' },
    'absent': { label: 'Absent', variant: 'outline' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header isConnected={null} ipAddress={null} isChecking={true} />
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        isConnected={
          ipAllowed === null && locationAllowed === null
            ? null
            : ipAllowed !== false && locationAllowed !== false
        }
        ipAddress={currentIp}
        isChecking={isVerifyingLocation}
      />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Stats Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Total Employees"
            value={stats.total}
            icon={Users}
            variant="default"
          />
          <StatsCard
            title="Checked In"
            value={stats.checkedIn}
            icon={UserCheck}
            variant="success"
          />
          <StatsCard
            title="Checked Out"
            value={stats.checkedOut}
            icon={Clock}
            variant="warning"
          />
          <StatsCard
            title="Absent"
            value={stats.absent}
            icon={UserX}
            variant="destructive"
          />
        </div>

        <SearchFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          departmentFilter={departmentFilter}
          onDepartmentChange={setDepartmentFilter}
          departments={departments}
        />

        {/* Daily Attendance Table */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Daily Attendance</h2>
              <p className="text-sm text-muted-foreground">
                Viewing attendance for {selectedDate}
              </p>
            </div>
            <div className="w-full sm:w-[220px]">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="attendance-date">
                Select date
              </label>
              <Input
                id="attendance-date"
                type="date"
                value={selectedDate}
                max={getToday()}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  if (nextDate) {
                    setSelectedDate(nextDate);
                  }
                }}
                className="mt-1"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Late Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => {
                  const statusConfig = statusBadgeConfig[employee.status];
                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{employee.name}</span>
                          <span className="text-xs text-muted-foreground">{employee.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{employee.department}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                          {employee.isLate && <Badge variant="destructive">Late</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {employee.checkInTime || '--:--'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {employee.checkOutTime || '--:--'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={employee.isLate ? 'destructive' : 'outline'}
                          onClick={() => handleToggleLate(employee)}
                        >
                          {employee.isLate ? 'Late' : 'Mark Late'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No employees found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Employees Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Employees</h2>
              <p className="text-sm text-muted-foreground">
                {filteredEmployees.length} of {employees.length} employees
              </p>
            </div>
            <div className="flex gap-2">
              <OfficeSettingsDialog />
              <HolidayManagementDialog />
              <DepartmentManagementDialog onUpdate={fetchEmployees} />
              <AddEmployeeDialog onAdd={fetchEmployees} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredEmployees.map((employee, index) => (
              <div key={employee.id} style={{ animationDelay: `${index * 50}ms` }}>
                <EmployeeCard
                  employee={employee}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  onScheduleUpdate={fetchEmployees}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No employees found matching your criteria.</p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <MonthlyHoursSummary employees={employees} />
        </div>

        {/* HR Policy Section */}
        <div className="mt-8">
          <HRPolicyUpload />
        </div>
      </main>
    </div>
  );
};

export default Index;
