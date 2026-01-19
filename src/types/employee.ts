export type AttendanceStatus = 'checked-in' | 'checked-out' | 'absent';

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  avatar?: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  // Work schedule settings
  workStartTime?: string;
  workEndTime?: string;
  workingHoursPerDay?: number;
  lateThresholdMinutes?: number;
  // Facial recognition
  faceDescriptor?: number[] | null;
}

export interface AttendanceStats {
  total: number;
  checkedIn: number;
  checkedOut: number;
  absent: number;
}
