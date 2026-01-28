import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const MaterialSearchQuickAccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Navigate to a search results page, passing the search term and type
      navigate(`/search-results?query=${encodeURIComponent(searchTerm.trim())}&type=material-supplier`);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mb-6">
      <h3 className="text-xl font-semibold mb-4 text-procarni-primary">
        Buscar Proveedores por Material
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Encuentra rápidamente proveedores que manejan un material específico.
      </p>
      <form onSubmit={handleSearch} className="flex space-x-2">
        <Input
          type="text"
          placeholder="Escribe el nombre del material..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={!searchTerm.trim()}>
          <Search className="h-4 w-4 md:mr-2" /> 
          <span className="hidden md:inline">Buscar</span>
        </Button>
      </form>
    </div>
  );
};

export default MaterialSearchQuickAccess;