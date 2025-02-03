import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { THEMES } from "@/lib/constants";
import { supabase, type Profile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
}

export function SettingsDialog({ open, onOpenChange, profile }: SettingsDialogProps) {
  const [theme, setTheme] = useState(profile?.theme || "dark");
  const [username, setUsername] = useState(profile?.username || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setTheme(profile.theme);
      setUsername(profile.username);
      setAvatarUrl(profile.avatar_url || "");
      applyTheme(profile.theme);
    }
  }, [profile]);

  const applyTheme = (themeName: string) => {
    const selectedTheme = THEMES[themeName as keyof typeof THEMES];
    if (selectedTheme) {
      document.documentElement.style.setProperty('--background', selectedTheme.colors.background);
      document.documentElement.style.setProperty('--foreground', selectedTheme.colors.foreground);
      document.documentElement.style.setProperty('--primary', selectedTheme.colors.primary);
      document.documentElement.style.setProperty('--secondary', selectedTheme.colors.secondary);
      document.documentElement.style.setProperty('--accent', selectedTheme.colors.accent);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    try {
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(`${profile.id}/${Date.now()}-${file.name}`, file, {
          upsert: true
        });

      if (error) throw error;

      const imageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${data.path}`;
      setAvatarUrl(imageUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    }
  };

  const saveSettings = async () => {
    try {
      if (!profile?.id) throw new Error("No profile ID");

      const { error } = await supabase
        .from("profiles")
        .update({ 
          theme,
          username: username.trim(),
          avatar_url: avatarUrl
        })
        .eq("id", profile.id);

      if (error) throw error;

      setTheme(theme);
      applyTheme(theme);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });

      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved.",
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-zinc-900 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">User Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-zinc-800 border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {Object.entries(THEMES).map(([key, theme]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ background: theme.colors.primary }}
                      />
                      {theme.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-zinc-700 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-full h-full rounded-full"
                  />
                ) : (
                  <span className="text-lg">{profile?.username?.[0].toUpperCase()}</span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Change
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>
          <Button onClick={saveSettings}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
