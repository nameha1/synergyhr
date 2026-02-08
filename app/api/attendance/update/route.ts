import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { attendanceId, employeeId, date, checkInTime, checkOutTime } = body;

    // For creating new records, we need employeeId and date
    if (!attendanceId && (!employeeId || !date)) {
      return NextResponse.json({ error: 'Employee ID and date are required for creating new records' }, { status: 400 });
    }

    // For updating existing records, we need attendanceId
    if (attendanceId) {
      // Update existing record
      const updateData: {
        check_in_time?: string | null;
        check_out_time?: string | null;
        status?: string;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      if (checkInTime !== undefined) {
        updateData.check_in_time = checkInTime;
      }

      if (checkOutTime !== undefined) {
        updateData.check_out_time = checkOutTime;
      }

      // Update status based on check-in time
      if (checkInTime) {
        updateData.status = 'present';
      }

      const { data, error } = await supabase
        .from('attendance_records')
        .update(updateData)
        .eq('id', attendanceId)
        .select()
        .single();

      if (error) {
        console.error('Error updating attendance:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    } else {
      // Create new record
      const insertData: {
        employee_id: string;
        date: string;
        check_in_time?: string | null;
        check_out_time?: string | null;
        status: string;
      } = {
        employee_id: employeeId,
        date: date,
        status: checkInTime ? 'present' : 'absent',
      };

      if (checkInTime) {
        insertData.check_in_time = checkInTime;
      }

      if (checkOutTime) {
        insertData.check_out_time = checkOutTime;
      }

      const { data, error } = await supabase
        .from('attendance_records')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating attendance:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('Error in attendance update API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
