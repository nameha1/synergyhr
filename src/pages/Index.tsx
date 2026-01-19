import { useState, useMemo } from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { Header } from '@/components/Header';
import { StatsCard } from '@/components/StatsCard';
import { EmployeeCard } from '@/components/EmployeeCard';
import { AddEmployeeDialog } from '@/components/AddEmployeeDialog';
import { SearchFilter } from '@/components/SearchFilter';
import { mockEmployees } from '@/data/mockEmployees';
import { Employee, AttendanceStats } from '@/types/employee';

const Index = () => {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

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

  const handleCheckIn = (id: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === id
          ? { ...emp, status: 'checked-in' as const, checkInTime: timeString, checkOutTime: undefined }
          : emp
      )
    );
  };

  const handleCheckOut = (id: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === id
          ? { ...emp, status: 'checked-out' as const, checkOutTime: timeString }
          : emp
      )
    );
  };

  const handleAddEmployee = (newEmployee: {
    name: string;
    email: string;
    department: string;
    employeeId: string;
  }) => {
    const employee: Employee = {
      id: Date.now().toString(),
      ...newEmployee,
      status: 'absent',
    };
    setEmployees((prev) => [...prev, employee]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isConnected={true} ipAddress="192.168.1.100" />

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
            <AddEmployeeDialog onAdd={handleAddEmployee} />
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
