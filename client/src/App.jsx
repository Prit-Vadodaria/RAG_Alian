import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Chat from "./pages/Chat";
import Chatbots from "./pages/Chatbots";
import System from "./pages/System";
import Settings from "./pages/Settings";
import Contexts from "./pages/Contexts";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Chat />} />
          <Route path="chatbots" element={<Chatbots />} />
          <Route path="contexts" element={<Contexts />} />
          <Route path="system" element={<System />} />
          <Route path="prompt-settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
