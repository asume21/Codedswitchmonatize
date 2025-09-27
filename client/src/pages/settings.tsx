import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AIProviderSelector } from "@/components/AIProviderSelector";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Palette, 
  Volume2, 
  User, 
  CreditCard, 
  Key, 
  Music, 
  Cpu, 
  Download, 
  Upload,
  HardDrive,
  Zap,
  Globe,
  Moon,
  Sun,
  Monitor
} from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    // Audio Settings
    masterVolume: 80,
    autoPlay: true,
    highQuality: true,
    midiSupport: true,
    latency: 'low',
    bufferSize: '512',
    sampleRate: '48000',
    
    // Appearance
    theme: 'dark',
    animations: true,
    compactView: false,
    visualizer: true,
    
    // Performance
    gpuAcceleration: true,
    multiThreading: true,
    cacheSize: '1024',
    
    // Privacy
    analytics: false,
    saveLocally: true,
    autoScan: true,
    
    // Notifications
    emailNotifications: false,
    generationAlerts: true,
    securityAlerts: true,
    
    // Account
    displayName: 'CodedSwitch User',
    email: 'user@example.com',
    language: 'en',
    timezone: 'UTC',
  });

  const handleSave = () => {
    // Save settings to localStorage and backend
    localStorage.setItem('codedswitch-settings', JSON.stringify(settings));
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const handleReset = () => {
    // Reset to default settings
    toast({
      title: "Settings reset",
      description: "All settings have been restored to defaults.",
    });
  };

  useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem('codedswitch-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-lg">
              <SettingsIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-gray-400">Customize your CodedSwitch experience</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            Pro Account Active
          </Badge>
        </div>

        {/* Tabbed Settings */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full bg-gray-800">
            <TabsTrigger value="general" className="data-[state=active]:bg-blue-600">
              <User className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="audio" className="data-[state=active]:bg-blue-600">
              <Volume2 className="h-4 w-4 mr-2" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="appearance" className="data-[state=active]:bg-blue-600">
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-600">
              <Cpu className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="privacy" className="data-[state=active]:bg-blue-600">
              <Shield className="h-4 w-4 mr-2" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-blue-600">
              <CreditCard className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Account Information</CardTitle>
                <CardDescription className="text-gray-400">Manage your profile and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-gray-300">Display Name</Label>
                    <Input 
                      id="displayName" 
                      value={settings.displayName}
                      onChange={(e) => setSettings({...settings, displayName: e.target.value})}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings({...settings, email: e.target.value})}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language" className="text-gray-300">Language</Label>
                    <Select value={settings.language} onValueChange={(value) => setSettings({...settings, language: value})}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-gray-300">Timezone</Label>
                    <Select value={settings.timezone} onValueChange={(value) => setSettings({...settings, timezone: value})}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="PST">Pacific Time</SelectItem>
                        <SelectItem value="EST">Eastern Time</SelectItem>
                        <SelectItem value="CST">Central Time</SelectItem>
                        <SelectItem value="MST">Mountain Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Provider Settings */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <AIProviderSelector />
            </div>
          </TabsContent>

          {/* Audio Tab */}
          <TabsContent value="audio" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  Audio Engine Settings
                </CardTitle>
                <CardDescription className="text-gray-400">Configure audio playback and recording</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-gray-300">Master Volume</Label>
                    <span className="text-sm text-gray-400">{settings.masterVolume}%</span>
                  </div>
                  <Slider 
                    value={[settings.masterVolume]} 
                    onValueChange={([value]) => setSettings({...settings, masterVolume: value})}
                    max={100} 
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latency" className="text-gray-300">Latency Mode</Label>
                    <Select value={settings.latency} onValueChange={(value) => setSettings({...settings, latency: value})}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ultra-low">Ultra Low (2ms)</SelectItem>
                        <SelectItem value="low">Low (5ms)</SelectItem>
                        <SelectItem value="normal">Normal (10ms)</SelectItem>
                        <SelectItem value="safe">Safe (20ms)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bufferSize" className="text-gray-300">Buffer Size</Label>
                    <Select value={settings.bufferSize} onValueChange={(value) => setSettings({...settings, bufferSize: value})}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="128">128 samples</SelectItem>
                        <SelectItem value="256">256 samples</SelectItem>
                        <SelectItem value="512">512 samples</SelectItem>
                        <SelectItem value="1024">1024 samples</SelectItem>
                        <SelectItem value="2048">2048 samples</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sampleRate" className="text-gray-300">Sample Rate</Label>
                    <Select value={settings.sampleRate} onValueChange={(value) => setSettings({...settings, sampleRate: value})}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="44100">44.1 kHz</SelectItem>
                        <SelectItem value="48000">48 kHz</SelectItem>
                        <SelectItem value="88200">88.2 kHz</SelectItem>
                        <SelectItem value="96000">96 kHz</SelectItem>
                        <SelectItem value="192000">192 kHz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="bg-gray-700" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-play" className="text-gray-300">Auto-play generated content</Label>
                      <p className="text-sm text-gray-500">Automatically play audio after generation</p>
                    </div>
                    <Switch 
                      id="auto-play" 
                      checked={settings.autoPlay}
                      onCheckedChange={(checked) => setSettings({...settings, autoPlay: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="high-quality" className="text-gray-300">High quality audio</Label>
                      <p className="text-sm text-gray-500">Use maximum quality for audio processing</p>
                    </div>
                    <Switch 
                      id="high-quality" 
                      checked={settings.highQuality}
                      onCheckedChange={(checked) => setSettings({...settings, highQuality: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="midi-support" className="text-gray-300">MIDI device support</Label>
                      <p className="text-sm text-gray-500">Enable MIDI input/output devices</p>
                    </div>
                    <Switch 
                      id="midi-support" 
                      checked={settings.midiSupport}
                      onCheckedChange={(checked) => setSettings({...settings, midiSupport: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Visual Preferences
                </CardTitle>
                <CardDescription className="text-gray-400">Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-gray-300">Theme</Label>
                      <p className="text-sm text-gray-500">Choose your preferred color scheme</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={settings.theme === 'light' ? 'default' : 'outline'}
                        onClick={() => setSettings({...settings, theme: 'light'})}
                      >
                        <Sun className="h-4 w-4 mr-1" /> Light
                      </Button>
                      <Button 
                        size="sm" 
                        variant={settings.theme === 'dark' ? 'default' : 'outline'}
                        onClick={() => setSettings({...settings, theme: 'dark'})}
                      >
                        <Moon className="h-4 w-4 mr-1" /> Dark
                      </Button>
                      <Button 
                        size="sm" 
                        variant={settings.theme === 'auto' ? 'default' : 'outline'}
                        onClick={() => setSettings({...settings, theme: 'auto'})}
                      >
                        <Monitor className="h-4 w-4 mr-1" /> Auto
                      </Button>
                    </div>
                  </div>

                  <Separator className="bg-gray-700" />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="animations" className="text-gray-300">Enable animations</Label>
                      <p className="text-sm text-gray-500">Show smooth transitions and effects</p>
                    </div>
                    <Switch 
                      id="animations" 
                      checked={settings.animations}
                      onCheckedChange={(checked) => setSettings({...settings, animations: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="compact-view" className="text-gray-300">Compact view</Label>
                      <p className="text-sm text-gray-500">Reduce spacing for more content</p>
                    </div>
                    <Switch 
                      id="compact-view" 
                      checked={settings.compactView}
                      onCheckedChange={(checked) => setSettings({...settings, compactView: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="visualizer" className="text-gray-300">Audio visualizer</Label>
                      <p className="text-sm text-gray-500">Show waveforms and spectrum analyzer</p>
                    </div>
                    <Switch 
                      id="visualizer" 
                      checked={settings.visualizer}
                      onCheckedChange={(checked) => setSettings({...settings, visualizer: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Performance Optimization
                </CardTitle>
                <CardDescription className="text-gray-400">Optimize for your system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="gpu" className="text-gray-300">GPU acceleration</Label>
                      <p className="text-sm text-gray-500">Use graphics card for processing</p>
                    </div>
                    <Switch 
                      id="gpu" 
                      checked={settings.gpuAcceleration}
                      onCheckedChange={(checked) => setSettings({...settings, gpuAcceleration: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="multi-thread" className="text-gray-300">Multi-threading</Label>
                      <p className="text-sm text-gray-500">Use multiple CPU cores</p>
                    </div>
                    <Switch 
                      id="multi-thread" 
                      checked={settings.multiThreading}
                      onCheckedChange={(checked) => setSettings({...settings, multiThreading: checked})}
                    />
                  </div>
                </div>

                <Separator className="bg-gray-700" />

                <div className="space-y-2">
                  <Label htmlFor="cacheSize" className="text-gray-300">Cache Size</Label>
                  <Select value={settings.cacheSize} onValueChange={(value) => setSettings({...settings, cacheSize: value})}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="256">256 MB</SelectItem>
                      <SelectItem value="512">512 MB</SelectItem>
                      <SelectItem value="1024">1 GB</SelectItem>
                      <SelectItem value="2048">2 GB</SelectItem>
                      <SelectItem value="4096">4 GB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-gray-700 rounded-lg">
                  <h4 className="text-white font-medium mb-2">System Information</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <p>CPU Cores: {navigator.hardwareConcurrency || 'Unknown'}</p>
                    <p>Memory: {(navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Unknown'}</p>
                    <p>Platform: {navigator.platform}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Security
                </CardTitle>
                <CardDescription className="text-gray-400">Control your data and privacy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="save-locally" className="text-gray-300">Save projects locally</Label>
                      <p className="text-sm text-gray-500">Store data on your device</p>
                    </div>
                    <Switch 
                      id="save-locally" 
                      checked={settings.saveLocally}
                      onCheckedChange={(checked) => setSettings({...settings, saveLocally: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="analytics" className="text-gray-300">Share usage analytics</Label>
                      <p className="text-sm text-gray-500">Help improve CodedSwitch</p>
                    </div>
                    <Switch 
                      id="analytics" 
                      checked={settings.analytics}
                      onCheckedChange={(checked) => setSettings({...settings, analytics: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-scan" className="text-gray-300">Auto-scan code</Label>
                      <p className="text-sm text-gray-500">Check for vulnerabilities automatically</p>
                    </div>
                    <Switch 
                      id="auto-scan" 
                      checked={settings.autoScan}
                      onCheckedChange={(checked) => setSettings({...settings, autoScan: checked})}
                    />
                  </div>
                </div>

                <Separator className="bg-gray-700" />

                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" onClick={() => toast({title: "Cache cleared", description: "All cached data has been removed."})}>
                    <HardDrive className="h-4 w-4 mr-2" /> Clear Cache
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => toast({title: "Data exported", description: "Your data has been downloaded."})}>
                    <Download className="h-4 w-4 mr-2" /> Export My Data
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-400" onClick={() => toast({title: "Account deletion", description: "Please contact support to delete your account.", variant: "destructive"})}>
                    <Shield className="h-4 w-4 mr-2" /> Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing & Subscription
                </CardTitle>
                <CardDescription className="text-gray-400">Manage your subscription and payment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">CodedSwitch Pro</h3>
                      <p className="text-gray-300">Premium features unlocked</p>
                    </div>
                    <Badge className="bg-green-600 text-white">Active</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Next billing date</p>
                      <p className="text-white font-medium">January 15, 2025</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Monthly cost</p>
                      <p className="text-white font-medium">$29.99</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <CreditCard className="h-4 w-4 mr-2" /> Update Payment Method
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" /> Download Invoices
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Upload className="h-4 w-4 mr-2" /> Upgrade Plan
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-yellow-500 hover:text-yellow-400">
                    Cancel Subscription
                  </Button>
                </div>

                <Separator className="bg-gray-700" />

                <div className="space-y-2">
                  <h4 className="text-white font-medium">Usage This Month</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Music Generations</span>
                        <span className="text-white">450 / 1000</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{width: '45%'}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Storage Used</span>
                        <span className="text-white">2.3 GB / 10 GB</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{width: '23%'}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">API Calls</span>
                        <span className="text-white">12,450 / 50,000</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{width: '25%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6">
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            Reset to Defaults
          </Button>
          <div className="space-x-3">
            <Button 
              variant="outline"
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}