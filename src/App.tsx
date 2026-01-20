"use client";

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import MaterialsPage from './pages/MaterialsPage'; // Import the new page

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/materials" element={<MaterialsPage />} /> {/* Add the new route */}
      </Routes>
    </Router>
  );
}

export default App;