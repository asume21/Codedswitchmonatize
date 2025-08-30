import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Piano, 
  Settings, 
  Power,
  Volume2,
  Wifi,
  WifiOff
} from "lucide-react";

interface MIDIDevice {
  id: string;
  name: string;
  type: "input" | "output";
  connected: boolean;
  active: boolean;
}

export function MIDIController() {
  const [devices, setDevices] = useState<MIDIDevice[]>([
    {
      id: "1",
      name: "MIDI Keyboard",
      type: "input",
      connected: true,
      active: true
    },
    {
      id: "2", 
      name: "Drum Pad Controller",
      type: "input",
      connected: false,
      active: false
    },
    {
      id: "3",
      name: "Audio Interface",
      type: "output",
      connected: true,
      active: true
    }
  ]);

  const [midiEnabled, setMidiEnabled] = useState(true);

  const toggleDevice = (deviceId: string) => {
    setDevices(prev => prev.map(device => 
      device.id === deviceId 
        ? { ...device, active: !device.active }
        : device
    ));
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Piano className="h-6 w-6" />
            MIDI Controller
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* MIDI Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">MIDI System</span>
                <Badge variant={midiEnabled ? "default" : "secondary"}>
                  {midiEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <Button
                variant={midiEnabled ? "default" : "outline"}
                onClick={() => setMidiEnabled(!midiEnabled)}
              >
                <Power className="h-4 w-4 mr-2" />
                {midiEnabled ? "Disable" : "Enable"}
              </Button>
            </div>

            {/* Device List */}
            <div>
              <h3 className="font-medium mb-4">Connected Devices</h3>
              <div className="space-y-3">
                {devices.map((device) => (
                  <Card key={device.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {device.connected ? (
                              <Wifi className="h-4 w-4 text-green-500" />
                            ) : (
                              <WifiOff className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">{device.name}</span>
                          </div>
                          <Badge variant="outline">
                            {device.type}
                          </Badge>
                          <Badge variant={device.connected ? "default" : "secondary"}>
                            {device.connected ? "Connected" : "Disconnected"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={device.active ? "default" : "outline"}
                            onClick={() => toggleDevice(device.id)}
                            disabled={!device.connected || !midiEnabled}
                          >
                            {device.active ? "Active" : "Inactive"}
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* MIDI Monitor */}
            <div>
              <h3 className="font-medium mb-4">MIDI Monitor</h3>
              <Card className="bg-gray-900 text-green-400">
                <CardContent className="p-4">
                  <div className="font-mono text-sm space-y-1">
                    <div>MIDI Input: Note On C4 Velocity 127</div>
                    <div>MIDI Input: Control Change CC1 Value 64</div>
                    <div>MIDI Input: Note Off C4 Velocity 0</div>
                    <div className="text-gray-500">Waiting for MIDI input...</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button variant="outline">
                Scan Devices
              </Button>
              <Button variant="outline">
                Reset MIDI
              </Button>
              <Button variant="outline">
                MIDI Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
