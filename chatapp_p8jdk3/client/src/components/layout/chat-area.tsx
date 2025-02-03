import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Hash, Smile, Paperclip } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import TextareaAutosize from 'react-textarea-autosize';
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from 'date-fns';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_image: boolean;
  profiles: {
    username: string;
    avatar_url: string | null;
    is_admin: boolean;
  } | null;
}

export function ChatArea() {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Current user query
  const { data: currentUser } = useQuery({
    queryKey: ['/api/current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  // Subscribe to message changes
  useEffect(() => {
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ["/api/messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          profiles:sender_id (
            username,
            avatar_url,
            is_admin
          )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Message[];
    },
    refetchInterval: 1000
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ content, isImage = false }: { content: string; isImage?: boolean }) => {
      if (!content.trim()) return;
      if (!currentUser) throw new Error("Not authenticated");
      if (content.length > 10000) { // Character limit validation
        throw new Error("Message exceeds 10,000 characters limit.");
      }


      const { error } = await supabase
        .from("messages")
        .insert({
          content: content.trim(),
          sender_id: currentUser.id,
          is_image: isImage
        });

      if (error) throw error;
    },
    onError: (error: any) => { // Handle errors from sendMessage mutation
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive"
      });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    }
  });

  // Handle file upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      const { data, error } = await supabase.storage
        .from('message-images')
        .upload(`${currentUser.id}/${Date.now()}-${file.name}`, file, {
          upsert: true
        });

      if (error) throw error;

      const imageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/message-images/${data.path}`;
      sendMessage.mutate({ content: imageUrl, isImage: true });
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const renderMessageContent = (msg: Message) => {
    if (msg.is_image) {
      return <img src={msg.content} alt="Shared image" className="max-w-sm rounded-lg" />;
    }
    return msg.content;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MM/dd/yyyy h:mm a');
    }
  };

  return (
    <div className="flex h-full flex-col bg-chat-background"> {/* Changed background color */}
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center">
          <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center">
            <Hash className="h-4 w-4 text-white" />
          </div>
          <span className="ml-3 font-semibold text-white">General</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) => {
          const isFirstInGroup = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
          const isCurrentUser = msg.sender_id === currentUser?.id;

          return (
            <div key={msg.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} `}>
              {!isCurrentUser && isFirstInGroup && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {msg.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                  {msg.profiles?.avatar_url && (
                       <AvatarImage src={msg.profiles.avatar_url} alt={msg.profiles.username} />
                  )}
                </Avatar>
              )}
              <div className={`flex flex-col  ${isCurrentUser ? 'items-end' : 'items-start'} ${isFirstInGroup ? '' : 'mt-1'}`}>
                {isFirstInGroup && !isCurrentUser && (
                  <div className={`text-sm text-zinc-400 mb-0.5  `}>
                    {msg.profiles?.username || 'Unknown User'}
                    <span className="ml-1 text-xs text-zinc-500">
                       {formatTime(msg.created_at)}
                      </span>
                  </div>
                )}
                 {isFirstInGroup && isCurrentUser && (
                  <div className={`text-sm text-zinc-400 mb-0.5 text-right `}>
                    {msg.profiles?.username || 'Unknown User'}
                     <span className="ml-1 text-xs text-zinc-500">
                       {formatTime(msg.created_at)}
                      </span>
                  </div>
                )}
                <div
                  className={`px-4 py-2 max-w-lg relative group rounded-xl ${
                    isCurrentUser
                      ? 'bg-blue-500 text-white rounded-tr-none' /* Slightly lighter blue */
                      : 'bg-zinc-700 text-white rounded-tl-none' /* Slightly lighter zinc */
                  }`}
                >
                  {renderMessageContent(msg)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-700"> {/* Input bar background color */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) {
              sendMessage.mutate({ content: message });
            }
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-zinc-700 rounded-xl"> {/* Input background color */}
              <TextareaAutosize
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim()) {
                      sendMessage.mutate({ content: message });
                    }
                  }
                }}
                placeholder="Message #general"
                className="w-full bg-transparent border-none resize-none text-white p-3 focus:outline-none"
                minRows={1}
                maxRows={5}
              />
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji: { native: string }) => {
                      setMessage(prev => prev + emoji.native);
                    }}
                    theme="dark"
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
              <Button type="submit">Send</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
