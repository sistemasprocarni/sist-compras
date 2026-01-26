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

    // --- 1. Google Drive Authentication and Upload ---
    
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

    // Metadata for the file
    const metadata = {
      name: fileName,
      parents: [driveFolderId],
      mimeType: mimeType,
    };

    // Boundary for multipart request
    const boundary = 'foo_bar_baz';
    
    // Part 1: Metadata
    const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    
    // Part 2: File content (Base64 encoded for the body)
    const filePartHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
    const filePartFooter = `\r\n--${boundary}--`;

    // Base64 encode the file buffer for the body
    const fileBase64Encoded = btoa(String.fromCharCode(...fileBuffer));
    
    // Combine parts into a single buffer
    const encoder = new TextEncoder();
    const metadataBuffer = encoder.encode(metadataPart);
    const fileHeaderBuffer = encoder.encode(filePartHeader);
    const fileContentBuffer = encoder.encode(fileBase64Encoded);
    const fileFooterBuffer = encoder.encode(filePartFooter);

    const requestBody = new Uint8Array(
      metadataBuffer.length + 
      fileHeaderBuffer.length + 
      fileContentBuffer.length + 
      fileFooterBuffer.length
    );

    let offset = 0;
    requestBody.set(metadataBuffer, offset);
    offset += metadataBuffer.length;
    requestBody.set(fileHeaderBuffer, offset);
    offset += fileHeaderBuffer.length;
    requestBody.set(fileContentBuffer, offset);
    offset += fileContentBuffer.length;
    requestBody.set(fileFooterBuffer, offset);

    // Upload file to Google Drive
    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': requestBody.length.toString(),
      },
      body: requestBody,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[upload-ficha-tecnica] Drive Upload Error:', errorText);
      
      let errorMessage = `Error al subir archivo a Google Drive: ${errorText}`;
      
      // Check for 404 error specifically related to the folder ID
      if (uploadResponse.status === 404 && errorText.includes(driveFolderId)) {
          errorMessage = `Error 404: La carpeta de Google Drive con ID '${driveFolderId}' no fue encontrada. Por favor, verifica que el secreto DRIVE_FOLDER_ID sea correcto y que la Service Account tenga permisos de edición en esa carpeta.`;
      }

      throw new Error(errorMessage);
    }

    const driveFile = await uploadResponse.json();
    driveFileId = driveFile.id;
    console.log(`[upload-ficha-tecnica] File uploaded successfully. ID: ${driveFileId}`);

    // --- 2. Set Public Read Permissions ---
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
      console.warn('[upload-ficha-tecnica] Permission Error:', errorText);
      // Log warning but continue, as file is uploaded
    } else {
      console.log(`[upload-ficha-tecnica] Public read permission set for file ${driveFileId}.`);
    }

    // --- 3. Get Web View Link ---
    const fileDetailsResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=webViewLink`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!fileDetailsResponse.ok) {
      const errorText = await fileDetailsResponse.text();
      console.error('[upload-ficha-tecnica] Details Fetch Error:', errorText);
      throw new Error(`Error al obtener el enlace de visualización de Google Drive.`);
    }

    const fileDetails = await fileDetailsResponse.json();
    urlVisualizacion = fileDetails.webViewLink;
    console.log(`[upload-ficha-tecnica] Web View Link: ${urlVisualizacion}`);

    // --- 4. Insert Metadata into Supabase ---
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