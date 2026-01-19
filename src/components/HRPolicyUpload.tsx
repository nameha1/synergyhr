import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PolicyFile {
  name: string;
  url: string;
  createdAt: string;
}

export const HRPolicyUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('hr-policies')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      toast.success('HR Policy uploaded successfully');
      fetchPolicies();
    } catch (error: any) {
      console.error('Error uploading:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      const { error } = await supabase.storage
        .from('hr-policies')
        .remove([fileName]);

      if (error) throw error;

      toast.success('Policy deleted');
      fetchPolicies();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete file');
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="w-4 h-4" />
            HR Policies
          </CardTitle>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept=".pdf"
              className="hidden"
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-1" />
              )}
              Upload PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : policies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No HR policies uploaded yet</p>
          </div>
        ) : (
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(policy.url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(policy.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
