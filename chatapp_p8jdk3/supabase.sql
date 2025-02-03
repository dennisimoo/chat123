-- Drop existing tables in correct order to avoid dependency issues
drop table if exists friends cascade;
drop table if exists message_reactions cascade;
drop table if exists messages cascade;
drop table if exists profiles cascade;

-- Create profiles table with new fields
create table profiles (
  id uuid primary key,
  username text not null unique, -- Enforce username uniqueness and not null
  avatar_url text,
  theme text default 'dark',
  status text default 'Hey there!',
  is_admin boolean default false, -- ADDED: Admin status column
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  CONSTRAINT unique_username_check CHECK (username !~* '^dennis(?!$|\\d+$)')
);

-- Enable RLS
alter table profiles enable row level security;

-- Create profile policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- Messages table for chat
create table messages (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  is_image boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for messages
alter table messages enable row level security;

-- Message policies
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON messages;
CREATE POLICY "Messages are viewable by everyone" ON messages FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
CREATE POLICY "Users can insert their own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);


-- Create message reactions table
create table message_reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_reaction unique (message_id, user_id, emoji)
);

-- Enable RLS for reactions
alter table message_reactions enable row level security;

-- Reaction policies
DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON message_reactions;
CREATE POLICY "Reactions are viewable by everyone" ON message_reactions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
CREATE POLICY "Users can add reactions" ON message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their reactions" ON message_reactions;
CREATE POLICY "Users can remove their reactions" ON message_reactions FOR DELETE USING (auth.uid() = user_id);


-- Friends table for managing relationships
create table friends (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  friend_id uuid references profiles(id) on delete cascade not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_friendship unique (user_id, friend_id)
);

-- Enable RLS for friends
alter table friends enable row level security;

-- Friends policies
DROP POLICY IF EXISTS "Users can view their own friends" ON friends;
CREATE POLICY "Users can view their own friends" ON friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can add friends" ON friends;
CREATE POLICY "Users can add friends" ON friends FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their friend status" ON friends;
CREATE POLICY "Users can update their friend status" ON friends FOR UPDATE USING (auth.uid() in (user_id, friend_id));


-- Create indexes for better performance
create index messages_created_at_idx on messages (created_at desc);
create index messages_sender_idx on messages (sender_id);
create index reactions_message_idx on message_reactions (message_id);
create index reactions_user_idx on message_reactions (user_id);
create index friends_user_idx on friends (user_id);
create index friends_friend_idx on friends (friend_id);

-- Enable realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
  alter publication supabase_realtime add table messages, message_reactions, friends;
commit;

-- Storage setup for avatars and message images
insert into storage.buckets (id, name)
values ('avatars', 'avatars')
on conflict do nothing;

insert into storage.buckets (id, name)
values ('message-images', 'message-images')
on conflict do nothing;

-- Set up storage policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::UUID
);

DROP POLICY IF EXISTS "Message images are publicly accessible" ON storage.objects;
CREATE POLICY "Message images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'message-images');

DROP POLICY IF EXISTS "Users can upload message images" ON storage.objects;
CREATE POLICY "Users can upload message images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'message-images' AND auth.uid() = (storage.foldername(name))[1]::UUID
);
