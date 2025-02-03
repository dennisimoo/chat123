import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/supabase";
import { Settings, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { SettingsDialog } from "./settings-dialog";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  // Subscribe to presence changes
  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: 'user',
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userIds = Object.values(state)
          .flat()
          .map((presence: any) => presence.user_id);
        setOnlineUserIds(userIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({
              online_at: new Date().toISOString(),
              user_id: user.id
            });
          }
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Fetch all users
  const { data: users } = useQuery<Profile[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('username');
      return data || [];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Get current user
  const { data: currentUser } = useQuery<Profile>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return data;
    }
  });

  return (
    <div className={cn("flex h-full flex-col bg-zinc-900", className)}>
      <div className="flex h-12 items-center px-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-white">
          <Users className="h-5 w-5" />
          <span>Members</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {users?.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-2 py-1.5 text-zinc-300 rounded-md hover:bg-zinc-800/50"
            >
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-full h-full rounded-full"
                    />
                  ) : (
                    <span className="text-lg">{user.username[0].toUpperCase()}</span>
                  )}
                </div>
                <div 
                  className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-zinc-900 ${
                    onlineUserIds.includes(user.id) ? 'bg-green-500' : 'bg-zinc-500'
                  }`} 
                />
              </div>
              <span>{user.username} {user.is_admin ? <span className="text-xs text-blue-500">(Admin)</span> : null}</span>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="mt-auto border-t border-zinc-800 p-3">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowSettings(true)}
            className="text-zinc-400 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {currentUser && (
        <SettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          profile={currentUser}
        />
      )}
    </div>
  );
}
