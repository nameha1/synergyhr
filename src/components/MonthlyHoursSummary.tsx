import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/employee';
import { toast } from 'sonner';

interface HoursRow {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  workedHours: number;
  expectedHours: number;
  missingHours: number;
}

const pad = (value: number) => String(value).padStart(2, '0');

const formatHours = (hours: number) => {
  if (!Number.isFinite(hours)) return '0.0';
  return hours.toFixed(1);
};

const getMonthRange = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(date.getDate())}`;
  return { year, month, startDate, endDate };
};

const buildDateLabel = (year: number, month: number) => {
  return new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export const MonthlyHoursSummary = ({ employees }: { employees: Employee[] }) => {
  const [rows, setRows] = useState<HoursRow[]>([]);
  const [loading, setLoading] = useState(false);

  const { year, month, startDate, endDate } = useMemo(() => getMonthRange(new Date()), []);
  const monthLabel = useMemo(() => buildDateLabel(year, month), [year, month]);

  useEffect(() => {
    if (employees.length === 0) {
      setRows([]);
      return;
    }

    const fetchMonthlyHours = async () => {
      setLoading(true);
      try {
        const [{ data: attendanceRecords, error: attendanceError }, { data: holidayRecords, error: holidayError }] =
          await Promise.all([
            supabase
              .from('attendance_records')
              .select('employee_id, date, check_in_time, check_out_time')
              .gte('date', startDate)
              .lte('date', endDate),
            supabase
              .from('holidays')
              .select('date')
              .gte('date', startDate)
              .lte('date', endDate),
          ]);

        if (attendanceError) throw attendanceError;
        if (holidayError) throw holidayError;

        const holidaySet = new Set((holidayRecords || []).map((record) => record.date));
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();
        const workedMap = new Map<string, number>();

        (attendanceRecords || []).forEach((record) => {
          if (!record.check_in_time) return;
          const start = new Date(record.check_in_time);
          let end: Date | null = null;

          if (record.check_out_time) {
            end = new Date(record.check_out_time);
          } else if (record.date === todayStr) {
            end = now;
          }

          if (!end || Number.isNaN(end.getTime())) return;

          const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
          const previous = workedMap.get(record.employee_id) || 0;
          workedMap.set(record.employee_id, previous + hours);
        });

        const computedRows = employees.map((employee) => {
          const weekendDays = employee.weekendDays || [5, 6];
          const workingHoursPerDay = employee.workingHoursPerDay ?? 8;
          let workingDays = 0;

          const daysSoFar = new Date(year, month + 1, 0).getDate();
          for (let day = 1; day <= daysSoFar; day += 1) {
            const date = new Date(year, month, day);
            if (date > now) break;
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            if (holidaySet.has(dateStr)) continue;
            if (weekendDays.includes(date.getDay())) continue;
            workingDays += 1;
          }

          const expectedHours = workingDays * workingHoursPerDay;
          const workedHours = workedMap.get(employee.id) || 0;
          const missingHours = Math.max(0, expectedHours - workedHours);

          return {
            id: employee.id,
            name: employee.name,
            employeeId: employee.employeeId,
            department: employee.department,
            workedHours,
            expectedHours,
            missingHours,
          };
        });

        setRows(computedRows);
      } catch (error) {
        console.error('Error fetching monthly hours:', error);
        toast.error('Failed to load monthly hours');
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyHours();
  }, [employees, endDate, month, startDate, year]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Monthly Hours Summary</h2>
        <p className="text-sm text-muted-foreground">
          Worked hours vs expected hours for {monthLabel}. Holidays are excluded.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Worked</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Shortfall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  Loading monthly hours...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  No employees available.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{row.name}</span>
                      <span className="text-xs text-muted-foreground">{row.employeeId}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.department}</TableCell>
                  <TableCell className="text-right text-sm">{formatHours(row.workedHours)}h</TableCell>
                  <TableCell className="text-right text-sm">{formatHours(row.expectedHours)}h</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.missingHours > 0 ? 'destructive' : 'secondary'}>
                      {formatHours(row.missingHours)}h
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
