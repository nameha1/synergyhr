import React, { useState } from 'react';
import { Camera, User, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FaceCapture } from './FaceCapture';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FaceRegistrationDialogProps {
  employeeId: string;
  employeeName: string;
  hasFaceData: boolean;
  onUpdate: () => void;
}

export const FaceRegistrationDialog: React.FC<FaceRegistrationDialogProps> = ({
  employeeId,
  employeeName,
  hasFaceData,
  onUpdate,
}) => {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCapture = async (descriptor: number[]) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ face_descriptor: descriptor })
        .eq('id', employeeId);

      if (error) throw error;

      toast.success(`Face registered for ${employeeName}`);
      setOpen(false);
      onUpdate();
    } catch (err) {
      console.error('Error saving face data:', err);
      toast.error('Failed to save face data');
    }
  };

  const handleDeleteFace = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ face_descriptor: null })
        .eq('id', employeeId);

      if (error) throw error;

      toast.success('Face data removed');
      onUpdate();
    } catch (err) {
      console.error('Error deleting face data:', err);
      toast.error('Failed to remove face data');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {hasFaceData ? (
              <>
                <User className="w-4 h-4" />
                Update Face
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Register Face
              </>
            )}
          </Button>
        </DialogTrigger>
        {hasFaceData && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteFace}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register Face - {employeeName}</DialogTitle>
          <DialogDescription>
            Capture the employee's face for check-in verification. Ensure good lighting and a clear view of the face.
          </DialogDescription>
        </DialogHeader>
        <FaceCapture
          onCapture={handleCapture}
          onCancel={() => setOpen(false)}
          mode="register"
        />
      </DialogContent>
    </Dialog>
  );
};
