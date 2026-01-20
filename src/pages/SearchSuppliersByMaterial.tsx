"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import SimpleSearch from '@/components/SimpleSearch';
import { ShoppingCart, PlusCircle, Search } from 'lucide-react';
import { useShoppingCart } from '@/context/ShoppingCartContext';
import { toast } from 'sonner';

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
  payment_terms: string;
  credit_days?: number;
  status: string;
  code?: string;
}

interface SupplierMaterial {
  id: string;
  supplier_id: string;
  material_id: string;
  specification?: string;
  supplier: Supplier;
  material: Material;
}

const SearchSuppliersByMaterial: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToCart } = useShoppingCart();

  const fetchMaterials = async (query: string): Promise<Material[]> => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching materials:', error);
      return [];
    }
  };

  const fetchSuppliersByMaterial = async (materialId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select(`
          *,
          supplier:suppliers(*),
          material:materials(*)
        `)
        .eq('material_id', materialId);

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Error al cargar los proveedores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMaterial) {
      fetchSuppliersByMaterial(selectedMaterial.id);
    }
  }, [selectedMaterial]);

  const handleAddToCart = (supplierMaterial: SupplierMaterial) => {
    addToCart({
      id: supplierMaterial.id,
      supplierId: supplierMaterial.supplier_id,
      materialId: supplierMaterial.material_id,
      materialName: supplierMaterial.material.name,
      supplierName: supplierMaterial.supplier.name,
      specification: supplierMaterial.specification || '',
      quantity: 1,
      unitPrice: 0,
      currency: 'USD',
      exchangeRate: 1,
    });
    toast.success('Añadido al carrito');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Buscar Proveedores por Material</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Seleccionar Material</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <SimpleSearch
              placeholder="Buscar material..."
              onSelect={(material) => setSelectedMaterial(material)}
              fetchFunction={fetchMaterials}
              displayValue={selectedMaterial?.name}
            />
          </div>
        </CardContent>
      </Card>

      {selectedMaterial && (
        <Card>
          <CardHeader>
            <CardTitle>Proveedores para {selectedMaterial.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Cargando...</div>
            ) : suppliers.length > 0 ? (
              <div className="space-y-4">
                {suppliers.map((supplierMaterial) => (
                  <Card key={supplierMaterial.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{supplierMaterial.supplier.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {supplierMaterial.supplier.rif} | {supplierMaterial.supplier.payment_terms}
                        </p>
                        {supplierMaterial.specification && (
                          <p className="text-sm mt-1">
                            Especificación: {supplierMaterial.specification}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(supplierMaterial)}
                        className="ml-4"
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Añadir al carrito
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron proveedores para este material.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SearchSuppliersByMaterial;