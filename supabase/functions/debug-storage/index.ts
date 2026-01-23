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
      console.warn('[debug-storage] Unauthorized: No Authorization header');
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
      console.warn('[debug-storage] Unauthorized: Invalid user session');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    console.log(`[debug-storage] Starting diagnostic for user: ${user.email}`);

    // 1. Check bucket existence and permissions
    const { data: bucket, error: bucketError } = await supabaseClient.storage.getBucket('documents');
    if (bucketError) {
      console.error('[debug-storage] Error getting bucket:', bucketError);
      return new Response(JSON.stringify({ 
        error: 'Error getting bucket', 
        details: bucketError 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[debug-storage] Bucket info:`, bucket);

    // 2. Create a test file
    const testContent = new TextEncoder().encode('This is a test file for storage diagnostics.');
    const fileName = `debug/test-${Date.now()}.txt`;

    // 3. Attempt to upload the test file
    console.log(`[debug-storage] Attempting to upload test file: ${fileName}`);
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(fileName, testContent, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) {
      console.error('[debug-storage] Upload error:', uploadError);
      return new Response(JSON.stringify({ 
        error: 'Upload failed', 
        details: uploadError,
        bucketInfo: bucket
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[debug-storage] Upload successful:`, uploadData);

    // 4. Create a signed URL for the uploaded file
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('documents')
      .createSignedUrl(fileName, 60); // 60 seconds

    if (signedUrlError) {
      console.error('[debug-storage] Signed URL error:', signedUrlError);
      return new Response(JSON.stringify({ 
        error: 'Signed URL creation failed', 
        details: signedUrlError,
        uploadData: uploadData,
        bucketInfo: bucket
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[debug-storage] Signed URL created:`, signedUrlData);

    // 5. Clean up the test file
    const { error: removeError } = await supabaseClient.storage
      .from('documents')
      .remove([fileName]);

    if (removeError) {
      console.warn('[debug-storage] Warning: Could not remove test file:', removeError);
    } else {
      console.log(`[debug-storage] Test file removed successfully.`);
    }

    const successMessage = `[debug-storage] Diagnostic completed successfully for user: ${user.email}`;
    console.log(successMessage);

    return new Response(JSON.stringify({
      message: 'Diagnostic completed successfully',
      bucketInfo: bucket,
      uploadTest: {
        status: 'success',
        fileName: fileName,
        signedUrl: signedUrlData.signedUrl,
      },
      cleanup: removeError ? 'failed' : 'success',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[debug-storage] General error:', error);
    return new Response(JSON.stringify({ 
      error: 'General error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});