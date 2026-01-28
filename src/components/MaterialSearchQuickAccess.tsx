import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronsUpDown, Check } from 'lucide-react';
import { useMaterials } from '@/integrations/supabase/hooks/materials/useMaterials';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const MaterialSearchQuickAccess: React.FC = () => {
  const navigate = useNavigate();
  const { data: materials, isLoading } = useMaterials();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);

  const materialOptions = materials?.map(m => ({
    value: m.id,
    label: m.name,
  })) || [];

  const selectedMaterial = materialOptions.find(m => m.value === selectedMaterialId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = selectedMaterial ? selectedMaterial.label : searchTerm;
    
    if (query.trim()) {
      // Navigate to the dedicated search page
      navigate(`/search-suppliers-by-material?query=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleMaterialSelect = (materialId: string) => {
    setSelectedMaterialId(materialId);
    setOpen(false);
    const material = materialOptions.find(m => m.value === materialId);
    if (material) {
      // Automatically navigate when a material is selected from the dropdown
      navigate(`/search-suppliers-by-material?query=${encodeURIComponent(material.label)}`);
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
        {/* 1. Combobox Search (Intelligent Search) */}
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-medium">Seleccionar Material Existente:</label>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {selectedMaterial
                    ? selectedMaterial.label
                    : "Selecciona un material..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar material..." />
                  <CommandEmpty>No se encontró el material.</CommandEmpty>
                  <CommandGroup>
                    {materialOptions.map((material) => (
                      <CommandItem
                        key={material.value}
                        value={material.label}
                        onSelect={() => handleMaterialSelect(material.value)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedMaterialId === material.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {material.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="px-3 text-sm text-muted-foreground">O</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* 2. Free Text Search */}
        <form onSubmit={handleSearch} className="flex space-x-2">
          <Input
            type="text"
            placeholder="Escribe el nombre del material (Búsqueda libre)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedMaterialId(null); // Clear selection if user starts typing
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