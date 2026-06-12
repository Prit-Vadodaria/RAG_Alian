import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AdminRoute from "./components/auth/AdminRoute";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import MainLayout from "./layouts/MainLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Chatbots from "./pages/Chatbots";
import System from "./pages/System";
import Settings from "./pages/Settings";
import AiConfig from "./pages/AiConfig";
import Contexts from "./pages/Contexts";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminClients from "./pages/admin/AdminClients";
import AdminContexts from "./pages/admin/AdminContexts";
import AdminChatbots from "./pages/admin/AdminChatbots";
import AdminClientDetail from "./pages/admin/AdminClientDetail";
import RegistrationConfig from "./pages/admin/config/RegistrationConfig";
import EmbeddingConfig from "./pages/admin/config/EmbeddingConfig";
import RerankingConfig from "./pages/admin/config/RerankingConfig";
import RetrievalConfig from "./pages/admin/config/RetrievalConfig";
import IngestionConfig from "./pages/admin/config/IngestionConfig";
import PromptSeedConfig from "./pages/admin/config/PromptSeedConfig";
import { useAuthStore } from "./store/authStore";
import { useChatStore } from "./store/chatStore";

function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const userId = useAuthStore((state) => state.user?.id || "");
  const loadChatStoreForUser = useChatStore((state) => state.loadForUser);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    loadChatStoreForUser(userId || "guest");
  }, [loadChatStoreForUser, userId]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/workspace" element={<Chat />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chatbots" element={<Chatbots />} />
            <Route path="/contexts" element={<Contexts />} />
            <Route path="/system" element={<System />} />
            <Route path="/prompt-settings" element={<Settings />} />
            <Route path="/ai-config" element={<AiConfig />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/clients/:id" element={<AdminClientDetail />} />
            <Route path="/admin/contexts" element={<AdminContexts />} />
            <Route path="/admin/chatbots" element={<AdminChatbots />} />
            <Route path="/admin/config" element={<Navigate to="/admin/config/registration" replace />} />
            <Route path="/admin/config/registration" element={<RegistrationConfig />} />
            <Route path="/admin/config/embedding" element={<EmbeddingConfig />} />
            <Route path="/admin/config/reranking" element={<RerankingConfig />} />
            <Route path="/admin/config/retrieval" element={<RetrievalConfig />} />
            <Route path="/admin/config/ingestion" element={<IngestionConfig />} />
            <Route path="/admin/config/prompt-seed" element={<PromptSeedConfig />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
