import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'; // Library to parse Excel files

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Re-implementación de validadores y constantes para el entorno Deno
const validateRif = (rif: string): string | null => {
  if (!rif) return null;
  const normalizedRif = rif.replace(/[- ]/g, '').toUpperCase();
  const rifRegex = /^[JVGEP]\d{8,9}$/;
  return rifRegex.test(normalizedRif) ? normalizedRif : null;
};

const MATERIAL_CATEGORIES = [
  'SECA', 'FRESCA', 'EMPAQUE', 'FERRETERIA Y CONSTRUCCION', 'AGROPECUARIA',
  'GASES Y COMBUSTIBLE', 'ELECTRICIDAD', 'REFRIGERACION', 'INSUMOS DE OFICINA',
  'INSUMOS INDUSTRIALES', 'MECANICA Y SELLOS', 'NEUMATICA', 'INSUMOS DE LIMPIEZA',
  'FUMICACION', 'EQUIPOS DE CARNICERIA', 'FARMACIA', 'MEDICION Y MANIPULACION',
  'ENCERADOS',
];

const MATERIAL_UNITS = [
  'KG', 'LT', 'ROL', 'PAQ', 'SACO', 'GAL', 'UND', 'MT', 'RESMA', 'PZA', 'TAMB', 'MILL', 'CAJA'
];

