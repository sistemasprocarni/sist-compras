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
const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVNTA'];
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

// Helper function for text wrapping (approximation based on character count)
function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine === '' ? '' : ' ') + word;
    }
  }
  if (currentLine !== '') {
    lines.push(currentLine.trim());
  }
  return lines;
}

// NEW: Standardized sequence number formatter
const formatSequenceNumber = (sequence?: number, dateString?: string): string => {
  if (!sequence) return 'N/A';
  
  const date = dateString ? new Date(dateString) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  
  return `OC-${year}-${month}-${seq}`;
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
        companies (name, logo_url, fiscal_data, rif, address, phone, email)
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

    // Helper function to format payment terms
    const formatPaymentTerms = (order: any) => {
      if (order.payment_terms === 'Otro' && order.custom_payment_terms) {
        return order.custom_payment_terms;
      }
      if (order.payment_terms === 'Crédito' && order.credit_days) {
        return `Crédito (${order.credit_days} días)`;
      }
      return order.payment_terms || 'Contado';
    };

    // --- Generación de PDF con pdf-lib ---
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage(); // Use 'let' because it will be reassigned

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const { width, height } = page.getSize();
    const margin = 30;
    let y = height - margin;
    const fontSize = 10;
    const lineHeight = fontSize * 1.2;
    const tableHeaderBgColor = rgb(0.9, 0.9, 0.9);
    const borderColor = rgb(0.8, 0.8, 0.8);
    const companyDetailsColor = rgb(0.5, 0.5, 0.5); // Lighter gray color for company details
    const tableRowBgColor = rgb(0.95, 0.95, 0.95); // Very light gray for table rows

    // Helper para dibujar texto
    const drawText = (text: string, x: number, yPos: number, options: any = {}) => {
      // Ensure text is a string before drawing
      const safeText = String(text || 'N/A'); 
      page.drawText(safeText, {
        x,
        y: yPos,
        font: font,
        size: fontSize,
        color: rgb(0, 0, 0),
        ...options,
      });
    };

    // Helper para dibujar rectángulo con borde
    const drawBorderedRect = (x: number, y: number, width: number, height: number, options: any = {}) => {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        borderColor: options.borderColor || borderColor,
        borderWidth: options.borderWidth || 1,
        color: options.color || rgb(1, 1, 1),
      });
    };

    // Table column configuration - Improved layout
    const tableX = margin;
    const tableWidth = width - 2 * margin;
    // Updated column widths for better spacing
    const colWidths = [
      tableWidth * 0.35,  // Material
      tableWidth * 0.10,  // Cantidad
      tableWidth * 0.10,  // Unidad
      tableWidth * 0.15,  // P. Unitario
      tableWidth * 0.15,  // IVA
      tableWidth * 0.15   // Total
    ];
    const colHeaders = ['Descripción', 'Cantidad', 'Unidad', 'P. Unitario', 'IVA', 'Total'];

    // Function to draw table headers with improved styling
    const drawTableHeader = () => {
      let currentX = tableX;
      
      // Draw header background
      drawBorderedRect(tableX, y - lineHeight, tableWidth, lineHeight, {
        color: tableHeaderBgColor,
        borderColor: borderColor,
        borderWidth: 1
      });
      
      // Draw header text
      for (let i = 0; i < colHeaders.length; i++) {
        drawText(colHeaders[i], currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2, { 
          font: boldFont, 
          size: 10 
        });
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

    // --- Header with Company Logo and Details ---
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
      drawText(order.companies?.name || 'N/A', logoX + logoWidth + 10, y, { font: boldFont, size: 14 });

      // Draw company details (slightly smaller and lighter color)
      const detailsY = y - lineHeight;
      drawText(`RIF: ${order.companies?.rif || 'N/A'}`, logoX + logoWidth + 10, detailsY, { size: 9, color: companyDetailsColor });
      drawText(`Dirección: ${order.companies?.address || 'N/A'}`, logoX + logoWidth + 10, detailsY - lineHeight, { size: 9, color: companyDetailsColor });
      drawText(`Teléfono: ${order.companies?.phone || 'N/A'}`, logoX + logoWidth + 10, detailsY - lineHeight * 2, { size: 9, color: companyDetailsColor });
      drawText(`Email: ${order.companies?.email || 'N/A'}`, logoX + logoWidth + 10, detailsY - lineHeight * 3, { size: 9, color: companyDetailsColor });

      y -= logoHeight + lineHeight * 4;
    } else {
      // Fallback: Draw company name as text
      drawText(order.companies?.name || 'N/A', margin, y, { font: boldFont, size: 14 });
      y -= lineHeight * 2;
    }

    // Draw document title centered (slightly smaller)
    drawText('ORDEN DE COMPRA', width / 2 - 100, y, { font: boldFont, size: 16 });
    y -= lineHeight * 2;
    
    // Use the standardized format for the sequence number
    const formattedSequence = formatSequenceNumber(order.sequence_number, order.created_at);
    drawText(`Nº: ${formattedSequence}`, width - margin - 100, y, { font: boldFont, size: 10 }); 
    
    drawText(`Fecha: ${new Date(order.created_at).toLocaleDateString('es-VE')}`, width - margin - 100, y - lineHeight);
    y -= lineHeight * 3;

    // --- Detalles del Proveedor ---
    drawText('DATOS DEL PROVEEDOR:', margin, y, { font: boldFont, size: 12 });
    y -= lineHeight;
    drawText(`Nombre: ${order.suppliers?.name || 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`RIF: ${order.suppliers?.rif || 'N/A'}`, margin, y);
    y -= lineHeight * 2;

    // --- Detalles de la Orden ---
    drawText('DETALLES DE LA ORDEN:', margin, y, { font: boldFont, size: 12 });
    y -= lineHeight;
    
    drawText(`Fecha de Entrega: ${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('es-VE') : 'N/A'}`, margin, y);
    y -= lineHeight;
    drawText(`Condición de Pago: ${formatPaymentTerms(order)}`, margin, y);
    y -= lineHeight * 2;

    // --- Observaciones ---
    if (order.observations) {
      drawText('OBSERVACIONES:', margin, y, { font: boldFont, size: 12 });
      y -= lineHeight;
      
      const observationsText = order.observations;
      const maxCharsPerLine = 100; // Approximation for font size 10
      
      // Use the manual wrapText function
      const textRuns = wrapText(observationsText, maxCharsPerLine);
      
      for (const run of textRuns) {
        checkPageBreak(lineHeight);
        drawText(run, margin, y);
        y -= lineHeight;
      }
      y -= lineHeight; // Extra space after observations
    }

    // --- Tabla de Ítems (Enhanced Styling) ---
    drawTableHeader(); // Draw initial table header

    // Dibujar filas de ítems con estilo mejorado
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      checkPageBreak(lineHeight + 10); // Check before drawing each row

      // Alternate row colors for better readability
      const rowColor = i % 2 === 0 ? rgb(1, 1, 1) : tableRowBgColor;

      // Draw row background
      drawBorderedRect(tableX, y - lineHeight, tableWidth, lineHeight, {
        color: rowColor,
        borderColor: borderColor,
        borderWidth: 1
      });

      // Calculate values
      const subtotal = item.quantity * item.unit_price;
      const itemIva = item.is_exempt ? 0 : subtotal * (item.tax_rate || 0.16);
      const totalItem = subtotal + itemIva;

      let currentX = tableX;
      
      // Draw item data with better alignment
      // Descripción (Material name)
      drawText(item.material_name, currentX + 5, y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[0];

      // Cantidad
      const quantityText = item.quantity.toString();
      drawText(quantityText, currentX + colWidths[1] - 5 - font.widthOfTextAtSize(quantityText, fontSize), y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[1];

      // Unidad (assuming unit is available, using a placeholder if not)
      const unitText = item.unit || 'UND';
      drawText(unitText, currentX + colWidths[2] - 5 - font.widthOfTextAtSize(unitText, fontSize), y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[2];

      // P. Unitario
      const unitPriceText = `${order.currency} ${item.unit_price.toFixed(2)}`;
      drawText(unitPriceText, currentX + colWidths[3] - 5 - font.widthOfTextAtSize(unitPriceText, fontSize), y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[3];

      // IVA
      const ivaText = item.is_exempt ? 'EXENTO' : `${order.currency} ${itemIva.toFixed(2)}`;
      drawText(ivaText, currentX + colWidths[4] - 5 - font.widthOfTextAtSize(ivaText, fontSize), y - lineHeight + (lineHeight - fontSize) / 2);
      currentX += colWidths[4];

      // Total
      const totalItemText = `${order.currency} ${totalItem.toFixed(2)}`;
      drawText(totalItemText, currentX + colWidths[5] - 5 - font.widthOfTextAtSize(totalItemText, fontSize), y - lineHeight + (lineHeight - fontSize) / 2);

      y -= lineHeight;
    }
    y -= lineHeight; // Espacio después de la tabla

    // --- Totals ---
    const calculatedTotals = calculateTotals(items);
    const totalSectionX = width - margin - 200; // Alineado a la derecha

    // Check for page break before drawing totals
    checkPageBreak(lineHeight * 5); // 3 lines for totals, 1 for amount in words, 1 for spacing

    // Draw totals with right alignment and improved styling
    const baseImponibleText = `Subtotal: ${order.currency} ${calculatedTotals.baseImponible.toFixed(2)}`;
    drawText(baseImponibleText, totalSectionX, y);

    const montoIVAText = `IVA (16%): ${order.currency} ${calculatedTotals.montoIVA.toFixed(2)}`;
    drawText(montoIVAText, totalSectionX, y - lineHeight);

    const totalText = `TOTAL: ${order.currency} ${calculatedTotals.total.toFixed(2)}`;
    const totalTextWidth = boldFont.widthOfTextAtSize(totalText, fontSize + 2); // Use boldFont for width calculation
    drawText(totalText, totalSectionX + 200 - totalTextWidth, y - lineHeight * 2, { font: boldFont, size: fontSize + 2 });

    y -= lineHeight * 3;

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
    // Improved error logging and response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during PDF generation.';
    console.error('[generate-po-pdf] General Error:', errorMessage, error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});