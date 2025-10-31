import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIProviderSelector } from "@/components/AIProviderSelector";
import { Settings as SettingsIcon, Bell, Shield, Palette, Volume2, User, FileText, Edit3, Save, RotateCcw } from "lucide-react";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("account");
  const [hasChanges, setHasChanges] = useState(false);

  const handleSettingChange = () => {
    setHasChanges(true);
  };

  const handleSave = () => {
    setHasChanges(false);
    // TODO: Implement actual save functionality
  };

  const handleReset = () => {
    setHasChanges(false);
    // TODO: Implement actual reset functionality
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col">
      {/* Top Menu Bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="text-sm text-gray-400">Manage your account and preferences</p>
            </div>
          </div>
          
          {/* Top Menu Items */}
          <div className="flex items-center gap-2 text-sm">
            <button className="px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors flex items-center gap-2">
              <User className="h-4 w-4" />
              Account
            </button>
            <button className="px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors flex items-center gap-2">
              <FileText className="h-4 w-4" />
              File
            </button>
            <button className="px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-gray-700 mb-6">
            <TabsTrigger value="account" className="flex items-center gap-2 text-white bg-gray-600 hover:bg-gray-500 data-[state=active]:text-white data-[state=active]:bg-purple-600">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2 text-white bg-gray-600 hover:bg-gray-500 data-[state=active]:text-white data-[state=active]:bg-purple-600">
              <Volume2 className="h-4 w-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2 text-white bg-gray-600 hover:bg-gray-500 data-[state=active]:text-white data-[state=active]:bg-purple-600">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 text-white bg-gray-600 hover:bg-gray-500 data-[state=active]:text-white data-[state=active]:bg-purple-600">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 text-white bg-gray-600 hover:bg-gray-500 data-[state=active]:text-white data-[state=active]:bg-purple-600">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Account Information</CardTitle>
                <CardDescription className="text-gray-400">Manage your profile and account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Display Name</Label>
                    <input type="text" defaultValue="CodedSwitch User" className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" onChange={handleSettingChange} />
                  </div>
                  <div>
                    <Label className="text-gray-300">Email</Label>
                    <input type="email" defaultValue="user@example.com" className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" onChange={handleSettingChange} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Language</Label>
                    <select className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500" onChange={handleSettingChange}>
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-gray-300">Timezone</Label>
                    <select className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500" onChange={handleSettingChange}>
                      <option>UTC</option>
                      <option>EST</option>
                      <option>CST</option>
                      <option>PST</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">AI Provider Selection</CardTitle>
                <CardDescription className="text-gray-400">Choose your preferred AI provider for enhanced features</CardDescription>
              </CardHeader>
              <CardContent>
                <AIProviderSelector />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audio Tab */}
          <TabsContent value="audio" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-purple-400" />
                  Audio Settings
                </CardTitle>
                <CardDescription className="text-gray-400">Configure audio playback and recording</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-play" className="text-gray-300">Auto-play generated beats</Label>
                  <Switch id="auto-play" defaultChecked onChange={handleSettingChange} />
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between">
                  <Label htmlFor="high-quality" className="text-gray-300">High quality audio</Label>
                  <Switch id="high-quality" defaultChecked onChange={handleSettingChange} />
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between">
                  <Label htmlFor="midi-support" className="text-gray-300">Enable MIDI devices</Label>
                  <Switch id="midi-support" defaultChecked onChange={handleSettingChange} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-400" />
                  Appearance
                </CardTitle>
                <CardDescription className="text-gray-400">Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode" className="text-gray-300">Dark mode</Label>
                  <Switch id="dark-mode" defaultChecked onChange={handleSettingChange} />
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between">
                  <Label htmlFor="compact-view" className="text-gray-300">Compact view</Label>
                  <Switch id="compact-view" onChange={handleSettingChange} />
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between">
                  <Label htmlFor="animations" className="text-gray-300">Enable animations</Label>
                  <Switch id="animations" defaultChecked onChange={handleSettingChange} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bell className="h-5 w-5 text-purple-400" />
                  Notifications
                </CardTitle>
                <CardDescription className="text-gray-400">Control your notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-notifications" className="text-gray-300">Email notifications</Label>
                  <Switch id="email-notifications" onChange={handleSettingChange} />
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between">
                  <Label htmlFor="generation-complete" className="text-gray-300">Generation complete alerts</Label>
                  <Switch id="generation-complete" defaultChecked onChange={handleSettingChange} />
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between">
                  <Label htmlFor="security-alerts" className="text-gray-300">Security scan alerts</Label>
                  <Switch id="security-alerts" defaultChecked onChange={handleSettingChange} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-400" />
                  Privacy & Security
                </CardTitle>
                <CardDescription className="text-gray-400">Manage your privacy and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="save-projects" className="text-gray-300">Save projects locally</Label>
                  <Switch id="save-projects" defaultChecked onChange={handleSettingChange} />
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between">
                  <Label htmlFor="analytics" className="text-gray-300">Share usage analytics</Label>
                  <Switch id="analytics" onChange={handleSettingChange} />
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-scan" className="text-gray-300">Auto-scan uploaded code</Label>
                  <Switch id="auto-scan" defaultChecked onChange={handleSettingChange} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-6 py-4 flex justify-between items-center">
        <Button 
          variant="outline" 
          onClick={handleReset}
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        <div className="space-x-2 flex">
          <Button 
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!hasChanges}
            className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}