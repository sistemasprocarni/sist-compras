import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

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
      console.warn('[generate-qr-pdf] Unauthorized: No Authorization header');
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
      console.warn('[generate-qr-pdf] Unauthorized: Invalid user session');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { requestId } = await req.json();
    console.log(`[generate-qr-pdf] Generating PDF for quote request ID: ${requestId} by user: ${user.email}`);

    // --- Lógica de obtención de datos de la solicitud de cotización ---
    const { data: request, error: requestError } = await supabaseClient
      .from('quote_requests')
      .select(`
        *,
        suppliers (name, rif, email, phone, phone_2, instagram, address),
        companies (name, logo_url, fiscal_data)
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      console.error(`[generate-qr-pdf] Error fetching quote request ${requestId}:`, requestError);
      return new Response(JSON.stringify({ error: 'Quote request not found or access denied.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: items, error: itemsError } = await supabaseClient
      .from('quote_request_items')
      .select('*')
      .eq('request_id', requestId);

    if (itemsError) {
      console.error(`[generate-qr-pdf] Error fetching quote request items for ${requestId}:`, itemsError);
      return new Response(JSON.stringify({ error: 'Error fetching quote request items.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Generación de PDF con pdf-lib ---
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage(); // Use 'let' because it will be reassigned
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;
    const fontSize = 10;
    const lineHeight = fontSize * 1.2;
    const tableHeaderBgColor = rgb(0.9, 0.9, 0.9);
    const borderColor = rgb(0.8, 0.8, 0.8);

    // Helper para dibujar texto
    const drawText = (text: string, x: number, yPos: number, options: any = {}) => {
      page.drawText(text, {
        x,
        y: yPos,
        font: font,
        size: fontSize,
        color: rgb(0, 0, 0),
        ...options,
      });
    };

    // Table column configuration
    const tableX = margin;
    const tableWidth = width - 2 * margin;
    const colWidths = [tableWidth * 0.25, tableWidth * 0.15, tableWidth * 0.15, tableWidth * 0.3, tableWidth * 0.15];
    const colHeaders = ['Material', 'Cantidad', 'Unidad', 'Descripción', 'Exento IVA'];

    // Function to draw table headers
    const drawTableHeader = () => {
      let currentX = tableX;
      page.drawRectangle({
        x: tableX,
        y: y - lineHeight,
        width: tableWidth,
        height: lineHeight,
        color: tableHeaderBgColor,
        borderColor: borderColor,
        borderWidth: 1,
      });
      for (let i = 0; i < colHeaders.length; i++) {
        drawText(colHeaders[i], currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2, { font: boldFont });
        currentX += colWidths[i];
      }
      y -= lineHeight;
    };

    // Function to check for page breaks and add new page if necessary
    const checkPageBreak = (requiredSpace: number) => {
      if (y - requiredSpace < margin) { // If not enough space for next content block
        page = pdfDoc.addPage();
        y = height - margin;
        drawTableHeader(); // Redraw headers on new page
      }
    };

    // --- Header ---
    if (request.companies?.logo_url) {
      drawText('LOGO EMPRESA', margin, y - 20, { font: boldFont, size: 12 });
    }

    drawText('SOLICITUD DE COTIZACIÓN', width / 2 - boldFont.widthOfText('SOLICITUD DE COTIZACIÓN', { size: 18 }) / 2, y, { font: boldFont, size: 18 });
    y -= lineHeight * 2;
    drawText(`Nº: ${request.id.substring(0, 8)}`, width - margin - 100, y, { font: boldFont, size: 12 });
    drawText(`Fecha: ${new Date(request.created_at).toLocaleDateString('es-VE')}`, width - margin - 100, y - lineHeight);
    y -= lineHeight * 3;

    drawText(`Empresa: ${request.companies?.name || 'N/A'}`, margin, y, { font: boldFont });
    y -= lineHeight;
    drawText(`RIF Empresa: ${request.companies?.fiscal_data?.rif || 'N/A'}`, margin, y);
    y -= lineHeight * 2;

    // --- Detalles del Proveedor ---
    drawText('DATOS DEL PROVEEDOR:', margin, y, { font: boldFont });
    y -= lineHeight;
    drawText(`Nombre: ${request.suppliers?.name || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`RIF: ${request.suppliers?.rif || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`Email: ${request.suppliers?.email || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`Teléfono: ${request.suppliers?.phone || 'N/A'}`, margin, y);
    y -= lineHeight * 2;

    // --- Detalles de la Solicitud ---
    drawText('DETALLES DE LA SOLICITUD:', margin, y, { font: boldFont });
    y -= lineHeight;
    drawText(`Moneda: ${request.currency}`, margin, y);
    y -= lineHeight;
    if (request.exchange_rate) {
      drawText(`Tasa de Cambio: ${request.exchange_rate.toFixed(2)}`, margin, y);
      y -= lineHeight;
    }
    drawText(`Estado: ${request.status}`, margin, y);
    y -= lineHeight * 2;

    // --- Tabla de Ítems Solicitados ---
    drawTableHeader(); // Draw initial table header

    // Dibujar filas de ítems
    for (const item of items) {
      checkPageBreak(lineHeight); // Check before drawing each row
      let currentX = tableX;
      page.drawRectangle({
        x: tableX,
        y: y - lineHeight,
        width: tableWidth,
        height: lineHeight,
        borderColor: borderColor,
        borderWidth: 1,
      });
      drawText(item.material_name, currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[0];
      drawText(item.quantity.toString(), currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[1];
      drawText(item.unit || 'N/A', currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[2];
      drawText(item.description || 'N/A', currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[3];
      drawText(item.is_exempt ? 'Sí' : 'No', currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      y -= lineHeight;
    }
    y -= lineHeight * 2; // Espacio después de la tabla

    // --- Footer ---
    // Ensure footer is always at the bottom of the last page
    const footerY = margin; // Fixed position from bottom
    page.drawLine({
      start: { x: width / 2 - 100, y: footerY + lineHeight },
      end: { x: width / 2 + 100, y: footerY + lineHeight },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    drawText('Firma Autorizada', width / 2 - 50, footerY, { font: font, size: 9 });
    drawText(`Generado por: ${request.created_by || user.email}`, margin, footerY + lineHeight * 2);


    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="solicitud_cotizacion_${request.id.substring(0, 8)}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[generate-qr-pdf] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});