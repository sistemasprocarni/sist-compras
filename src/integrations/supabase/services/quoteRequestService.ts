// src/integrations/supabase/services/quoteRequestService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { QuoteRequest, QuoteRequestItem } from '../types';
import { logAudit } from './auditLogService';

const QuoteRequestService = {
  getAll: async (statusFilter: 'Active' | 'Archived' = 'Active'): Promise<QuoteRequest[]> => {
    let query = supabase
      .from('quote_requests')
      .select('*, suppliers(name), companies(name)')
      .order('created_at', { ascending: false });

    if (statusFilter === 'Active') {
      // Excluir 'Archived'
      query = query.neq('status', 'Archived');
    } else if (statusFilter === 'Archived') {
      // Solo incluir 'Archived'
      query = query.eq('status', 'Archived');
    }
    // Si statusFilter es algo más (ej. 'All'), no se aplica filtro de estado.

    const { data, error } = await query;

    if (error) {
      console.error('[QuoteRequestService.getAll] Error:', error);
      showError('Error al cargar solicitudes de cotización.');
      return [];
    }
    return data;
  },

  create: async (requestData: Omit<QuoteRequest, 'id' | 'created_at'>, items: Omit<QuoteRequestItem, 'id' | 'request_id'>[]): Promise<QuoteRequest | null> => {
    const { data: newRequest, error: requestError } = await supabase
      .from('quote_requests')
      .insert(requestData)
      .select()
      .single();

    if (requestError) {
      console.error('[QuoteRequestService.create] Error:', requestError);
      showError('Error al crear la solicitud de cotización.');
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('CREATE_QUOTE_REQUEST', { 
      request_id: newRequest.id, 
      supplier_id: newRequest.supplier_id, 
      company_id: newRequest.company_id,
      items_count: items.length
    });
    // -----------------

    if (items && items.length > 0) {
      const requestItems = items.map(item => ({
        request_id: newRequest.id,
        material_name: item.material_name,
        quantity: item.quantity,
        description: item.description,
        unit: item.unit,
        // is_exempt removed
      }));

      const { error: itemsError } = await supabase
        .from('quote_request_items')
        .insert(requestItems);

      if (itemsError) {
        console.error('[QuoteRequestService.create] Error al crear ítems:', itemsError);
        showError('Error al crear los ítems de la solicitud.');
        return null;
      }
    }

    return newRequest;
  },

  update: async (id: string, updates: Partial<Omit<QuoteRequest, 'id' | 'created_at'>>, items: Omit<QuoteRequestItem, 'id' | 'request_id'>[]): Promise<QuoteRequest | null> => {
    const { data: updatedRequest, error: requestError } = await supabase
      .from('quote_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (requestError) {
      console.error('[QuoteRequestService.update] Error:', requestError);
      showError('Error al actualizar la solicitud de cotización.');
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('UPDATE_QUOTE_REQUEST', { 
      request_id: id, 
      updates: updates,
      items_count: items.length
    });
    // -----------------

    // Eliminar ítems existentes
    const { error: deleteError } = await supabase
      .from('quote_request_items')
      .delete()
      .eq('request_id', id);

    if (deleteError) {
      console.error('[QuoteRequestService.update] Error al eliminar ítems antiguos:', deleteError);
      showError('Error al actualizar los ítems de la solicitud.');
      return null;
    }

    // Insertar nuevos ítems
    if (items && items.length > 0) {
      const requestItems = items.map(item => ({
        request_id: id,
        material_name: item.material_name,
        quantity: item.quantity,
        description: item.description,
        unit: item.unit,
        // is_exempt removed
      }));

      const { error: itemsError } = await supabase
        .from('quote_request_items')
        .insert(requestItems);

      if (itemsError) {
        console.error('[QuoteRequestService.update] Error al crear nuevos ítems:', itemsError);
        showError('Error al actualizar los ítems de la solicitud.');
        return null;
      }
    }

    return updatedRequest;
  },
  
  updateStatus: async (id: string, newStatus: 'Draft' | 'Sent' | 'Archived' | 'Approved'): Promise<boolean> => {
    const { error } = await supabase
      .from('quote_requests')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error(`[QuoteRequestService.updateStatus] Error updating status to ${newStatus}:`, error);
      showError(`Error al actualizar el estado de la solicitud a ${newStatus}.`);
      return false;
    }

    // --- AUDIT LOG ---
    logAudit('UPDATE_QUOTE_REQUEST_STATUS', { 
      request_id: id, 
      new_status: newStatus 
    });
    // -----------------
    
    return true;
  },

  archive: async (id: string): Promise<boolean> => {
    return QuoteRequestService.updateStatus(id, 'Archived');
  },

  unarchive: async (id: string): Promise<boolean> => {
    return QuoteRequestService.updateStatus(id, 'Draft');
  },

  delete: async (id: string): Promise<boolean> => {
    // Mantener la función de eliminación física por si acaso, pero no se usará en la UI de gestión.
    const { error } = await supabase
      .from('quote_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[QuoteRequestService.delete] Error:', error);
      showError('Error al eliminar la solicitud de cotización.');
      return false;
    }

    // --- AUDIT LOG ---
    logAudit('DELETE_QUOTE_REQUEST', { request_id: id });
    // -----------------
    
    return true;
  },

  getById: async (id: string): Promise<QuoteRequest | null> => {
    const { data, error } = await supabase
      .from('quote_requests')
      .select('*, suppliers(*), companies(*), quote_request_items(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[QuoteRequestService.getById] Error:', error);
      return null;
    }
    return data;
  },
};

export const {
  getAll: getAllQuoteRequests,
  create: createQuoteRequest,
  update: updateQuoteRequest,
  delete: deleteQuoteRequest,
  getById: getQuoteRequestDetails,
  archive: archiveQuoteRequest,
  unarchive: unarchiveQuoteRequest,
  updateStatus: updateQuoteRequestStatus,
} = QuoteRequestService;