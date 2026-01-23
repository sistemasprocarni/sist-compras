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
      console.warn('[debug-storage-v2] Unauthorized: No Authorization header');
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
      console.warn('[debug-storage-v2] Unauthorized: Invalid user session');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    console.log(`[debug-storage-v2] Starting diagnostic for user: ${user.email}`);

    // 1. List all buckets
    const { data: buckets, error: listBucketsError } = await supabaseClient.storage.listBuckets();
    if (listBucketsError) {
      console.error('[debug-storage-v2] Error listing buckets:', listBucketsError);
      return new Response(JSON.stringify({ 
        error: 'Error listing buckets', 
        details: listBucketsError 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[debug-storage-v2] Available buckets:`, buckets);

    // 2. Get bucket details
    const { data: bucket, error: bucketError } = await supabaseClient.storage.getBucket('documents');
    if (bucketError) {
      console.error('[debug-storage-v2] Error getting bucket details:', bucketError);
      return new Response(JSON.stringify({ 
        error: 'Error getting bucket details', 
        details: bucketError,
        availableBuckets: buckets
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[debug-storage-v2] Bucket details:`, bucket);

    // 3. Create a test file
    const testContent = new TextEncoder().encode('This is a test file for storage diagnostics.');
    const fileName = `debug/test-${Date.now()}.txt`;

    // 4. Attempt to upload the test file
    console.log(`[debug-storage-v2] Attempting to upload test file: ${fileName}`);
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(fileName, testContent, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) {
      console.error('[debug-storage-v2] Upload error:', uploadError);
      return new Response(JSON.stringify({ 
        error: 'Upload failed', 
        details: uploadError,
        bucketInfo: bucket,
        availableBuckets: buckets
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[debug-storage-v2] Upload successful:`, uploadData);

    // 5. Create a signed URL for the uploaded file
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('documents')
      .createSignedUrl(fileName, 60); // 60 seconds

    if (signedUrlError) {
      console.error('[debug-storage-v2] Signed URL error:', signedUrlError);
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

    console.log(`[debug-storage-v2] Signed URL created:`, signedUrlData);

    // 6. Clean up the test file
    const { error: removeError } = await supabaseClient.storage
      .from('documents')
      .remove([fileName]);

    if (removeError) {
      console.warn('[debug-storage-v2] Warning: Could not remove test file:', removeError);
    } else {
      console.log(`[debug-storage-v2] Test file removed successfully.`);
    }

    const successMessage = `[debug-storage-v2] Diagnostic completed successfully for user: ${user.email}`;
    console.log(successMessage);

    return new Response(JSON.stringify({
      message: 'Diagnostic completed successfully',
      availableBuckets: buckets,
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
    console.error('[debug-storage-v2] General error:', error);
    return new Response(JSON.stringify({ 
      error: 'General error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});