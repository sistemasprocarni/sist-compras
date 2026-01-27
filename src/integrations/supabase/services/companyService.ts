// src/integrations/supabase/services/companyService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { Company } from '../types';
import { logAudit } from './auditLogService';

const CompanyService = {
  getAll: async (): Promise<Company[]> => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CompanyService.getAll] Error:', error);
      showError('Error al cargar empresas.');
      return [];
    }
    return data;
  },

  create: async (companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>): Promise<Company | null> => {
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert(companyData)
      .select()
      .single();

    if (error) {
      console.error('[CompanyService.create] Error:', error);
      showError('Error al crear la empresa.');
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('CREATE_COMPANY', { 
      company_id: newCompany.id, 
      name: newCompany.name, 
      rif: newCompany.rif 
    });
    // -----------------
    
    return newCompany;
  },

  update: async (id: string, updates: Partial<Omit<Company, 'id' | 'created_at' | 'updated_at'>>): Promise<Company | null> => {
    const { data: updatedCompany, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[CompanyService.update] Error:', error);
      showError('Error al actualizar la empresa.');
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('UPDATE_COMPANY', { 
      company_id: id, 
      updates: updates 
    });
    // -----------------
    
    return updatedCompany;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[CompanyService.delete] Error:', error);
      showError('Error al eliminar la empresa.');
      return false;
    }

    // --- AUDIT LOG ---
    logAudit('DELETE_COMPANY', { company_id: id });
    // -----------------
    
    return true;
  },

  search: async (query: string): Promise<Company[]> => {
    // Si la consulta está vacía, devuelve las primeras 10 empresas como sugerencias
    if (!query.trim()) {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true })
        .limit(10); // Limita a 10 sugerencias

      if (error) {
        console.error('[CompanyService.search] Error fetching default companies:', error);
        return [];
      }
      return data;
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .or(`name.ilike.%${query}%,rif.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('[CompanyService.search] Error:', error);
      return [];
    }
    return data;
  },
};

export const {
  getAll: getAllCompanies,
  create: createCompany,
  update: updateCompany,
  delete: deleteCompany,
  search: searchCompanies,
} = CompanyService;