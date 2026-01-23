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

    // Determine the sender email based on the user's email
    // You need to verify both emails in SendGrid first
    let senderEmail;
    if (user.email === 'sistemasprocarni2025@gmail.com') {
      senderEmail = 'sistemasprocarni2025@gmail.com';
    } else if (user.email === 'analistacompraspc@gmail.com') {
      senderEmail = 'analistacompraspc@gmail.com';
    } else {
      // Default fallback - you should verify this email in SendGrid
      senderEmail = 'sistemasprocarni2025@gmail.com';
    }

    // Prepare email data for SendGrid
    const emailData = {
      personalizations: [{
        to: [{ email: to }]
      }],
      from: {
        email: senderEmail,
        name: user.email // Use user's email as the sender name
      },
      subject: subject,
      html: body,
    };

    // Add attachment if present
    if (attachmentBase64 && attachmentFilename) {
      emailData.attachments = [{
        content: attachmentBase64,
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
      sender: senderEmail 
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