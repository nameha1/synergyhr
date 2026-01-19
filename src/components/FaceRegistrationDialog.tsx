import React, { useState } from 'react';
import { Camera, User, Trash2, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MultiFaceCapture } from './MultiFaceCapture';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface FaceRegistrationDialogProps {
  employeeId: string;
  employeeName: string;
  hasFaceData: boolean;
  faceDataCount?: number;
  onUpdate: () => void;
}

export const FaceRegistrationDialog: React.FC<FaceRegistrationDialogProps> = ({
  employeeId,
  employeeName,
  hasFaceData,
  faceDataCount = 0,
  onUpdate,
}) => {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCapture = async (descriptors: number[][]) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ face_descriptor: descriptors })
        .eq('id', employeeId);

      if (error) throw error;

      toast.success(`${descriptors.length} face angles registered for ${employeeName}`);
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
                <Images className="w-4 h-4" />
                Update Face
                {faceDataCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {faceDataCount}
                  </Badge>
                )}
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register Face - {employeeName}</DialogTitle>
          <DialogDescription>
            Capture multiple face angles for better recognition accuracy. 
            We recommend capturing at least 3 different angles (front, left, right).
          </DialogDescription>
        </DialogHeader>
        <MultiFaceCapture
          onComplete={handleCapture}
          onCancel={() => setOpen(false)}
          minCaptures={3}
        />
      </DialogContent>
    </Dialog>
  );
};
