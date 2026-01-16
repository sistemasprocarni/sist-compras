// supabase/functions/generate-po-pdf/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// Para la generación de PDF en Deno, podrías usar una librería como 'html-pdf' si es compatible,
// o generar HTML y luego usar un servicio externo para convertirlo a PDF.
// Para este ejemplo, simularemos la generación y devolveremos un placeholder.

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
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { orderId } = await req.json();
    console.log(`[generate-po-pdf] Generating PDF for order ID: ${orderId} by user: ${user.email}`);

    // --- Lógica de obtención de datos de la orden de compra ---
    const { data: order, error: orderError } = await supabaseClient
      .from('purchase_orders')
      .select(`
        *,
        suppliers (name, rif, email, phone),
        companies (name, logo_url, fiscal_data)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error(`[generate-po-pdf] Error fetching order ${orderId}:`, orderError);
      return new Response(JSON.stringify({ error: 'Order not found or access denied.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: items, error: itemsError } = await supabaseClient
      .from('purchase_order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError) {
      console.error(`[generate-po-pdf] Error fetching order items for ${orderId}:`, itemsError);
      return new Response(JSON.stringify({ error: 'Error fetching order items.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Lógica de generación de HTML para el PDF ---
    // Aquí construirías el HTML que representa tu plantilla A4.
    // Esto puede ser complejo y requerir un motor de plantillas o construcción manual.
    // Para este ejemplo, es un HTML muy básico.
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Orden de Compra #${order.sequence_number}</title>
        <style>
          body { font-family: sans-serif; margin: 20mm; font-size: 10pt; }
          .header { text-align: center; margin-bottom: 20mm; }
          .header img { max-width: 150px; height: auto; }
          .header h1 { font-size: 18pt; margin: 5mm 0; }
          .details { margin-bottom: 10mm; }
          .details p { margin: 1mm 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10mm; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total-section { text-align: right; margin-top: 10mm; }
          .footer { text-align: center; margin-top: 30mm; font-size: 8pt; }
          .signature-line { border-top: 1px solid black; width: 200px; margin: 5mm auto 0; }
        </style>
      </head>
      <body>
        <div class="header">
          ${order.companies?.logo_url ? `<img src="${order.companies.logo_url}" alt="Company Logo">` : ''}
          <h1>ORDEN DE COMPRA #${order.sequence_number}</h1>
          <p>${order.companies?.name}</p>
          <p>Fecha: ${new Date(order.created_at).toLocaleDateString()}</p>
        </div>

        <div class="details">
          <p><strong>Proveedor:</strong> ${order.suppliers?.name} (RIF: ${order.suppliers?.rif})</p>
          <p><strong>Email Proveedor:</strong> ${order.suppliers?.email}</p>
          <p><strong>Términos de Pago:</strong> ${order.payment_terms}</p>
          <p><strong>Moneda:</strong> ${order.currency} ${order.exchange_rate ? `(Tasa: ${order.exchange_rate})` : ''}</p>
          <p><strong>Estado:</strong> ${order.status}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Cantidad</th>
              <th>Precio Unitario</th>
              <th>IVA (%)</th>
              <th>Exento</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items?.map(item => `
              <tr>
                <td>${item.material_name}</td>
                <td>${item.quantity}</td>
                <td>${item.unit_price.toFixed(2)}</td>
                <td>${(item.tax_rate * 100).toFixed(0)}%</td>
                <td>${item.is_exempt ? 'Sí' : 'No'}</td>
                <td>${(item.quantity * item.unit_price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <!-- Aquí podrías calcular y mostrar los totales usando la utilidad calculateTotals -->
          <p><strong>Total:</strong> ${order.currency} ${order.total_amount ? order.total_amount.toFixed(2) : 'N/A'}</p>
        </div>

        <div class="footer">
          <p>Generado por: ${order.created_by || user.email}</p>
          <div class="signature-line"></div>
          <p>Firma Autorizada</p>
        </div>
      </body>
      </html>
    `;

    // --- Simulación de generación de PDF ---
    // En un entorno real, aquí usarías una librería Deno para convertir HTML a PDF
    // o enviarías el HTML a un servicio externo (ej. https://pdf.co, https://gotenberg.dev)
    // Para este ejemplo, simplemente devolveremos el HTML como un archivo de texto.
    // Si necesitas un PDF real, esto requerirá una integración más profunda o un servicio externo.

    // Para un PDF real, la respuesta sería algo como:
    // const pdfBuffer = await generatePdfFromHtml(htmlContent); // Función hipotética
    // return new Response(pdfBuffer, {
    //   headers: { ...corsHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="orden_compra_${order.sequence_number}.pdf"` },
    // });

    // Devolviendo el HTML como texto para demostración
    return new Response(htmlContent, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html', 'Content-Disposition': `inline; filename="orden_compra_${order.sequence_number}.html"` },
    });

  } catch (error) {
    console.error('[generate-po-pdf] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});