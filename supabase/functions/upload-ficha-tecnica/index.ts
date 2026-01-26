import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Google Drive Service Account Authentication ---

async function getGoogleAccessToken(serviceAccountEmail: string, privateKey: string): Promise<string> {
  const now = getNumericDate(0);
  const exp = getNumericDate(3600); // Token expires in 1 hour

  // IMPORTANT: Handle private key formatting (replace escaped newlines with actual newlines)
  const cleanedPrivateKey = privateKey.replace(/\\n/g, '\n');

  // 1. Remove PEM headers/footers and whitespace
  const pemKey = cleanedPrivateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  // 2. Base64 decode to get the DER buffer
  const derKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));

  // Import the private key for signing
  const key = await crypto.subtle.importKey(
    "pkcs8",
    derKey, // Use the DER buffer
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccountEmail,
      scope: "https://www.googleapis.com/auth/drive.file", // Scope for file access
      aud: "https://oauth2.googleapis.com/token",
      exp: exp,
      iat: now,
    },
    key,
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[upload-ficha-tecnica] Failed to get Google Access Token:', errorText);
    throw new Error(`Error al obtener el token de acceso de Google: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// --- Main Edge Function Logic ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let driveFileId: string | null = null;
  let urlVisualizacion: string | null = null;
  let supabaseClient: any = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('[upload-ficha-tecnica] Unauthorized: No Authorization header');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      console.warn('[upload-ficha-tecnica] Unauthorized: Invalid user session');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { 
      nombre_producto, 
      proveedor_id, 
      fileBase64, 
      fileName, 
      mimeType 
    } = await req.json();

    if (!nombre_producto || !proveedor_id || !fileBase64 || !fileName || !mimeType) {
      console.error('[upload-ficha-tecnica] Missing required fields in payload.');
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos (nombre_producto, proveedor_id, fileBase64, fileName, mimeType).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 1. Google Drive Authentication and Setup ---
    
    const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY');
    const driveFolderId = Deno.env.get('DRIVE_FOLDER_ID');

    if (!serviceAccountEmail || !privateKey || !driveFolderId) {
      console.error('[upload-ficha-tecnica] Missing Google Drive secrets.');
      throw new Error('Credenciales de Google Drive (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, DRIVE_FOLDER_ID) no configuradas en el servidor.');
    }

    const accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKey);
    
    // Convert Base64 to binary data
    const fileBuffer = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));

    // --- 2. Create empty file with metadata (Step 1) ---
    const metadata = {
      name: fileName,
      parents: [driveFolderId],
      mimeType: mimeType,
    };

    console.log('[upload-ficha-tecnica] Step 1: Creating file metadata...');
    const createResponse = await fetch(`https://www.googleapis.com/drive/v3/files?fields=id,webViewLink`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[upload-ficha-tecnica] Drive Create Metadata Error:', errorText);
      throw new Error(`Error al crear metadatos del archivo en Google Drive: ${errorText}`);
    }

    const createdFile = await createResponse.json();
    driveFileId = createdFile.id;
    urlVisualizacion = createdFile.webViewLink;
    console.log(`[upload-ficha-tecnica] Metadata created successfully. ID: ${driveFileId}`);

    // --- 3. Upload file content (Step 2: PATCH) ---
    console.log('[upload-ficha-tecnica] Step 2: Uploading file content via PATCH...');
    
    const uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
      },
      body: fileBuffer, // Send binary data directly
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[upload-ficha-tecnica] Drive Upload Content Error:', errorText);
      
      let errorMessage = `Error al subir contenido del archivo a Google Drive: ${errorText}`;
      
      // Check for 403 storage quota error (although less likely here, still possible if permissions are wrong)
      if (uploadResponse.status === 403 && errorText.includes('storageQuotaExceeded')) {
          errorMessage = `Error 403 (Cuota de Almacenamiento Excedida): La Service Account no tiene cuota propia. Asegúrate de que la carpeta de destino (ID: ${driveFolderId}) sea una Unidad Compartida o que la Service Account tenga permisos de 'Editor' o 'Propietario' en la carpeta.`;
      } else if (uploadResponse.status === 404 && errorText.includes(driveFolderId)) {
          errorMessage = `Error 404: La carpeta de Google Drive con ID '${driveFolderId}' no fue encontrada. Por favor, verifica que el secreto DRIVE_FOLDER_ID sea correcto y que la Service Account tenga permisos de edición en esa carpeta.`;
      }

      throw new Error(errorMessage);
    }

    console.log(`[upload-ficha-tecnica] File content uploaded successfully. ID: ${driveFileId}`);

    // --- 4. Set Public Read Permissions ---
    console.log('[upload-ficha-tecnica] Step 3: Setting public read permissions...');
    const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'anyone',
        role: 'reader',
      }),
    });

    if (!permissionResponse.ok) {
      const errorText = await permissionResponse.text();
      console.warn('[upload-ficha-tecnica] Permission Error (Continuing):', errorText);
      // Log warning but continue, as file is uploaded
    } else {
      console.log(`[upload-ficha-tecnica] Public read permission set for file ${driveFileId}.`);
    }

    // --- 5. Insert Metadata into Supabase ---
    const { data: newFicha, error: insertError } = await supabaseClient
      .from('fichas_tecnicas')
      .insert({
        user_id: user.id,
        nombre_producto: nombre_producto,
        proveedor_id: proveedor_id,
        drive_file_id: driveFileId,
        url_visualizacion: urlVisualizacion,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[upload-ficha-tecnica] Supabase Insert Error:', insertError);
      throw new Error(`Error al guardar metadatos en la base de datos: ${insertError.message}`);
    }

    console.log(`[upload-ficha-tecnica] Ficha técnica created successfully: ${newFicha.id}`);

    return new Response(JSON.stringify(newFicha), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during file upload.';
    console.error('[upload-ficha-tecnica] General Error:', errorMessage, error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});