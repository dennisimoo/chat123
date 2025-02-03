import { Sidebar } from "@/components/layout/sidebar";
import { ChatArea } from "@/components/layout/chat-area";
import { ProtectedRoute } from "@/lib/protected-route";

export default function Chat() {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-zinc-900 text-white">
        <main className="flex-1 border-r border-zinc-800">
          <ChatArea />
        </main>
        <div className="w-60">
          <Sidebar />
        </div>
      </div>
    </ProtectedRoute>
  );
}
