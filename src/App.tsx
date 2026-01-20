"use client";

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Index from './pages/Index';
import MaterialsPage from './pages/MaterialsPage';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import SupplierManagement from './pages/SupplierManagement';
import MaterialManagement from './pages/MaterialManagement';
import CompanyManagement from './pages/CompanyManagement';
import GenerateQuoteRequest from './pages/GenerateQuoteRequest';
import QuoteRequestManagement from './pages/QuoteRequestManagement';
import QuoteRequestDetails from './pages/QuoteRequestDetails';
import EditQuoteRequest from './pages/EditQuoteRequest';
import GeneratePurchaseOrder from './pages/GeneratePurchaseOrder';
import SearchSuppliersByMaterial from './pages/SearchSuppliersByMaterial';
import BulkUpload from './pages/BulkUpload';
import SupplierDetails from './pages/SupplierDetails';
import { SessionContextProvider } from './components/SessionContextProvider';
import { ShoppingCartProvider } from './context/ShoppingCartContext';
import { Toaster } from 'sonner';


function App() {
  return (
    <Router>
      <SessionContextProvider>
        <ShoppingCartProvider>
          <Toaster richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Index />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/supplier-management" element={<SupplierManagement />} />
              <Route path="/suppliers/:id" element={<SupplierDetails />} />
              <Route path="/material-management" element={<MaterialManagement />} />
              <Route path="/company-management" element={<CompanyManagement />} />
              <Route path="/generate-quote" element={<GenerateQuoteRequest />} />
              <Route path="/quote-request-management" element={<QuoteRequestManagement />} />
              <Route path="/quote-requests/:id" element={<QuoteRequestDetails />} />
              <Route path="/quote-requests/edit/:id" element={<EditQuoteRequest />} />
              <Route path="/generate-po" element={<GeneratePurchaseOrder />} />
              <Route path="/search-suppliers-by-material" element={<SearchSuppliersByMaterial />} />
              <Route path="/bulk-upload" element={<BulkUpload />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ShoppingCartProvider>
      </SessionContextProvider>
    </Router>
  );
}

export default App;