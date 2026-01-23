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
      console.warn('[send-email] Unauthorized: No Authorization header');
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
      console.warn('[send-email] Unauthorized: Invalid user session');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { to, subject, body, attachmentBase64, attachmentFilename } = await req.json();
    console.log(`[send-email] Sending email to: ${to} from user: ${user.email}`);

    // Check for SendGrid API key
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!sendgridApiKey) {
      console.error('[send-email] SENDGRID_API_KEY is not set in environment variables.');
      return new Response(JSON.stringify({ 
        error: 'SendGrid API key not configured. Please set SENDGRID_API_KEY environment variable in Supabase.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use SendGrid shared domain as sender
    // Replace with your actual SendGrid sender email
    const senderEmail = 'noreply@em1234567.sendgrid.net';
    const senderName = 'Portal de Proveedores';

    // Configure multiple reply-to addresses
    const replyTo = [
      {
        email: 'sistemasprocarni2025@gmail.com',
        name: 'Sistemas Procarni'
      },
      {
        email: 'analistacompraspc@gmail.com',
        name: 'Analista de Compras'
      }
    ];

    // Prepare email data for SendGrid
    const emailData = {
      personalizations: [{
        to: [{ email: to }],
        // Add custom headers for better identification
        headers: {
          'X-Application': 'Portal de Proveedores',
          'X-User-Email': user.email,
          'X-Document-Type': 'Solicitud/Orden'
        }
      }],
      from: {
        email: senderEmail,
        name: senderName
      },
      reply_to: replyTo[0], // SendGrid only supports one reply-to in the main field
      // For multiple reply-to, we'll add them in the subject or body
      subject: `[Portal de Proveedores] ${subject}`,
      content: [
        {
          type: 'text/html',
          value: body
        }
      ],
    };

    // Add attachment if present
    if (attachmentBase64 && attachmentFilename) {
      // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
      let base64Data = attachmentBase64;
      if (base64Data.startsWith('data:')) {
        base64Data = base64Data.split(',')[1];
      }
      
      emailData.attachments = [{
        content: base64Data,
        filename: attachmentFilename,
        type: 'application/pdf',
        disposition: 'attachment',
      }];
    }

    // Send email via SendGrid API
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[send-email] SendGrid error:', errorData);
      return new Response(JSON.stringify({ 
        error: `SendGrid error: ${errorData}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[send-email] Email sent successfully via SendGrid');
    return new Response(JSON.stringify({ 
      message: 'Email sent successfully via SendGrid',
      sender: senderEmail,
      replyTo: replyTo
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[send-email] General error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error desconocido en la función Edge.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});