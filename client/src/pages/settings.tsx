import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AIProviderSelector } from "@/components/AIProviderSelector";
import { Settings as SettingsIcon, Bell, Shield, Palette, Volume2 } from "lucide-react";

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Provider Settings */}
        <div className="lg:col-span-2">
          <AIProviderSelector />
        </div>

        {/* Audio Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Audio Settings
            </CardTitle>
            <CardDescription>Configure audio playback and recording</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-play">Auto-play generated beats</Label>
              <Switch id="auto-play" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="high-quality">High quality audio</Label>
              <Switch id="high-quality" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="midi-support">Enable MIDI devices</Label>
              <Switch id="midi-support" defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Control your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">Email notifications</Label>
              <Switch id="email-notifications" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="generation-complete">Generation complete alerts</Label>
              <Switch id="generation-complete" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="security-alerts">Security scan alerts</Label>
              <Switch id="security-alerts" defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Security
            </CardTitle>
            <CardDescription>Manage your privacy and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="save-projects">Save projects locally</Label>
              <Switch id="save-projects" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="analytics">Share usage analytics</Label>
              <Switch id="analytics" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-scan">Auto-scan uploaded code</Label>
              <Switch id="auto-scan" defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="dark-mode">Dark mode</Label>
              <Switch id="dark-mode" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="compact-view">Compact view</Label>
              <Switch id="compact-view" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="animations">Enable animations</Label>
              <Switch id="animations" defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button variant="outline">Reset to Defaults</Button>
        <div className="space-x-2">
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}