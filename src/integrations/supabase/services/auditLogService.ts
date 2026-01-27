// src/integrations/supabase/services/auditLogService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';

export interface AuditLogEntry {
  id: string;
  action: string;
  user_email?: string;
  details?: any;
  timestamp: string;
}

const AuditLogService = {
  getAll: async (): Promise<AuditLogEntry[]> => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[AuditLogService.getAll] Error:', error);
      showError('Error al cargar el historial de auditoría.');
      return [];
    }
    return data as AuditLogEntry[];
  },
};

export const {
  getAll: getAllAuditLogs,
} = AuditLogService;