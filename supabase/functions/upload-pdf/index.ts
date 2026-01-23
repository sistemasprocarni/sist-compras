import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('[upload-pdf] Unauthorized: No Authorization header');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Conexión a la PRIMERA cuenta de Supabase para verificar la autenticación del usuario
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      console.warn('[upload-pdf] Unauthorized: Invalid user session');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { base64Data, filename } = await req.json();
    console.log(`[upload-pdf] Uploading PDF for user: ${user.email}, filename: ${filename}`);

    // Conexión a la SEGUNDA cuenta de Supabase para subir el archivo
    const secondSupabaseClient = createClient(
      "https://rmafhltpjrctlfpprufp.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtYWZobHRwanJjdGxmcHBydWZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNzkyNTksImV4cCI6MjA4NDc1NTI1OX0.kDK8-xcCEjzRhWSMcFNNMkf0LCNPjnfgRHijT4RG9J8"
    );

    // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
    let base64Clean = base64Data;
    if (base64Clean.startsWith('data:')) {
      const commaIndex = base64Clean.indexOf(',');
      if (commaIndex > -1) {
        base64Clean = base64Clean.substring(commaIndex + 1);
      }
    }

    // Convert base64 to Uint8Array
    const fileBuffer = Uint8Array.from(atob(base64Clean), (c) => c.charCodeAt(0));

    // Upload file to the second Supabase account
    const { data, error } = await secondSupabaseClient.storage
      .from('pdf-temporales')
      .upload(filename, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true, // Overwrite if file exists
      });

    if (error) {
      console.error('[upload-pdf] Error uploading file:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the public URL
    const { data: urlData } = secondSupabaseClient.storage
      .from('pdf-temporales')
      .getPublicUrl(filename);

    console.log(`[upload-pdf] File uploaded successfully. Public URL: ${urlData.publicUrl}`);

    return new Response(JSON.stringify({ publicUrl: urlData.publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[upload-pdf] General error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error desconocido en la función Edge.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});