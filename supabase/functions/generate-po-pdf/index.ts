import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Re-implementación de las utilidades de cálculo para el entorno Deno
const calculateTotals = (items: Array<{ quantity: number; unit_price: number; tax_rate?: number; is_exempt?: boolean }>) => {
  let baseImponible = 0;
  let montoIVA = 0;
  let total = 0;

  items.forEach(item => {
    const itemTotal = item.quantity * item.unit_price;
    baseImponible += itemTotal; // La base imponible siempre incluye el valor del ítem

    if (!item.is_exempt) { // Solo aplica IVA si el ítem NO está exento
      const taxRate = item.tax_rate ?? 0.16; // Default IVA 16%
      montoIVA += itemTotal * taxRate;
    }
    total += itemTotal;
  });

  total += montoIVA; // Sumar el IVA al total final

  return {
    baseImponible: parseFloat(baseImponible.toFixed(2)),
    montoIVA: parseFloat(montoIVA.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};

const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];

function convertirGrupo(num: number): string {
  let c = Math.floor(num / 100);
  let d = Math.floor((num % 100) / 10);
  let u = num % 10;
  let texto = '';

  if (c === 1 && d === 0 && u === 0) {
    texto += 'CIEN';
  } else if (c > 0) {
    texto += centenas[c] + ' ';
  }

  if (d === 1) {
    texto += especiales[u];
  } else if (d > 1) {
    texto += decenas[d];
    if (u > 0) {
      texto += ' Y ' + unidades[u];
    }
  } else if (u > 0) {
    texto += unidades[u];
  }
  return texto.trim();
}

const numberToWords = (amount: number, currency: 'VES' | 'USD'): string => {
  if (amount === 0) {
    return `CERO ${currency === 'VES' ? 'BOLIVARES' : 'DOLARES'} CON 00/100`;
  }

  const [entero, decimal] = amount.toFixed(2).split('.').map(Number);

  let texto = '';
  let tempEntero = entero;

  if (tempEntero === 1) {
    texto = `UN ${currency === 'VES' ? 'BOLIVAR' : 'DOLAR'}`;
  } else if (tempEntero > 1) {
    let miles = Math.floor(tempEntero / 1000);
    let unidades = tempEntero % 1000;

    if (miles > 0) {
      if (miles === 1) {
        texto += 'MIL ';
      } else {
        texto += convertirGrupo(miles) + ' MIL ';
      }
    }
    texto += convertirGrupo(unidades);

    texto = texto.trim() + ` ${currency === 'VES' ? 'BOLIVARES' : 'DOLARES'}`;
  }

  const decimalTexto = decimal.toString().padStart(2, '0');

  return `${texto} CON ${decimalTexto}/100`.trim();
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
        suppliers (name, rif, email, phone, payment_terms),
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

    // --- Generación de PDF con pdf-lib ---
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage(); // Use 'let' because it will be reassigned

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

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
    const colWidths = [tableWidth * 0.3, tableWidth * 0.15, tableWidth * 0.15, tableWidth * 0.1, tableWidth * 0.1, tableWidth * 0.2];
    const colHeaders = ['Material', 'Cantidad', 'P. Unitario', 'IVA (%)', 'Exento', 'Subtotal'];

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
      if (y - requiredSpace < margin + lineHeight * 6) { // Leave space for totals and footer
        page = pdfDoc.addPage();
        y = height - margin;
        drawTableHeader(); // Redraw headers on new page
      }
    };

    // --- Header with Company Logo ---
    // Try to fetch and embed the company logo if available
    let companyLogoImage = null;
    if (order.companies?.logo_url) {
      try {
        const logoResponse = await fetch(order.companies.logo_url);
        if (logoResponse.ok) {
          const logoBytes = await logoResponse.arrayBuffer();
          companyLogoImage = await pdfDoc.embedPng(logoBytes);
        }
      } catch (logoError) {
        console.warn(`[generate-po-pdf] Could not load company logo:`, logoError);
      }
    }

    // Draw company logo or placeholder
    if (companyLogoImage) {
      const logoWidth = 100;
      const logoHeight = 100;
      const logoX = margin;
      const logoY = y - logoHeight;

      page.drawImage(companyLogoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });

      // Draw company name next to logo
      drawText(order.companies?.name || 'N/A', logoX + logoWidth + 10, y, { font: boldFont, size: 14 });
      y -= logoHeight + lineHeight;
    } else {
      // Fallback: Draw company name as text
      drawText(order.companies?.name || 'N/A', margin, y, { font: boldFont, size: 14 });
      y -= lineHeight * 2;
    }

    // Draw document title centered
    drawText('ORDEN DE COMPRA', width / 2 - 100, y, { font: boldFont, size: 18 });
    y -= lineHeight * 2;
    drawText(`Nº: ${order.sequence_number}`, width - margin - 100, y, { font: boldFont, size: 12 });
    drawText(`Fecha: ${new Date(order.created_at).toLocaleDateString('es-VE')}`, width - margin - 100, y - lineHeight);
    y -= lineHeight * 3;

    // --- Detalles del Proveedor ---
    drawText('DATOS DEL PROVEEDOR:', margin, y, { font: boldFont });
    y -= lineHeight;
    drawText(`Nombre: ${order.suppliers?.name || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`RIF: ${order.suppliers?.rif || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`Email: ${order.suppliers?.email || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`Teléfono: ${order.suppliers?.phone || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`Términos de Pago: ${order.suppliers?.payment_terms || 'N/A'}`, margin, y);
    y -= lineHeight * 2;

    // --- Detalles de la Orden ---
    drawText('DETALLES DE LA ORDEN:', margin, y, { font: boldFont });
    y -= lineHeight;
    drawText(`Moneda: ${order.currency}`, margin, y);
    y -= lineHeight;
    if (order.exchange_rate) {
      drawText(`Tasa de Cambio: ${order.exchange_rate.toFixed(2)}`, margin, y);
      y -= lineHeight;
    }
    drawText(`Estado: ${order.status}`, margin, y);
    y -= lineHeight * 2;

    // --- Tabla de Ítems ---
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
      drawText(item.unit_price.toFixed(2), currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[2];
      drawText(item.is_exempt ? 'N/A' : `${(item.tax_rate * 100).toFixed(0)}%`, currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[3];
      drawText(item.is_exempt ? 'Sí' : 'No', currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[4];
      drawText((item.quantity * item.unit_price).toFixed(2), currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      y -= lineHeight;
    }
    y -= lineHeight; // Espacio después de la tabla

    // --- Totals ---
    const calculatedTotals = calculateTotals(items);
    const totalSectionX = width - margin - 200; // Alineado a la derecha

    // Check for page break before drawing totals
    checkPageBreak(lineHeight * 5); // 3 lines for totals, 1 for amount in words, 1 for spacing

    drawText(`Base Imponible: ${order.currency} ${calculatedTotals.baseImponible.toFixed(2)}`, totalSectionX, y);
    y -= lineHeight;
    drawText(`Monto IVA: ${order.currency} ${calculatedTotals.montoIVA.toFixed(2)}`, totalSectionX, y);
    y -= lineHeight;
    drawText(`TOTAL: ${order.currency} ${calculatedTotals.total.toFixed(2)}`, totalSectionX, y, { font: boldFont, size: fontSize + 2 });
    y -= lineHeight * 2;

    // Monto en palabras
    const amountInWords = numberToWords(calculatedTotals.total, order.currency as 'VES' | 'USD');
    drawText(`Monto en Letras: ${amountInWords}`, margin, y, { font: italicFont });
    y -= lineHeight * 3;

    // --- Footer ---
    const footerY = margin; // Fixed position from bottom
    page.drawLine({
      start: { x: width / 2 - 100, y: footerY + lineHeight },
      end: { x: width / 2 + 100, y: footerY + lineHeight },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    drawText('Firma Autorizada', width / 2 - 50, footerY, { font: font, size: 9 });
    drawText(`Generado por: ${order.created_by || user.email}`, margin, footerY + lineHeight * 2);

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="orden_compra_${order.sequence_number}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[generate-po-pdf] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});