import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterials } from '@/integrations/supabase/data/materials';

interface SearchResult {
  id: string;
  name: string;
}

const MaterialSearchQuickAccess: React.FC = () => {
  const navigate = useNavigate();
  
  // State for free text search
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for SmartSearch selection
  const [selectedMaterial, setSelectedMaterial] = useState<SearchResult | null>(null);

  // Function to adapt searchMaterials for SmartSearch
  const fetchMaterialsForSmartSearch = async (query: string): Promise<SearchResult[]> => {
    // searchMaterials returns Material[], which is compatible with SearchResult { id, name }
    return searchMaterials(query);
  };

  const handleSmartSelect = (item: SearchResult) => {
    setSelectedMaterial(item);
    setSearchTerm(''); // Clear free text search if smart search is used
    
    // Navigate immediately upon selection
    navigate(`/search-suppliers-by-material?query=${encodeURIComponent(item.name)}`);
  };

  const handleFreeTextSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setSelectedMaterial(null); // Clear smart selection if free text is used
      navigate(`/search-suppliers-by-material?query=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mb-6">
      <h3 className="text-xl font-semibold mb-4 text-procarni-primary">
        Buscar Proveedores por Material
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Encuentra rápidamente proveedores que manejan un material específico usando búsqueda libre o seleccionando de la lista.
      </p>
      
      <div className="space-y-4">
        {/* 1. Smart Search (Intelligent Search) */}
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-medium">Seleccionar Material Existente:</label>
          <SmartSearch
            placeholder="Buscar o seleccionar un material..."
            onSelect={handleSmartSelect}
            fetchFunction={fetchMaterialsForSmartSearch}
            selectedId={selectedMaterial?.id}
            displayValue={selectedMaterial?.name}
          />
        </div>

        <div className="flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="px-3 text-sm text-muted-foreground">O</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* 2. Free Text Search */}
        <form onSubmit={handleFreeTextSearch} className="flex space-x-2">
          <Input
            type="text"
            placeholder="Escribe el nombre del material (Búsqueda libre)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedMaterial(null); // Clear smart selection if user starts typing
            }}
            className="flex-1"
          />
          <Button type="submit" disabled={!searchTerm.trim()}>
            <Search className="h-4 w-4 md:mr-2" /> 
            <span className="hidden md:inline">Buscar</span>
          </Button>
        </form>
      </div>
    </div>
  );
};

export default MaterialSearchQuickAccess;