import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PolicyFile {
  name: string;
  url: string;
  createdAt: string;
}

export const HRPolicyViewer = () => {
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyFile[]>([]);

  const fetchPolicies = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('hr-policies')
        .list('', { sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;

      const policyFiles: PolicyFile[] = (data || [])
        .filter(file => file.name.endsWith('.pdf'))
        .map(file => ({
          name: file.name,
          url: supabase.storage.from('hr-policies').getPublicUrl(file.name).data.publicUrl,
          createdAt: file.created_at || '',
        }));

      setPolicies(policyFiles);
    } catch (error) {
      console.error('Error fetching policies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (policies.length === 0) {
    return null; // Don't show card if no policies
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          HR Policies
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-2">
          {policies.map((policy) => (
            <div
              key={policy.name}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {policy.name.replace(/^\d+_/, '')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(policy.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(policy.url, '_blank')}
                className="gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
