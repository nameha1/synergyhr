import { Wifi, WifiOff, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  isConnected: boolean;
  ipAddress: string;
}

export const Header = ({ isConnected, ipAddress }: HeaderProps) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Attendance Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track employee attendance in real-time</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            isConnected 
              ? 'bg-accent text-accent-foreground' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="font-medium">Office IP: {ipAddress}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="font-medium">Not Connected</span>
              </>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
