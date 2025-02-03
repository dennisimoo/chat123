import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLocation("/auth");
      }
    };

    checkAuth();
  }, [setLocation]);

  return <>{children}</>;
}
