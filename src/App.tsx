import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SearchManagement from "./pages/SearchManagement";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import { SessionContextProvider } from "./components/SessionContextProvider";
import GeneratePurchaseOrder from "./pages/GeneratePurchaseOrder";
import GenerateQuoteRequest from "./pages/GenerateQuoteRequest";
import { ShoppingCartProvider } from "./context/ShoppingCartContext";
import SearchSuppliersByMaterial from "./pages/SearchSuppliersByMaterial"; // New page
import SupplierDetails from "./pages/SupplierDetails"; // New page
import SupplierManagement from "./pages/SupplierManagement"; // New page

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
                <Route index element={<SearchManagement />} />
                <Route path="/generate-quote" element={<GenerateQuoteRequest />} />
                <Route path="/generate-po" element={<GeneratePurchaseOrder />} />
                <Route path="/search-suppliers-by-material" element={<SearchSuppliersByMaterial />} /> {/* New route */}
                <Route path="/suppliers/:id" element={<SupplierDetails />} /> {/* New route for supplier details */}
                <Route path="/supplier-management" element={<SupplierManagement />} /> {/* New route */}
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