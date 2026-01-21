"use client";

import { useState, useEffect } from 'react';
import { Calendar, PartyPopper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Holiday {
  id: string;
  date: string;
  name: string | null;
}

export const EmployeeHolidaysView = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('holidays')
          .select('*')
          .gte('date', today)
          .order('date', { ascending: true });

        if (error) throw error;
        setHolidays(data || []);
      } catch (error) {
        console.error('Error fetching holidays:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const holiday = new Date(dateStr);
    const diffTime = holiday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <PartyPopper className="w-4 h-4" />
          Upcoming Holidays
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {holidays.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming holidays</p>
          </div>
        ) : (
          <div className="space-y-2">
            {holidays.slice(0, 5).map((holiday) => {
              const daysUntil = getDaysUntil(holiday.date);
              return (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {holiday.name || 'Holiday'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(holiday.date)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={daysUntil === 0 ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {daysUntil === 0
                      ? 'Today!'
                      : daysUntil === 1
                      ? 'Tomorrow'
                      : `${daysUntil} days`}
                  </Badge>
                </div>
              );
            })}
            {holidays.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{holidays.length - 5} more holidays this year
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
