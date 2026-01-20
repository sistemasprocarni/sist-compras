"use client";

import React, { useState, useCallback } from 'react';
import SmartSearch from '@/components/SmartSearch';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast'; // Assuming react-hot-toast is available

interface Material {
  id: string;
  name: string;
  code?: string;
}

interface Supplier {
  id: string;
  name: string;
  rif: string;
  email?: string;
  phone?: string;
  code?: string;
}

const SearchSuppliersByMaterial: React.FC = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMaterials = useCallback(async (query: string): Promise<Material[]> => {
    if (!query) return [];
    setLoading(true);
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, code')
      .ilike('name', `%${query}%`)
      .or(`code.ilike.%${query}%`);

    setLoading(false);
    if (error) {
      console.error('Error fetching materials:', error);
      toast.error('Error al buscar materiales.');
      return [];
    }
    return data || [];
  }, []);

  const fetchSuppliersForMaterial = useCallback(async (materialId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('supplier_materials')
      .select(`
        suppliers (
          id,
          name,
          rif,
          email,
          phone,
          code
        )
      `)
      .eq('material_id', materialId);

    setLoading(false);
    if (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Error al buscar proveedores.');
      setSuppliers([]);
      return;
    }

    const fetchedSuppliers = data?.map((item: any) => item.suppliers).filter(Boolean) as Supplier[] || [];
    setSuppliers(fetchedSuppliers);
    if (fetchedSuppliers.length === 0) {
      toast.info('No se encontraron proveedores para este material.');
    }
  }, []);

  const handleMaterialSelect = (material: Material | null) => {
    setSelectedMaterial(material);
    setSuppliers([]); // Clear previous suppliers when material changes
  };

  const handleSearchButtonClick = () => {
    if (selectedMaterial) {
      fetchSuppliersForMaterial(selectedMaterial.id);
    } else {
      toast.error('Por favor, selecciona un material para buscar.');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Buscar Proveedores por Material</h1>

      <div className="flex space-x-2 mb-6">
        <div className="flex-grow">
          <SmartSearch
            placeholder="Buscar material por nombre o código..."
            onSelect={handleMaterialSelect}
            fetchFunction={fetchMaterials}
            displayValue={selectedMaterial?.name || ''}
          />
        </div>
        <Button onClick={handleSearchButtonClick} disabled={!selectedMaterial || loading}>
          <Search className="mr-2 h-4 w-4" /> Buscar
        </Button>
      </div>

      {loading && <p>Cargando proveedores...</p>}

      {!loading && suppliers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id}>
              <CardHeader>
                <CardTitle>{supplier.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p><strong>RIF:</strong> {supplier.rif}</p>
                {supplier.code && <p><strong>Código:</strong> {supplier.code}</p>}
                {supplier.email && <p><strong>Email:</strong> {supplier.email}</p>}
                {supplier.phone && <p><strong>Teléfono:</strong> {supplier.phone}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !selectedMaterial && suppliers.length === 0 && (
        <p className="text-center text-gray-500">Selecciona un material para ver los proveedores.</p>
      )}

      {!loading && selectedMaterial && suppliers.length === 0 && (
        <p className="text-center text-gray-500">No se encontraron proveedores para el material seleccionado.</p>
      )}
    </div>
  );
};

export default SearchSuppliersByMaterial;