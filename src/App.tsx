"use client";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SearchSuppliersByMaterial from "./pages/SearchSuppliersByMaterial"; // Import the new page
import { Toaster } from "react-hot-toast"; // Assuming react-hot-toast is used for toasts

function App() {
  return (
    <Router>
      <Toaster /> {/* Add Toaster for notifications */}
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/search-suppliers-by-material" element={<SearchSuppliersByMaterial />} /> {/* New route */}
      </Routes>
    </Router>
  );
}

export default App;