const PAYMENT_TERMS_OPTIONS = ['Contado', 'Crédito', 'Otro'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('[bulk-upload] Unauthorized: No Authorization header');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      console.warn('[bulk-upload] Unauthorized: Invalid user session');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const uploadType = formData.get('type') as string; // 'supplier' or 'material'

    if (!file) {
      console.error('[bulk-upload] No file uploaded.');
      return new Response(JSON.stringify({ error: 'No se ha subido ningún archivo.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['supplier', 'material'].includes(uploadType)) {
      console.error(`[bulk-upload] Invalid upload type: ${uploadType}`);
      return new Response(JSON.stringify({ error: 'Tipo de carga no válido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ row: number; data: any; reason: string }> = [];

    if (uploadType === 'supplier') {
      console.log(`[bulk-upload] Processing supplier upload for user ${user.id}. Rows: ${jsonData.length}`);
      for (let i = 0; i < jsonData.length; i++) {
        const rowData = jsonData[i];
        const rowNum = i + 2; // Excel rows are 1-indexed, plus header row

        const rif = validateRif(rowData['RIF']);
        const name = rowData['Nombre'];
        const email = rowData['Email'];
        const phone = rowData['Teléfono Principal'];
        const phone_2 = rowData['Teléfono Secundario'];
        const instagram = rowData['Instagram'];
        let payment_terms = rowData['Términos de Pago'];
        let custom_payment_terms = rowData['Términos de Pago Personalizados'];
        let credit_days = rowData['Días de Crédito'];
        const status = rowData['Estado'];

        if (!rif) {
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: 'RIF inválido o faltante.' });
          continue;
        }
        if (!name) {
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: 'Nombre del proveedor faltante.' });
          continue;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: 'Formato de Email inválido.' });
          continue;
        }
        if (!payment_terms || !PAYMENT_TERMS_OPTIONS.includes(payment_terms)) {
          // Handle cases where payment_terms might be an old custom value
          if (payment_terms && !PAYMENT_TERMS_OPTIONS.includes(payment_terms)) {
            custom_payment_terms = payment_terms;
            payment_terms = 'Otro';
          } else {
            payment_terms = 'Contado'; // Default if invalid or missing
          }
        }
        if (payment_terms === 'Otro' && (!custom_payment_terms || custom_payment_terms.trim() === '')) {
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: 'Términos de Pago Personalizados requeridos si el tipo es "Otro".' });
          continue;
        }
        if (payment_terms === 'Crédito') {
          if (credit_days === undefined || credit_days === null || isNaN(Number(credit_days)) || Number(credit_days) < 0) {
            failureCount++;
            errors.push({ row: rowNum, data: rowData, reason: 'Días de Crédito requeridos y deben ser un número no negativo para términos de "Crédito".' });
            continue;
          }
          credit_days = Number(credit_days);
        } else {
          credit_days = 0; // Default to 0 if not credit
        }
        if (!status || !['Active', 'Inactive'].includes(status)) {
          status = 'Active'; // Default if invalid or missing
        }

        const supplierData = {
          rif: rif,
          name: name,
          email: email || null,
          phone: phone || null,
          phone_2: phone_2 || null,
          instagram: instagram || null,
          payment_terms: payment_terms,
          custom_payment_terms: custom_payment_terms || null,
          credit_days: credit_days,
          status: status,
          user_id: user.id,
        };

        let supplierId: string | null = null;
        // Check if supplier already exists by RIF
        const { data: existingSupplier, error: fetchError } = await supabaseClient
          .from('suppliers')
          .select('id')
          .eq('rif', rif)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means "no rows found"
          console.error(`[bulk-upload] Error checking existing supplier for RIF ${rif}:`, fetchError);
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: `Error de base de datos al verificar proveedor: ${fetchError.message}` });
          continue;
        }

        let dbOperation;
        if (existingSupplier) {
          supplierId = existingSupplier.id;
          dbOperation = await supabaseClient
            .from('suppliers')
            .update(supplierData)
            .eq('id', supplierId);
          console.log(`[bulk-upload] Updated supplier ${rif}`);
        } else {
          dbOperation = await supabaseClient
            .from('suppliers')
            .insert(supplierData)
            .select('id') // Select the ID of the newly inserted supplier
            .single();
          if (dbOperation.data) {
            supplierId = dbOperation.data.id;
          }
          console.log(`[bulk-upload] Inserted new supplier ${rif}`);
        }

        if (dbOperation.error || !supplierId) {
          console.error(`[bulk-upload] Error saving supplier ${rif}:`, dbOperation.error);
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: `Error al guardar proveedor: ${dbOperation.error?.message || 'No se pudo obtener el ID del proveedor.'}` });
          continue;
        } else {
          successCount++; // Increment success count for supplier header
        }

        // --- Process materials for this supplier ---
        const materialsToProcess = [];
        for (let m = 1; m <= 3; m++) { // Assuming up to 3 materials per supplier row
          const materialNameOrCode = rowData[`Material ${m} (Nombre/Código)`];
          const specification = rowData[`Especificación Material ${m}`];

          if (materialNameOrCode) {
            materialsToProcess.push({
              nameOrCode: String(materialNameOrCode).trim(),
              specification: String(specification || '').trim(),
            });
          }
        }

        if (materialsToProcess.length > 0) {
          for (const mat of materialsToProcess) {
            // Find material_id from 'materials' table
            const { data: materialLookup, error: materialLookupError } = await supabaseClient
              .from('materials')
              .select('id')
              .or(`name.ilike.%${mat.nameOrCode}%,code.ilike.%${mat.nameOrCode}%`)
              .single();

            if (materialLookupError || !materialLookup) {
              console.warn(`[bulk-upload] Material '${mat.nameOrCode}' not found for supplier ${rif}. Skipping association.`);
              errors.push({ row: rowNum, data: rowData, reason: `Material '${mat.nameOrCode}' no encontrado para el proveedor ${rif}.` });
              continue;
            }

            const materialId = materialLookup.id;

            // Check if supplier_material relationship already exists
            const { data: existingSupplierMaterial, error: smFetchError } = await supabaseClient
              .from('supplier_materials')
              .select('id')
              .eq('supplier_id', supplierId)
              .eq('material_id', materialId)
              .single();

            if (smFetchError && smFetchError.code !== 'PGRST116') {
              console.error(`[bulk-upload] Error checking existing supplier_material for supplier ${supplierId}, material ${materialId}:`, smFetchError);
              errors.push({ row: rowNum, data: rowData, reason: `Error de base de datos al verificar relación proveedor-material para '${mat.nameOrCode}': ${smFetchError.message}` });
              continue;
            }

            let smOperation;
            if (existingSupplierMaterial) {
              // Update existing supplier_material
              smOperation = await supabaseClient
                .from('supplier_materials')
                .update({ specification: mat.specification, user_id: user.id })
                .eq('id', existingSupplierMaterial.id);
              console.log(`[bulk-upload] Updated supplier_material for supplier ${rif}, material ${mat.nameOrCode}`);
            } else {
              // Insert new supplier_material
              smOperation = await supabaseClient
                .from('supplier_materials')
                .insert({
                  supplier_id: supplierId,
                  material_id: materialId,
                  specification: mat.specification,
                  user_id: user.id,
                });
              console.log(`[bulk-upload] Inserted new supplier_material for supplier ${rif}, material ${mat.nameOrCode}`);
            }

            if (smOperation.error) {
              console.error(`[bulk-upload] Error saving supplier_material for supplier ${rif}, material ${mat.nameOrCode}:`, smOperation.error);
              errors.push({ row: rowNum, data: rowData, reason: `Error al guardar relación proveedor-material para '${mat.nameOrCode}': ${smOperation.error.message}` });
            }
          }
        }
      }
    } else if (uploadType === 'material') {
      console.log(`[bulk-upload] Processing material upload for user ${user.id}. Rows: ${jsonData.length}`);
      for (let i = 0; i < jsonData.length; i++) {
        const rowData = jsonData[i];
        const rowNum = i + 2;

        let code = rowData['Código']; // Can be null/empty for auto-generation
        const name = rowData['Nombre'];
        const category = rowData['Categoría'];
        const unit = rowData['Unidad'];

        if (!name) {
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: 'Nombre del material faltante.' });
          continue;
        }
        if (!category || !MATERIAL_CATEGORIES.includes(category)) {
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: `Categoría inválida o faltante. Debe ser una de: ${MATERIAL_CATEGORIES.join(', ')}` });
          continue;
        }
        if (!unit || !MATERIAL_UNITS.includes(unit)) {
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: `Unidad inválida o faltante. Debe ser una de: ${MATERIAL_UNITS.join(', ')}` });
          continue;
        }

        const materialData = {
          code: code || null, // Let DB trigger handle if null
          name: name,
          category: category,
          unit: unit,
          user_id: user.id,
        };

        // Check if material already exists by name and category (or code if provided)
        let existingMaterialQuery = supabaseClient
          .from('materials')
          .select('id');

        if (code) {
          existingMaterialQuery = existingMaterialQuery.eq('code', code);
        } else {
          existingMaterialQuery = existingMaterialQuery
            .eq('name', name)
            .eq('category', category);
        }

        const { data: existingMaterial, error: fetchError } = await existingMaterialQuery.single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error(`[bulk-upload] Error checking existing material for row ${rowNum}:`, fetchError);
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: `Error de base de datos al verificar material: ${fetchError.message}` });
          continue;
        }

        let dbOperation;
        if (existingMaterial) {
          // Update existing material
          dbOperation = await supabaseClient
            .from('materials')
            .update(materialData)
            .eq('id', existingMaterial.id);
          console.log(`[bulk-upload] Updated material ${name}`);
        } else {
          // Insert new material
          dbOperation = await supabaseClient
            .from('materials')
            .insert(materialData);
          console.log(`[bulk-upload] Inserted new material ${name}`);
        }

        if (dbOperation.error) {
          console.error(`[bulk-upload] Error saving material ${name}:`, dbOperation.error);
          failureCount++;
          errors.push({ row: rowNum, data: rowData, reason: `Error al guardar material: ${dbOperation.error.message}` });
        } else {
          successCount++;
        }
      }
    }

    const message = `Carga masiva completada. ${successCount} registros exitosos, ${failureCount} con errores.`;
    console.log(`[bulk-upload] ${message}`);

    return new Response(JSON.stringify({ successCount, failureCount, errors, message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[bulk-upload] General error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});