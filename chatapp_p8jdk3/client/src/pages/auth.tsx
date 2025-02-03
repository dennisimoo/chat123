import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const authSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type AuthForm = z.infer<typeof authSchema>;

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(data: AuthForm) {
    try {
      const email = `${data.username}@chat.local`;

      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: data.password,
        });

        if (signInError) throw signInError;
        setLocation("/chat");
      } else {
        const { error: signUpError, data: authData } = await supabase.auth.signUp({
          email,
          password: data.password,
          options: {
            data: { username: data.username },
          }
        });

        if (signUpError) throw signUpError;

        if (!authData.user) throw new Error("Failed to create user");

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            username: data.username
          });

        if (profileError) throw profileError;

        setLocation("/chat");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <Card className="w-full max-w-md mx-4 bg-zinc-800 border-zinc-700">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-zinc-200">Username</Label>
              <Input
                id="username"
                type="text"
                {...form.register("username")}
                className="bg-zinc-700 border-zinc-600 text-white"
              />
              {form.formState.errors.username && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="password" className="text-zinc-200">Password</Label>
              <Input
                id="password"
                type="password"
                {...form.register("password")}
                className="bg-zinc-700 border-zinc-600 text-white"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <Button
            variant="ghost"
            onClick={() => setIsLogin(!isLogin)}
            className="mt-4 w-full text-zinc-400 hover:text-zinc-100"
          >
            {isLogin ? "Need an account?" : "Already have an account?"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
