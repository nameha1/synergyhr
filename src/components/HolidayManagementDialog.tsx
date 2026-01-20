import { useEffect, useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Holiday {
  id: string;
  date: string;
  name: string | null;
}

export const HolidayManagementDialog = () => {
  const [open, setOpen] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchHolidays();
    }
  }, [open]);

  const handleAdd = async () => {
    if (!holidayDate) {
      toast.error('Please select a holiday date');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('holidays').insert({
        date: holidayDate,
        name: holidayName.trim() || null,
      });

      if (error) throw error;

      toast.success('Holiday added');
      setHolidayDate('');
      setHolidayName('');
      fetchHolidays();
    } catch (error: unknown) {
      console.error('Error adding holiday:', error);
      const err = error as { code?: string };
      if (err?.code === '23505') {
        toast.error('Holiday already exists for this date');
      } else {
        toast.error('Failed to add holiday');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (holiday: Holiday) => {
    if (!confirm(`Delete holiday on ${holiday.date}?`)) return;

    try {
      const { error } = await supabase.from('holidays').delete().eq('id', holiday.id);
      if (error) throw error;

      toast.success('Holiday removed');
      fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarPlus className="w-4 h-4" />
          Manage Holidays
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>General Holidays</DialogTitle>
          <DialogDescription>
            Add company-wide holidays so they do not count toward absences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
            <h4 className="font-medium text-sm">Add Holiday</h4>
            <div className="grid gap-2">
              <Label htmlFor="holidayDate">Date *</Label>
              <Input
                id="holidayDate"
                type="date"
                value={holidayDate}
                onChange={(event) => setHolidayDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="holidayName">Name</Label>
              <Input
                id="holidayName"
                placeholder="e.g., Independence Day"
                value={holidayName}
                onChange={(event) => setHolidayName(event.target.value)}
              />
            </div>
            <Button onClick={handleAdd} disabled={isSubmitting} className="gap-2">
              <CalendarPlus className="w-4 h-4" />
              Add Holiday
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Existing Holidays ({holidays.length})</h4>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No holidays added yet.
              </div>
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[70px] text-right">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="text-sm">{holiday.date}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {holiday.name || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(holiday)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
