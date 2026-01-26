import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { showError, showSuccess } from '@/utils/toast';
import { createMaterial, createSupplierMaterialRelation, searchMaterials } from '@/integrations/supabase/data';
import { useSession } from '@/components/SessionContextProvider';
import { Material } from '@/integrations/supabase/types'; // Import Material type

interface AddMaterialToSupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMaterialAdded: (material: { id: string; name: string; unit?: string; is_exempt?: boolean }) => void;
  supplierId: string;
  supplierName: string;
}

const MATERIAL_CATEGORIES = [
  'SECA', 'FRESCA', 'EMPAQUE', 'FERRETERIA Y CONSTRUCCION', 'AGROPECUARIA',
  'GASES Y COMBUSTIBLE', 'ELECTRICIDAD', 'REFRIGERACION', 'INSUMOS DE OFICINA',
  'INSUMOS INDUSTRIALES', 'MECANICA Y SELLOS', 'NEUMATICA', 'INSUMOS DE LIMPIEZA',
  'FUMICACION', 'EQUIPOS DE CARNICERIA', 'FARMACIA', 'MEDICION Y MANIPULACION',
  'ENCERADOS', 'PUBLICIDAD',
];

const MATERIAL_UNITS = [
  'KG', 'LT', 'ROL', 'PAQ', 'SACO', 'GAL', 'UND', 'MT', 'RESMA', 'PZA', 'TAMB', 'MILL', 'CAJA'
];

const AddMaterialToSupplierDialog: React.FC<AddMaterialToSupplierDialogProps> = ({
  isOpen,
  onClose,
  onMaterialAdded,
  supplierId,
  supplierName,
}) => {
  const { session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [materialName, setMaterialName] = useState('');
  const [category, setCategory] = useState(MATERIAL_CATEGORIES[0]);
  const [unit, setUnit] = useState(MATERIAL_UNITS[0]);
  const [isExempt, setIsExempt] = useState(false);
  const [specification, setSpecification] = useState('');
  const [existingMaterial, setExistingMaterial] = useState<Material | null>(null);

  const resetForm = () => {
    setMaterialName('');
    setCategory(MATERIAL_CATEGORIES[0]);
    setUnit(MATERIAL_UNITS[0]);
    setIsExempt(false);
    setSpecification('');
    setExistingMaterial(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddMaterial = async () => {
    if (!session?.user?.id) {
      showError('No hay sesión activa.');
      return;
    }

    const trimmedMaterialName = materialName.trim();
    if (!trimmedMaterialName) {
      showError('El nombre del material es requerido.');
      return;
    }

    setIsSubmitting(true);

    try {
      let materialToAssociate: Material | null = existingMaterial;

      if (!materialToAssociate) {
        // 1. Check if material already exists by exact name
        const existingMaterials = await searchMaterials(trimmedMaterialName);
        const exactMatch = existingMaterials.find(m => m.name.toLowerCase() === trimmedMaterialName.toLowerCase());

        if (exactMatch) {
          // Found existing material, use it
          materialToAssociate = exactMatch;
          showSuccess(`Material existente "${materialToAssociate.name}" encontrado. Asociando...`);
        } else {
          // 2. Create the new material
          const newMaterial = await createMaterial({
            name: trimmedMaterialName,
            category,
            unit,
            is_exempt: isExempt,
            user_id: session.user.id,
          });

          if (!newMaterial) {
            throw new Error('No se pudo crear el material.');
          }
          materialToAssociate = newMaterial;
          showSuccess('Material creado exitosamente. Asociando...');
        }
      }

      // 3. Associate the material with the supplier
      const relationCreated = await createSupplierMaterialRelation({
        supplier_id: supplierId,
        material_id: materialToAssociate.id,
        specification: specification.trim() || undefined,
        user_id: session.user.id,
      });

      if (!relationCreated) {
        // Note: If the relation already exists, createSupplierMaterialRelation returns false and shows an error.
        // We assume the user wants to update the specification if the relation exists, but the current service only inserts.
        // For simplicity, we rely on the service's error handling for existing relations.
        throw new Error('No se pudo asociar el material con el proveedor (posiblemente ya existe la relación).');
      }

      showSuccess(`Material "${materialToAssociate.name}" asociado con el proveedor exitosamente.`);
      
      // Call the callback with the new material data
      onMaterialAdded({
        id: materialToAssociate.id,
        name: materialToAssociate.name,
        unit: materialToAssociate.unit,
        is_exempt: materialToAssociate.is_exempt,
      });

      handleClose();

    } catch (error: any) {
      console.error('[AddMaterialToSupplierDialog] Error:', error);
      showError(error.message || 'Error al crear/asociar el material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logic to check for existing material as the user types
  const handleMaterialNameChange = async (name: string) => {
    setMaterialName(name);
    const trimmedName = name.trim();
    if (trimmedName.length > 2) {
      const existingMaterials = await searchMaterials(trimmedName);
      const exactMatch = existingMaterials.find(m => m.name.toLowerCase() === trimmedName.toLowerCase());
      setExistingMaterial(exactMatch || null);
    } else {
      setExistingMaterial(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Material</DialogTitle>
          <DialogDescription>
            Crea un nuevo material o asocia uno existente a <strong>{supplierName}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="materialName">Nombre del Material *</Label>
            <Input
              id="materialName"
              placeholder="Ej: Pollo entero, Carne molida..."
              value={materialName}
              onChange={(e) => handleMaterialNameChange(e.target.value)}
              disabled={isSubmitting}
            />
            {existingMaterial && (
              <p className="text-sm text-blue-600">
                Material existente encontrado: <strong>{existingMaterial.name}</strong>. Se asociará este material con la nueva especificación.
              </p>
            )}
          </div>

          {!existingMaterial && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="unit">Unidad</Label>
                  <Select value={unit} onValueChange={setUnit} disabled={isSubmitting}>
                    <SelectTrigger id="unit">
                      <SelectValue placeholder="Selecciona unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_UNITS.map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Exento de IVA</Label>
                  <p className="text-sm text-muted-foreground">
                    Marcar si este material no debe incluir IVA.
                  </p>
                </div>
                <Switch
                  checked={isExempt}
                  onCheckedChange={setIsExempt}
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="specification">Especificación (Opcional)</Label>
            <Input
              id="specification"
              placeholder="Ej: Presentación de 10kg, Marca X..."
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleAddMaterial} disabled={isSubmitting} className="bg-procarni-secondary hover:bg-green-700">
            {isSubmitting ? 'Guardando...' : (existingMaterial ? 'Asociar Material Existente' : 'Crear y Asociar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMaterialToSupplierDialog;