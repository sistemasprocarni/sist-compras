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
        companies (name, logo_url, fiscal_data, rif, address, phone, email)
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
    const companyDetailsColor = rgb(0.5, 0.5, 0.5); // Lighter gray color for company details
    const tableRowBgColor = rgb(0.95, 0.95, 0.95); // Very light gray for table rows

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
        drawText(colHeaders[i], currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2, { font: boldFont, size: 12 });
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

    // --- Header with Company Logo and Details ---
    // Try to fetch and embed the company logo if available
    let companyLogoImage = null;
    if (request.companies?.logo_url) {
      try {
        const logoResponse = await fetch(request.companies.logo_url);
        if (logoResponse.ok) {
          const logoBytes = await logoResponse.arrayBuffer();
          companyLogoImage = await pdfDoc.embedPng(logoBytes);
        }
      } catch (logoError) {
        console.warn(`[generate-qr-pdf] Could not load company logo:`, logoError);
      }
    }

    // Draw company logo and details
    if (companyLogoImage) {
      const logoWidth = 50;
      const logoHeight = 50;
      const logoX = margin;
      const logoY = y - logoHeight;

      page.drawImage(companyLogoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });

      // Draw company name (larger and bold)
      drawText(request.companies?.name || 'N/A', logoX + logoWidth + 10, y, { font: boldFont, size: 14 });

      // Draw company details (slightly smaller and lighter color)
      const detailsY = y - lineHeight;
      drawText(`RIF: ${request.companies?.rif || 'N/A'}`, logoX + logoWidth + 10, detailsY, { size: 9, color: companyDetailsColor });
      drawText(`Dirección: ${request.companies?.address || 'N/A'}`, logoX + logoWidth + 10, detailsY - lineHeight, { size: 9, color: companyDetailsColor });
      drawText(`Teléfono: ${request.companies?.phone || 'N/A'}`, logoX + logoWidth + 10, detailsY - lineHeight * 2, { size: 9, color: companyDetailsColor });
      drawText(`Email: ${request.companies?.email || 'N/A'}`, logoX + logoWidth + 10, detailsY - lineHeight * 3, { size: 9, color: companyDetailsColor });

      y -= logoHeight + lineHeight * 4;
    } else {
      // Fallback: Draw company name as text
      drawText(request.companies?.name || 'N/A', margin, y, { font: boldFont, size: 14 });
      y -= lineHeight * 2;
    }

    // Draw document title centered (slightly smaller)
    drawText('SOLICITUD DE COTIZACIÓN', width / 2 - 100, y, { font: boldFont, size: 16 });
    y -= lineHeight * 2;
    drawText(`Nº: ${request.id.substring(0, 8)}`, width - margin - 100, y, { font: boldFont, size: 10 });
    drawText(`Fecha: ${new Date(request.created_at).toLocaleDateString('es-VE')}`, width - margin - 100, y - lineHeight);
    y -= lineHeight * 3;

    // --- Detalles del Proveedor ---
    drawText('DATOS DEL PROVEEDOR:', margin, y, { font: boldFont, size: 12 });
    y -= lineHeight;
    drawText(`Nombre: ${request.suppliers?.name || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`RIF: ${request.suppliers?.rif || 'N/A'}`, margin, y);
    y -= lineHeight * 2;

    // --- Tabla de Ítems Solicitados (Enhanced Styling) ---
    drawTableHeader(); // Draw initial table header

    // Dibujar filas de ítems con estilo mejorado
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      checkPageBreak(lineHeight); // Check before drawing each row

      // Alternate row colors for better readability
      const rowColor = i % 2 === 0 ? rgb(1, 1, 1) : tableRowBgColor;

      let currentX = tableX;
      page.drawRectangle({
        x: tableX,
        y: y - lineHeight,
        width: tableWidth,
        height: lineHeight,
        color: rowColor,
        borderColor: borderColor,
        borderWidth: 1,
      });

      // Draw item data with better alignment
      drawText(item.material_name, currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[0];

      // Right-align numeric values
      const quantityText = item.quantity.toString();
      drawText(quantityText, currentX + colWidths[1] - 5 - font.widthOfTextAtSize(quantityText, fontSize), y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[1];

      const unitText = item.unit || 'N/A';
      drawText(unitText, currentX + colWidths[2] - 5 - font.widthOfTextAtSize(unitText, fontSize), y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[2];

      // Left-align description (can be longer)
      drawText(item.description || 'N/A', currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[3];

      const exemptText = item.is_exempt ? 'Sí' : 'No';
      drawText(exemptText, currentX + colWidths[4] - 5 - font.widthOfTextAtSize(exemptText, fontSize), y - lineHeight + (lineHeight - fontSize) / 2);

      y -= lineHeight;
    }
    y -= lineHeight * 2; // Espacio después de la tabla

    // --- Footer (without signature line) ---
    const footerY = margin; // Fixed position from bottom
    drawText(`Generado por: ${request.created_by || user.email}`, margin, footerY + lineHeight * 2);

    const pdfBytes = await pdfDoc.save();

    // Format filename as: SC, "NOMBRE DEL PROVEEDOR" "FECHA ACTUAL"
    const supplierName = request.suppliers?.name || 'Proveedor';
    const currentDate = new Date().toLocaleDateString('es-VE').replace(/\//g, '-');
    const safeSupplierName = supplierName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const filename = `SC_${safeSupplierName}_${currentDate}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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