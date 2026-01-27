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

  log: async (action: string, details: any = {}): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    const user_email = user?.email;

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action,
        user_email,
        details,
      });

    if (error) {
      console.error('[AuditLogService.log] Error logging audit event:', error);
    }
  }
};

export const {
  getAll: getAllAuditLogs,
  log: logAudit,
} = AuditLogService;