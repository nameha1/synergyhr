import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Pencil } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface DepartmentManagementDialogProps {
  onUpdate?: () => void;
}

export const DepartmentManagementDialog = ({ onUpdate }: DepartmentManagementDialogProps) => {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDepartments();
    }
  }, [open]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a department name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('departments').insert({
        name: newName.trim(),
        description: newDescription.trim() || null,
      });

      if (error) throw error;

      toast.success('Department added successfully');
      setNewName('');
      setNewDescription('');
      fetchDepartments();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error adding department:', error);
      if (error.code === '23505') {
        toast.error('Department already exists');
      } else {
        toast.error('Failed to add department');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      toast.error('Please enter a department name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('departments')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Department updated successfully');
      setEditingId(null);
      fetchDepartments();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating department:', error);
      if (error.code === '23505') {
        toast.error('Department name already exists');
      } else {
        toast.error('Failed to update department');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);

      if (error) throw error;

      toast.success('Department deleted successfully');
      fetchDepartments();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Failed to delete department');
    }
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditDescription(dept.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Manage Departments
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Departments</DialogTitle>
          <DialogDescription>
            Add, edit, or remove department categories for employees.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add new department */}
          <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
            <h4 className="font-medium text-sm">Add New Department</h4>
            <div className="grid gap-2">
              <Label htmlFor="newName">Name *</Label>
              <Input
                id="newName"
                placeholder="e.g., Engineering"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newDescription">Description</Label>
              <Textarea
                id="newDescription"
                placeholder="Optional description..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={handleAdd} disabled={isSubmitting} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Department
            </Button>
          </div>

          {/* List existing departments */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">
              Existing Departments ({departments.length})
            </h4>

            {loading ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading...
              </div>
            ) : departments.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No departments yet. Add one above.
              </div>
            ) : (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="p-3 border border-border rounded-lg bg-background"
                  >
                    {editingId === dept.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Department name"
                        />
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description (optional)"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdate(dept.id)}
                            disabled={isSubmitting}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{dept.name}</p>
                          {dept.description && (
                            <p className="text-sm text-muted-foreground">
                              {dept.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => startEdit(dept)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(dept.id, dept.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
