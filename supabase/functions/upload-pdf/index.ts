import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL y clave pública de la SEGUNDA cuenta de Supabase
const SECOND_SUPABASE_URL = "https://rmafhltpjrctlfpprufp.supabase.co";
const SECOND_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtYWZobHRwanJjdGxmcHBydWZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNzkyNTksImV4cCI6MjA4NDc1NTI1OX0.kDK8-xcCEjzRhWSMcFNNMkf0LCNPjnfgRHijT4RG9J8";

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

    const { fileBase64, fileName } = await req.json();
    console.log(`[upload-pdf] User ${user.email} is uploading file: ${fileName}`);

    if (!fileBase64 || !fileName) {
      return new Response(JSON.stringify({ error: 'fileBase64 and fileName are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convertir Base64 a Uint8Array
    const base64Data = fileBase64.replace(/^data:application\/pdf;base64,/, '');
    const fileBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Crear cliente para la SEGUNDA cuenta de Supabase
    const secondSupabaseClient = createClient(SECOND_SUPABASE_URL, SECOND_SUPABASE_ANON_KEY);

    // Subir el archivo al bucket 'pdf-temporales'
    const { data, error } = await secondSupabaseClient.storage
      .from('pdf-temporales')
      .upload(`${user.id}/${fileName}`, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true, // Sobrescribir si ya existe
      });

    if (error) {
      console.error('[upload-pdf] Error uploading file:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtener la URL pública del archivo subido
    const { data: publicUrlData } = secondSupabaseClient.storage
      .from('pdf-temporales')
      .getPublicUrl(`${user.id}/${fileName}`);

    console.log(`[upload-pdf] File uploaded successfully. Public URL: ${publicUrlData.publicUrl}`);

    return new Response(JSON.stringify({ publicUrl: publicUrlData.publicUrl }), {
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