// src/integrations/supabase/services/profileService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { Profile } from '../types';
import { logAudit } from './auditLogService';

const ProfileService = {
  getAll: async (): Promise<Profile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true });

    if (error) {
      console.error('[ProfileService.getAll] Error:', error);
      showError('Error al cargar perfiles de usuario.');
      return [];
    }
    return data as Profile[];
  },

  update: async (id: string, updates: Partial<Omit<Profile, 'id' | 'updated_at'>>): Promise<Profile | null> => {
    // Ensure username is stored in lowercase for consistency
    if (updates.username) {
      updates.username = updates.username.toLowerCase();
    }
    
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[ProfileService.update] Error:', error);
      showError(`Error al actualizar el perfil: ${error.message}`);
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('UPDATE_PROFILE', { 
      table: 'profiles',
      record_id: id, 
      description: `Actualización de perfil de usuario: ${updatedProfile.username}`,
      updates: updates 
    });
    // -----------------
    
    return updatedProfile;
  },
  
  // Note: Deleting a profile should be handled by Supabase Auth trigger when auth.users is deleted.
  // We won't expose a direct delete function here.
};

export const {
  getAll: getAllProfiles,
  update: updateProfile,
} = ProfileService;