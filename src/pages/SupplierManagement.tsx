// ... código existente hasta la función handleSubmitForm ...

  const handleSubmitForm = async (data: SupplierFormValues) => {
    if (!userId) {
      showError('Usuario no autenticado. No se puede realizar la operación.');
      return;
    }

    const { materials, ...supplierData } = data;
    const materialsPayload = materials?.map(mat => ({
      material_id: mat.material_id,
      specification: mat.specification,
    })) || [];

    if (editingSupplier) {
      await updateMutation.mutateAsync({ id: editingSupplier.id, supplierData, materials: materialsPayload });
    } else {
      await createMutation.mutateAsync({ supplierData, materials: materialsPayload });
    }
  };

// ... resto del código ...