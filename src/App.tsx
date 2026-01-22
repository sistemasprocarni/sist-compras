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
import SearchSuppliersByMaterial from "./pages/SearchSuppliersByMaterial";
import SupplierDetails from "./pages/SupplierDetails";
import SupplierManagement from "./pages/SupplierManagement";
import MaterialManagement from "./pages/MaterialManagement";
import BulkUpload from "./pages/BulkUpload";
import QuoteRequestManagement from "./pages/QuoteRequestManagement";
import QuoteRequestDetails from "./pages/QuoteRequestDetails";
import EditQuoteRequest from "./pages/EditQuoteRequest";
import CompanyManagement from "./pages/CompanyManagement";
import PurchaseOrderManagement from "./pages/PurchaseOrderManagement"; // New import

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
                <Route path="/search-suppliers-by-material" element={<SearchSuppliersByMaterial />} />
                <Route path="/suppliers/:id" element={<SupplierDetails />} />
                <Route path="/supplier-management" element={<SupplierManagement />} />
                <Route path="/material-management" element={<MaterialManagement />} />
                <Route path="/bulk-upload" element={<BulkUpload />} />
                <Route path="/quote-request-management" element={<QuoteRequestManagement />} />
                <Route path="/quote-requests/:id" element={<QuoteRequestDetails />} />
                <Route path="/quote-requests/edit/:id" element={<EditQuoteRequest />} />
                <Route path="/company-management" element={<CompanyManagement />} />
                <Route path="/purchase-order-management" element={<PurchaseOrderManagement />} /> {/* New route */}
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