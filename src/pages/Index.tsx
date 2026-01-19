import { useState, useMemo, useEffect } from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { Header } from '@/components/Header';
import { StatsCard } from '@/components/StatsCard';
import { EmployeeCard } from '@/components/EmployeeCard';
import { AddEmployeeDialog } from '@/components/AddEmployeeDialog';
import { DepartmentManagementDialog } from '@/components/DepartmentManagementDialog';
import { SearchFilter } from '@/components/SearchFilter';
import { supabase } from '@/integrations/supabase/client';
import { Employee, AttendanceStats } from '@/types/employee';
import { toast } from 'sonner';

// Map database employee to frontend Employee type
const mapDbEmployee = (dbEmployee: any): Employee => ({
  id: dbEmployee.id,
  employeeId: dbEmployee.employee_id,
  name: dbEmployee.name,
  email: dbEmployee.email,
  department: dbEmployee.department,
  avatar: dbEmployee.avatar_url,
  status: 'absent', // Will be updated based on today's attendance
  workStartTime: dbEmployee.work_start_time,
  workEndTime: dbEmployee.work_end_time,
  workingHoursPerDay: dbEmployee.working_hours_per_day,
  lateThresholdMinutes: dbEmployee.late_threshold_minutes,
});

const Index = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const fetchEmployees = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (employeesError) throw employeesError;

      // Fetch today's attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('date', today);

      if (attendanceError) throw attendanceError;

      // Map attendance to employees
      const attendanceMap = new Map(
        attendanceData?.map((a) => [a.employee_id, a]) || []
      );

      const mappedEmployees = employeesData?.map((emp) => {
        const attendance = attendanceMap.get(emp.id);
        const employee = mapDbEmployee(emp);
        
        if (attendance) {
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
    fetchEmployees();
  }, []);

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
    const today = new Date().toISOString().split('T')[0];
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
      fetchEmployees();
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Failed to check in');
    }
  };

  const handleCheckOut = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({ check_out_time: now })
        .eq('employee_id', id)
        .eq('date', today);

      if (error) throw error;

      toast.success('Checked out successfully');
      fetchEmployees();
    } catch (error) {
      console.error('Error checking out:', error);
      toast.error('Failed to check out');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header isConnected={true} ipAddress="Connected" />
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
      <Header isConnected={true} ipAddress="Connected" />

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
              <DepartmentManagementDialog onUpdate={fetchEmployees} />
              <AddEmployeeDialog onAdd={fetchEmployees} />
            </div>
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

          <div className="grid gap-4 md:grid-cols-2">
            {filteredEmployees.map((employee, index) => (
              <div key={employee.id} style={{ animationDelay: `${index * 50}ms` }}>
                <EmployeeCard
                  employee={employee}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  onScheduleUpdate={fetchEmployees}
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
      </main>
    </div>
  );
};

export default Index;
