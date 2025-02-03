import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@/lib/supabase";
import { UserPlus, Search, CheckCircle2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

export function AddFriendDialog({ open, onOpenChange, currentUserId }: AddFriendDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const searchUsers = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      // First get existing friends to exclude them
      const { data: friends } = await supabase
        .from("friends")
        .select("friend_id")
        .eq("user_id", currentUserId);

      const friendIds = friends?.map(f => f.friend_id) || [];

      // Then search for users excluding current user and friends
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", `%${term}%`)
        .not("id", "in", [currentUserId, ...friendIds])
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addFriend = useMutation({
    mutationFn: async (friendId: string) => {
      const { error } = await supabase.from("friends").insert({
        user_id: currentUserId,
        friend_id: friendId,
        status: "pending"
      });

      if (error) throw error;
      setPendingRequests(prev => [...prev, friendId]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({
        title: "Success",
        description: "Friend request sent!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send friend request",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-zinc-900 text-white">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by username..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                searchUsers(e.target.value);
              }}
              className="bg-zinc-800 border-zinc-700"
            />
            <Button size="icon" variant="ghost">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {searchResults.length === 0 && searchTerm.length >= 2 && (
                <div className="text-center text-zinc-400 py-4">
                  No users found
                </div>
              )}
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
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
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-zinc-400">{user.status}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={pendingRequests.includes(user.id) ? "secondary" : "default"}
                    onClick={() => {
                      if (!pendingRequests.includes(user.id)) {
                        addFriend.mutate(user.id);
                      }
                    }}
                    disabled={pendingRequests.includes(user.id)}
                  >
                    {pendingRequests.includes(user.id) ? (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    {pendingRequests.includes(user.id) ? "Sent" : "Add Friend"}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
