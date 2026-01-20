"use client";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner"; // Changed from react-hot-toast to sonner
import { SessionContextProvider } from "./components/SessionContextProvider";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import SearchSuppliersByMaterial from "./pages/SearchSuppliersByMaterial";
import SupplierManagement from "./pages/SupplierManagement";
import SupplierDetails from "./pages/SupplierDetails";
import MaterialManagement from "./pages/MaterialManagement";
import GenerateQuoteRequest from "./pages/GenerateQuoteRequest";
import QuoteRequestManagement from "./pages/QuoteRequestManagement";
import QuoteRequestDetails from "./pages/QuoteRequestDetails";
import EditQuoteRequest from "./pages/EditQuoteRequest";
import GeneratePurchaseOrder from "./pages/GeneratePurchaseOrder";
import BulkUpload from "./pages/BulkUpload";
import CompanyManagement from "./pages/CompanyManagement";

function App() {
  return (
    <Router>
      <Toaster /> {/* Now using Toaster from sonner */}
      <SessionContextProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Index />} />
            <Route path="/company-management" element={<CompanyManagement />} />
            <Route path="/search-suppliers-by-material" element={<SearchSuppliersByMaterial />} />
            <Route path="/supplier-management" element={<SupplierManagement />} />
            <Route path="/suppliers/:id" element={<SupplierDetails />} />
            <Route path="/material-management" element={<MaterialManagement />} />
            <Route path="/generate-quote" element={<GenerateQuoteRequest />} />
            <Route path="/quote-request-management" element={<QuoteRequestManagement />} />
            <Route path="/quote-requests/:id" element={<QuoteRequestDetails />} />
            <Route path="/quote-requests/edit/:id" element={<EditQuoteRequest />} />
            <Route path="/generate-po" element={<GeneratePurchaseOrder />} />
            <Route path="/bulk-upload" element={<BulkUpload />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SessionContextProvider>
    </Router>
  );
}

export default App;