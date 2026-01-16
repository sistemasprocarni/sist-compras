import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SearchManagement from "./pages/SearchManagement"; // Renamed from Index
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Layout from "./components/Layout"; // New Layout component
import { SessionContextProvider } from "./components/SessionContextProvider";
import GeneratePurchaseOrder from "./pages/GeneratePurchaseOrder"; // New page
import GenerateQuoteRequest from "./pages/GenerateQuoteRequest"; // New page
import { ShoppingCartProvider } from "./context/ShoppingCartContext"; // New context

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <ShoppingCartProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<SearchManagement />} /> {/* Default route within layout */}
                <Route path="/generate-quote" element={<GenerateQuoteRequest />} />
                <Route path="/generate-po" element={<GeneratePurchaseOrder />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ShoppingCartProvider>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;