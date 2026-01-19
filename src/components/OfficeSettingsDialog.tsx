import { useState, useEffect } from 'react';
import { Settings2, MapPin, Wifi, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OfficeLocation {
  latitude: number;
  longitude: number;
  radius_meters: number;
  enabled: boolean;
}

export const OfficeSettingsDialog = () => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // IP Settings
  const [allowedIps, setAllowedIps] = useState<string[]>(['*']);
  const [newIp, setNewIp] = useState('');

  // Location Settings
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('office_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      const ipSetting = data?.find((s) => s.setting_key === 'allowed_ips');
      const locationSetting = data?.find((s) => s.setting_key === 'office_location');

      if (ipSetting?.setting_value) {
        setAllowedIps(ipSetting.setting_value as unknown as string[]);
      }

      if (locationSetting?.setting_value) {
        const loc = locationSetting.setting_value as unknown as OfficeLocation;
        setLocationEnabled(loc.enabled);
        setLatitude(loc.latitude.toString());
        setLongitude(loc.longitude.toString());
        setRadius(loc.radius_meters.toString());
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    if (allowedIps.includes(newIp.trim())) {
      toast.error('IP already in list');
      return;
    }
    // Remove wildcard if adding specific IP
    const updatedIps = allowedIps.filter((ip) => ip !== '*');
    setAllowedIps([...updatedIps, newIp.trim()]);
    setNewIp('');
  };

  const handleRemoveIp = (ip: string) => {
    const updatedIps = allowedIps.filter((i) => i !== ip);
    if (updatedIps.length === 0) {
      updatedIps.push('*');
    }
    setAllowedIps(updatedIps);
  };

  const handleAllowAll = () => {
    setAllowedIps(['*']);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
          toast.success('Current location captured');
        },
        (error) => {
          toast.error('Failed to get location: ' + error.message);
        }
      );
    } else {
      toast.error('Geolocation is not supported by this browser');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Update IP settings
      const { error: ipError } = await supabase
        .from('office_settings')
        .update({ setting_value: allowedIps })
        .eq('setting_key', 'allowed_ips');

      if (ipError) throw ipError;

      // Update location settings
      const locationValue = {
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0,
        radius_meters: parseInt(radius) || 100,
        enabled: locationEnabled,
      };

      const { error: locError } = await supabase
        .from('office_settings')
        .update({ setting_value: locationValue as any })
        .eq('setting_key', 'office_location');

      if (locError) throw locError;

      toast.success('Office settings updated');
      setOpen(false);
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Office Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Office Check-In Settings
          </DialogTitle>
          <DialogDescription>
            Configure IP and location restrictions for employee check-in/check-out.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* IP Address Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" />
                <h3 className="font-medium">IP Address Restrictions</h3>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Enter IP address"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddIp()}
                />
                <Button onClick={handleAddIp} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {allowedIps.map((ip) => (
                  <div
                    key={ip}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <span className="font-mono text-sm">
                      {ip === '*' ? 'All IPs allowed' : ip}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveIp(ip)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {!allowedIps.includes('*') && (
                <Button variant="outline" size="sm" onClick={handleAllowAll}>
                  Allow All IPs
                </Button>
              )}
            </div>

            {/* Geo-Location Settings */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="font-medium">Geo-Location Restrictions</h3>
                </div>
                <Switch
                  checked={locationEnabled}
                  onCheckedChange={setLocationEnabled}
                />
              </div>

              {locationEnabled && (
                <div className="space-y-4 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        placeholder="e.g., 25.2048"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        placeholder="e.g., 55.2708"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="radius">Allowed Radius (meters)</Label>
                    <Input
                      id="radius"
                      type="number"
                      min="10"
                      max="10000"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Employees must be within this distance from the office to check in/out.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGetCurrentLocation}
                    className="gap-2"
                  >
                    <MapPin className="w-3 h-3" />
                    Use Current Location
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
