import React, { useState, useEffect, useRef } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface MaterialSearchResult extends Material {
  id: string;
  name: string;
}

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
  
  // State for search suggestions
  const [suggestions, setSuggestions] = useState<MaterialSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedExistingMaterial, setSelectedExistingMaterial] = useState<Material | null>(null); // Material selected from suggestions or exact match

  const debounceTimeoutRef = useRef<number | null>(null);

  const resetForm = () => {
    setMaterialName('');
    setCategory(MATERIAL_CATEGORIES[0]);
    setUnit(MATERIAL_UNITS[0]);
    setIsExempt(false);
    setSpecification('');
    setSuggestions([]);
    setSelectedExistingMaterial(null);
    setIsSearching(false);
    setIsPopoverOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Debounced search for suggestions
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const trimmedName = materialName.trim();
    
    if (trimmedName.length > 2) {
      setIsSearching(true);
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchMaterials(trimmedName);
          setSuggestions(results as MaterialSearchResult[]);
          setIsPopoverOpen(results.length > 0);
          
          // Check for exact match to pre-select if user typed it precisely
          const exactMatch = results.find(m => m.name.toUpperCase() === trimmedName.toUpperCase());
          if (exactMatch) {
            handleSelectSuggestion(exactMatch);
          } else {
            setSelectedExistingMaterial(null);
          }
        } catch (e) {
          console.error("Error searching materials:", e);
          setSuggestions([]);
          setIsPopoverOpen(false);
          setSelectedExistingMaterial(null);
        } finally {
          setIsSearching(false);
        }
      }, 300) as unknown as number;
    } else {
      setSuggestions([]);
      setIsPopoverOpen(false);
      setSelectedExistingMaterial(null);
      setIsSearching(false);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [materialName, isOpen]);

  const handleSelectSuggestion = (material: MaterialSearchResult) => {
    setSelectedExistingMaterial(material);
    setMaterialName(material.name); // Set the name exactly as it is in the DB (uppercase)
    setCategory(material.category || MATERIAL_CATEGORIES[0]);
    setUnit(material.unit || MATERIAL_UNITS[0]);
    setIsExempt(material.is_exempt || false);
    setIsPopoverOpen(false);
  };

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
      let materialToAssociate: Material | null = selectedExistingMaterial;

      if (!materialToAssociate) {
        // If no material was selected, check again for exact match (in case debounce missed it)
        const existingMaterials = await searchMaterials(trimmedMaterialName);
        const exactMatch = existingMaterials.find(m => m.name.toUpperCase() === trimmedMaterialName);

        if (exactMatch) {
          materialToAssociate = exactMatch;
          showSuccess(`Material existente "${materialToAssociate.name}" encontrado.`);
        } else {
          // Create the new material
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
        }
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
    : 'Crea un nuevo material.';

  const isMaterialNameValid = materialName.trim().length > 0;
  const isExistingMaterialSelected = !!selectedExistingMaterial;
  const submitButtonText = isExistingMaterialSelected ? 'Asociar Material' : 'Crear y Asociar';

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
            <Popover open={isPopoverOpen && suggestions.length > 0} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Input
                  id="materialName"
                  placeholder="Ej: Pollo entero, Carne molida..."
                  value={materialName}
                  onChange={(e) => {
                    setMaterialName(e.target.value);
                    setSelectedExistingMaterial(null); // Clear selection on manual change
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setIsPopoverOpen(true);
                  }}
                  disabled={isSubmitting}
                />
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                {isSearching && (
                  <div className="flex items-center p-2 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...
                  </div>
                )}
                {suggestions.length > 0 && (
                  <div className="max-h-40 overflow-y-auto">
                    {suggestions.map((material) => (
                      <div
                        key={material.id}
                        className="p-2 hover:bg-muted rounded cursor-pointer flex justify-between items-center text-sm"
                        onClick={() => handleSelectSuggestion(material)}
                      >
                        <span className="font-medium">{material.name}</span>
                        <Check
                          className={cn(
                            "ml-2 h-4 w-4",
                            selectedExistingMaterial?.id === material.id ? "opacity-100 text-procarni-secondary" : "opacity-0"
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
            
            {isExistingMaterialSelected && (
              <p className="text-sm text-blue-600">
                Material seleccionado: <strong>{selectedExistingMaterial.name}</strong>.
              </p>
            )}
            {!isExistingMaterialSelected && isMaterialNameValid && (
              <p className="text-sm text-yellow-600">
                Se creará un nuevo material: <strong>{materialName.toUpperCase()}</strong>.
              </p>
            )}
          </div>

          {/* Fields for new material creation or viewing existing material details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={category} onValueChange={setCategory} disabled={isSubmitting || isExistingMaterialSelected}>
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
              <Select value={unit} onValueChange={setUnit} disabled={isSubmitting || isExistingMaterialSelected}>
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
              disabled={isSubmitting || isExistingMaterialSelected}
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
          <Button onClick={handleAddMaterial} disabled={isSubmitting || !isMaterialNameValid}>
            {isSubmitting ? 'Guardando...' : submitButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialCreationDialog;