import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { showError, showSuccess } from '@/utils/toast';
import { createMaterial, createSupplierMaterialRelation, searchMaterials } from '@/integrations/supabase/data';
import { useSession } from '@/components/SessionContextProvider';
import { Material } from '@/integrations/supabase/types';
import { Loader2 } from 'lucide-react';

interface MaterialCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // onMaterialCreated returns the created material object plus the specification entered in the dialog
  onMaterialCreated: (material: Material & { specification?: string }) => void;
  // supplierId is now optional. If provided, association happens immediately.
  supplierId?: string; 
  supplierName?: string; // Optional if supplierId is not provided
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

const MaterialCreationDialog: React.FC<MaterialCreationDialogProps> = ({
  isOpen,
  onClose,
  onMaterialCreated,
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
  const [isCheckingExistence, setIsCheckingExistence] = useState(false);

  const resetForm = () => {
    setMaterialName('');
    setCategory(MATERIAL_CATEGORIES[0]);
    setUnit(MATERIAL_UNITS[0]);
    setIsExempt(false);
    setSpecification('');
    setExistingMaterial(null);
    setIsCheckingExistence(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Logic to check for existing material as the user types (debounced check)
  useEffect(() => {
    if (!isOpen) return;

    const delayDebounceFn = setTimeout(async () => {
      const trimmedName = materialName.trim();
      if (trimmedName.length > 2) {
        setIsCheckingExistence(true);
        try {
          // Search for materials, then check for exact match (case insensitive)
          const existingMaterials = await searchMaterials(trimmedName);
          const exactMatch = existingMaterials.find(m => m.name.toUpperCase() === trimmedName.toUpperCase());
          
          if (exactMatch) {
            setExistingMaterial(exactMatch);
            // Pre-fill fields from existing material
            setCategory(exactMatch.category || MATERIAL_CATEGORIES[0]);
            setUnit(exactMatch.unit || MATERIAL_UNITS[0]);
            setIsExempt(exactMatch.is_exempt || false);
          } else {
            setExistingMaterial(null);
            // Reset fields to default if no match found
            setCategory(MATERIAL_CATEGORIES[0]);
            setUnit(MATERIAL_UNITS[0]);
            setIsExempt(false);
          }
        } catch (e) {
          console.error("Error checking material existence:", e);
          setExistingMaterial(null);
        } finally {
          setIsCheckingExistence(false);
        }
      } else {
        setExistingMaterial(null);
        setIsCheckingExistence(false);
      }
    }, 500); // Debounce time

    return () => clearTimeout(delayDebounceFn);
  }, [materialName, isOpen]);


  const handleAddMaterial = async () => {
    if (!session?.user?.id) {
      showError('No hay sesión activa.');
      return;
    }

    const trimmedMaterialName = materialName.trim().toUpperCase(); // Ensure uppercase for saving
    if (!trimmedMaterialName) {
      showError('El nombre del material es requerido.');
      return;
    }

    setIsSubmitting(true);

    try {
      let materialToAssociate: Material | null = existingMaterial;

      if (!materialToAssociate) {
        // If no existing material was detected, create the new material
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
        showSuccess('Material creado exitosamente.');
      } else {
        showSuccess(`Material existente "${materialToAssociate.name}" asociado.`);
      }

      // 3. Associate the material with the supplier IF supplierId is provided
      if (supplierId && materialToAssociate) {
        const relationCreated = await createSupplierMaterialRelation({
          supplier_id: supplierId,
          material_id: materialToAssociate.id,
          specification: specification.trim() || undefined,
          user_id: session.user.id,
        });

        if (!relationCreated) {
          showError('Advertencia: La relación con el proveedor ya existía o falló la asociación.');
        } else {
          showSuccess(`Material "${materialToAssociate.name}" asociado con el proveedor exitosamente.`);
        }
      } else if (!supplierId && materialToAssociate) {
        showSuccess(`Material "${materialToAssociate.name}" creado.`);
      }
      
      // 4. Call the callback with the material data and specification
      if (materialToAssociate) {
        onMaterialCreated({
          ...materialToAssociate,
          specification: specification.trim(),
        });
      }

      handleClose();

    } catch (error: any) {
      console.error('[MaterialCreationDialog] Error:', error);
      showError(error.message || 'Error al crear/asociar el material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogDescription = supplierId 
    ? `Crea un nuevo material o asocia uno existente a ${supplierName ? <strong>{supplierName}</strong> : 'este proveedor'}.`
    : 'Crea un nuevo material. Si estás creando un nuevo proveedor, este material se asociará al guardar el formulario.';

  const isMaterialNameValid = materialName.trim().length > 0;
  const isExistingMaterial = !!existingMaterial;
  const submitButtonText = isExistingMaterial ? 'Asociar Material' : 'Crear y Asociar';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Material</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="materialName">Nombre del Material *</Label>
            <Input
              id="materialName"
              placeholder="Ej: Pollo entero, Carne molida..."
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              disabled={isSubmitting}
            />
            {isCheckingExistence && (
              <p className="text-sm text-muted-foreground flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validando existencia...
              </p>
            )}
            {isExistingMaterial && !isCheckingExistence && (
              <p className="text-sm text-blue-600">
                Material existente detectado: <strong>{existingMaterial.name}</strong>. Se usará este material.
              </p>
            )}
            {!isExistingMaterial && isMaterialNameValid && !isCheckingExistence && (
              <p className="text-sm text-yellow-600">
                Material nuevo: <strong>{materialName.toUpperCase()}</strong>. Se creará al guardar.
              </p>
            )}
          </div>

          {/* Fields for new material creation or viewing existing material details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={category} onValueChange={setCategory} disabled={isSubmitting || isExistingMaterial}>
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
              <Select value={unit} onValueChange={setUnit} disabled={isSubmitting || isExistingMaterial}>
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
              disabled={isSubmitting || isExistingMaterial}
            />
          </div>

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
          <Button onClick={handleAddMaterial} disabled={isSubmitting || !isMaterialNameValid || isCheckingExistence}>
            {isSubmitting ? 'Guardando...' : submitButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialCreationDialog;