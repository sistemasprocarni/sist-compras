"use client";

import React, { useState } from 'react';
import SmartSearch from '@/components/SmartSearch';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Material {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
}

const MaterialsPage: React.FC = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  const fetchMaterials = async (query: string): Promise<Material[]> => {
    if (!query) return [];
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, code, category, unit')
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error fetching materials:', error);
      return [];
    }
    return data as Material[];
  };

  const handleMaterialSelect = (item: Material | null) => {
    setSelectedMaterial(item);
    console.log('Material seleccionado:', item);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Búsqueda de Materiales</h1>
      <div className="max-w-md mx-auto">
        <SmartSearch
          placeholder="Buscar materiales por nombre..."
          onSelect={handleMaterialSelect}
          fetchFunction={fetchMaterials}
          displayValue={selectedMaterial?.name}
        />

        {selectedMaterial && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Material Seleccionado</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Nombre:</strong> {selectedMaterial.name}</p>
              <p><strong>Código:</strong> {selectedMaterial.code}</p>
              {selectedMaterial.category && <p><strong>Categoría:</strong> {selectedMaterial.category}</p>}
              {selectedMaterial.unit && <p><strong>Unidad:</strong> {selectedMaterial.unit}</p>}
              <p><strong>ID:</strong> {selectedMaterial.id}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MaterialsPage;