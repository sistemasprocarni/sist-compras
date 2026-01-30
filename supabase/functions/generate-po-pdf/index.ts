import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- CONSTANTS ---
const PROC_RED = rgb(0.533, 0.039, 0.039); // #880a0a
const LIGHT_GRAY = rgb(0.9, 0.9, 0.9);
const DARK_GRAY = rgb(0.5, 0.5, 0.5);
const MARGIN = 30;
const FONT_SIZE = 10;
const LINE_HEIGHT = FONT_SIZE * 1.2;
const COMPANY_NAME_FONT_SIZE = 12;
const LOGO_SIZE = 50;

// Table column configuration
const COL_WIDTHS = [0.30, 0.10, 0.10, 0.15, 0.15, 0.20]; // Material, Cantidad, Unidad, P. Unitario, IVA, Total
const COL_HEADERS = ['Material', 'Cantidad', 'Unidad', 'P. Unitario', 'IVA', 'Total'];

// --- UTILITY FUNCTIONS ---

const calculateTotals = (items: Array<{ quantity: number; unit_price: number; tax_rate?: number; is_exempt?: boolean }>) => {
  let baseImponible = 0;
  let montoIVA = 0;
  let total = 0;

  items.forEach(item => {
    const itemTotal = item.quantity * item.unit_price;
    baseImponible += itemTotal;

    if (!item.is_exempt) {
      const taxRate = item.tax_rate ?? 0.16;
      montoIVA += itemTotal * taxRate;
    }
    total += itemTotal;
  });

  total += montoIVA;

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

const formatSequenceNumber = (sequence?: number, dateString?: string): string => {
  if (!sequence) return 'N/A';
  
  const date = dateString ? new Date(dateString) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  
  return `OC-${year}-${month}-${seq}`;
};

// --- PDF STATE AND DRAWING HELPERS ---

interface PDFState {
  page: PDFPage;
  y: number;
  width: number;
  height: number;
  font: PDFFont;
  boldFont: PDFFont;
  italicFont: PDFFont;
  tableColWidths: number[];
}

const drawText = (state: PDFState, text: string, x: number, yPos: number, options: any = {}) => {
  const safeText = String(text || 'N/A'); 
  state.page.drawText(safeText, {
    x,
    y: yPos,
    font: state.font,
    size: FONT_SIZE,
    color: rgb(0, 0, 0),
    ...options,
  });
};

const drawBorderedRect = (state: PDFState, x: number, y: number, w: number, h: number, options: any = {}) => {
  state.page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: options.borderColor || LIGHT_GRAY,
    borderWidth: options.borderWidth || 1,
    color: options.color || rgb(1, 1, 1),
  });
};

const drawTableHeader = (state: PDFState): PDFState => {
  const tableWidth = state.width - 2 * MARGIN;
  let currentX = MARGIN;
  
  state.page.drawLine({
    start: { x: MARGIN, y: state.y - LINE_HEIGHT },
    end: { x: MARGIN + tableWidth, y: state.y - LINE_HEIGHT },
    thickness: 1,
    color: LIGHT_GRAY,
  });
  
  for (let i = 0; i < COL_HEADERS.length; i++) {
    drawText(state, COL_HEADERS[i], currentX + 5, state.y - LINE_HEIGHT + (LINE_HEIGHT - FONT_SIZE) / 2, { 
      font: state.boldFont, 
      size: 10,
      color: PROC_RED
    });
    currentX += state.tableColWidths[i];
  }
  state.y -= LINE_HEIGHT;
  return state;
};

const checkPageBreak = (state: PDFState, pdfDoc: PDFDocument, requiredSpace: number): PDFState => {
  // Check if required space pushes content below the footer area
  if (state.y - requiredSpace < MARGIN + LINE_HEIGHT * 6) {
    state.page = pdfDoc.addPage();
    state.y = state.height - MARGIN;
    state = drawTableHeader(state); // Redraw headers on new page
  }
  return state;
};

// --- MODULAR DRAWING FUNCTIONS ---

const drawHeader = async (state: PDFState, order: any, pdfDoc: PDFDocument): Promise<PDFState> => {
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

  const formattedSequence = formatSequenceNumber(order.sequence_number, order.created_at);

  // 1. Draw Company Logo and Name (Top Left)
  if (companyLogoImage) {
    const logoX = MARGIN;
    const logoY = state.y - LOGO_SIZE;

    state.page.drawImage(companyLogoImage, {
      x: logoX,
      y: logoY,
      width: LOGO_SIZE,
      height: LOGO_SIZE,
    });

    drawText(state, order.companies?.name || 'N/A', logoX + LOGO_SIZE + 10, state.y - (LOGO_SIZE / 2) + (COMPANY_NAME_FONT_SIZE / 2), { 
      font: state.boldFont, 
      size: COMPANY_NAME_FONT_SIZE, 
      color: PROC_RED 
    });
  } else {
    drawText(state, order.companies?.name || 'N/A', MARGIN, state.y, { font: state.boldFont, size: COMPANY_NAME_FONT_SIZE, color: PROC_RED });
  }

  // 2. Draw Document Title and Number (Top Right)
  const titleX = state.width - MARGIN - 150;
  drawText(state, 'ORDEN DE COMPRA', titleX, state.y, { font: state.boldFont, size: 16, color: PROC_RED });
  
  drawText(state, `Nº: ${formattedSequence}`, titleX, state.y - LINE_HEIGHT * 2, { font: state.boldFont, size: 10 }); 
  drawText(state, `Fecha: ${new Date(order.created_at).toLocaleDateString('es-VE')}`, titleX, state.y - LINE_HEIGHT, { size: 10 });

  // Update Y position based on the tallest element in the header
  state.y -= Math.max(companyLogoImage ? LOGO_SIZE : LINE_HEIGHT * 3, LINE_HEIGHT * 3);
  
  // Separator line (Red, 2pt)
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: state.width - MARGIN, y: state.y },
    thickness: 2,
    color: PROC_RED,
  });
  state.y -= LINE_HEIGHT * 2;
  return state;
};

const drawSupplierDetails = (state: PDFState, order: any): PDFState => {
  // Draw title
  drawText(state, 'DATOS DEL PROVEEDOR:', MARGIN, state.y, { font: state.boldFont, size: 12, color: PROC_RED });
  
  // Draw separator line immediately below the title text area
  state.page.drawLine({
    start: { x: MARGIN, y: state.y - FONT_SIZE - 2 },
    end: { x: state.width - MARGIN, y: state.y - FONT_SIZE - 2 },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });
  
  state.y -= LINE_HEIGHT * 2;
  
  // Max width for supplier details (approx 60 characters per line)
  const maxChars = 60; 
  
  // 1. Supplier Name (Bold)
  const namePrefix = 'Nombre: ';
  const nameLines = wrapText(order.suppliers?.name || 'N/A', maxChars - namePrefix.length);
  
  drawText(state, namePrefix, MARGIN, state.y, { font: state.boldFont });
  let currentX = MARGIN + state.font.widthOfTextAtSize(namePrefix, FONT_SIZE);
  
  for (const line of nameLines) {
    drawText(state, line, currentX, state.y);
    state.y -= LINE_HEIGHT;
    currentX = MARGIN + state.font.widthOfTextAtSize(namePrefix, FONT_SIZE);
  }
  
  // 2. RIF
  drawText(state, `RIF: ${order.suppliers?.rif || 'N/A'}`, MARGIN, state.y);
  state.y -= LINE_HEIGHT;
  
  // 3. Address
  const addressPrefix = 'Dirección: ';
  const addressLines = wrapText(order.suppliers?.address || 'N/A', maxChars - addressPrefix.length);
  
  drawText(state, addressPrefix, MARGIN, state.y, { font: state.boldFont });
  currentX = MARGIN + state.font.widthOfTextAtSize(addressPrefix, FONT_SIZE);
  
  for (const line of addressLines) {
    drawText(state, line, currentX, state.y);
    state.y -= LINE_HEIGHT;
    currentX = MARGIN + state.font.widthOfTextAtSize(addressPrefix, FONT_SIZE);
  }
  
  state.y -= LINE_HEIGHT;
  return state;
};

const drawOrderDetails = (state: PDFState, order: any): PDFState => {
  const formatPaymentTerms = (order: any) => {
    if (order.payment_terms === 'Otro' && order.custom_payment_terms) {
      return order.custom_payment_terms;
    }
    if (order.payment_terms === 'Crédito' && order.credit_days) {
      return `Crédito (${order.credit_days} días)`;
    }
    return order.payment_terms || 'Contado';
  };
  
  const paymentTerms = formatPaymentTerms(order);

  // Draw title
  drawText(state, 'DETALLES DE LA ORDEN:', MARGIN, state.y, { font: state.boldFont, size: 12, color: PROC_RED });
  
  // Draw separator line immediately below the title text area
  state.page.drawLine({
    start: { x: MARGIN, y: state.y - FONT_SIZE - 2 },
    end: { x: state.width - MARGIN, y: state.y - FONT_SIZE - 2 },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });
  
  state.y -= LINE_HEIGHT * 2;
  
  drawText(state, `Fecha de Entrega: ${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('es-VE') : 'N/A'}`, MARGIN, state.y);
  state.y -= LINE_HEIGHT;
  drawText(state, `Condición de Pago: ${paymentTerms}`, MARGIN, state.y);
  state.y -= LINE_HEIGHT * 2;
  return state;
};

const drawObservations = (state: PDFState, order: any, pdfDoc: PDFDocument): PDFState => {
  if (!order.observations) return state;

  // Draw title
  drawText(state, 'OBSERVACIONES:', MARGIN, state.y, { font: state.boldFont, size: 12, color: PROC_RED });
  
  // Draw separator line immediately below the title text area
  state.page.drawLine({
    start: { x: MARGIN, y: state.y - FONT_SIZE - 2 },
    end: { x: state.width - MARGIN, y: state.y - FONT_SIZE - 2 },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });
  
  state.y -= LINE_HEIGHT * 2;
  
  const observationsText = order.observations;
  const maxCharsPerLine = 100; 
  const textRuns = wrapText(observationsText, maxCharsPerLine);
  
  for (const run of textRuns) {
    state = checkPageBreak(state, pdfDoc, LINE_HEIGHT);
    drawText(state, run, MARGIN, state.y);
    state.y -= LINE_HEIGHT;
  }
  state.y -= LINE_HEIGHT; 
  return state;
};

const drawItemsTable = (state: PDFState, items: any[], pdfDoc: PDFDocument): PDFState => {
  const tableWidth = state.width - 2 * MARGIN;
  
  // Draw title
  drawText(state, 'ÍTEMS DE LA ORDEN:', MARGIN, state.y, { font: state.boldFont, size: 12, color: PROC_RED });
  
  // Draw separator line immediately below the title text area
  state.page.drawLine({
    start: { x: MARGIN, y: state.y - FONT_SIZE - 2 },
    end: { x: state.width - MARGIN, y: state.y - FONT_SIZE - 2 },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });
  
  state.y -= LINE_HEIGHT * 2;
  
  state = drawTableHeader(state);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    let materialContent = String(item.material_name || '');
    
    if (item.supplier_code || item.description) {
        if (item.supplier_code) {
            materialContent += `\n(Cód. Prov: ${item.supplier_code})`;
        }
        if (item.description) {
            materialContent += `\n${item.description}`;
        }
    }
    
    const materialLines = wrapText(materialContent, 35); 
    const lineSpacing = (FONT_SIZE - 1) * 1.2;
    const requiredHeight = materialLines.length * lineSpacing + 5;

    state = checkPageBreak(state, pdfDoc, requiredHeight + 10); 

    state.page.drawLine({
      start: { x: MARGIN, y: state.y },
      end: { x: MARGIN + tableWidth, y: state.y },
      thickness: 0.5,
      color: LIGHT_GRAY,
    });

    const subtotal = item.quantity * item.unit_price;
    const itemIva = item.is_exempt ? 0 : subtotal * (item.tax_rate || 0.16);
    const totalItem = subtotal + itemIva;

    let currentX = MARGIN;
    let currentY = state.y - 3; 

    // 1. Material/Description (Multi-line)
    for (const line of materialLines) {
      drawText(state, line, currentX + 5, currentY - (FONT_SIZE - 1), { size: FONT_SIZE - 1 });
      currentY -= lineSpacing;
    }
    currentX += state.tableColWidths[0];

    const finalY = state.y - requiredHeight;
    
    const drawCellData = (text: string, colIndex: number, isRightAligned: boolean = true) => {
        const cellWidth = state.tableColWidths[colIndex];
        const textWidth = state.font.widthOfTextAtSize(text, FONT_SIZE);
        
        const verticalCenterY = finalY + requiredHeight / 2 - FONT_SIZE / 2;

        const xPos = isRightAligned 
            ? currentX + cellWidth - 5 - textWidth 
            : currentX + 5;
        
        drawText(state, text, xPos, verticalCenterY);
        currentX += cellWidth;
    };

    // 2. Cantidad
    drawCellData(item.quantity.toString(), 1);

    // 3. Unidad
    drawCellData(item.unit || 'UND', 2);

    // 4. P. Unitario
    drawCellData(`${order.currency} ${item.unit_price.toFixed(2)}`, 3);

    // 5. IVA
    drawCellData(item.is_exempt ? 'EXENTO' : `${order.currency} ${itemIva.toFixed(2)}`, 4);

    // 6. Total
    drawCellData(`${order.currency} ${totalItem.toFixed(2)}`, 5);

    state.y = finalY;
  }
  
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: MARGIN + tableWidth, y: state.y },
    thickness: 1,
    color: LIGHT_GRAY,
  });
  
  state.y -= LINE_HEIGHT * 2;
  return state;
};

const drawTotalsAndSummary = (state: PDFState, order: any, items: any[], pdfDoc: PDFDocument): PDFState => {
  const calculatedTotals = calculateTotals(items);
  const totalSectionWidth = 200;
  const totalSectionX = state.width - MARGIN - totalSectionWidth; 
  
  let totalRows = 3;
  let hasUsdTotal = false;
  if (order.currency === 'VES' && order.exchange_rate && order.exchange_rate > 0) {
    totalRows = 4;
    hasUsdTotal = true;
  }
  
  const totalRowHeight = LINE_HEIGHT * 1.5;
  const totalSectionHeight = totalRowHeight * totalRows + 5;

  state = checkPageBreak(state, pdfDoc, totalSectionHeight + LINE_HEIGHT * 3); 

  // Draw the outer box
  drawBorderedRect(state, totalSectionX, state.y - totalSectionHeight, totalSectionWidth, totalSectionHeight, {
    borderColor: LIGHT_GRAY,
    borderWidth: 1,
  });
  
  let currentY = state.y - 5;

  const drawTotalRow = (label: string, value: string, isBold: boolean = false, color: rgb = rgb(0, 0, 0), size: number = FONT_SIZE) => {
    const fontToUse = isBold ? state.boldFont : state.font;
    
    const verticalCenterY = currentY - totalRowHeight / 2 + size / 2;
    
    drawText(state, label, totalSectionX + 5, verticalCenterY, { font: fontToUse, size, color });
    
    const valueWidth = fontToUse.widthOfTextAtSize(value, size);
    drawText(state, value, totalSectionX + totalSectionWidth - 5 - valueWidth, verticalCenterY, { font: fontToUse, size, color });
    
    currentY -= totalRowHeight;
  };

  drawTotalRow('Base Imponible:', `${order.currency} ${calculatedTotals.baseImponible.toFixed(2)}`);
  drawTotalRow('Monto IVA:', `${order.currency} ${calculatedTotals.montoIVA.toFixed(2)}`);
  drawTotalRow('TOTAL:', `${order.currency} ${calculatedTotals.total.toFixed(2)}`, true, PROC_RED, FONT_SIZE + 2);
  
  if (hasUsdTotal) {
    const totalInUSD = (calculatedTotals.total / order.exchange_rate).toFixed(2);
    drawTotalRow('TOTAL (USD):', `USD ${totalInUSD}`, true, DARK_GRAY, FONT_SIZE);
  }

  state.y = state.y - totalSectionHeight - LINE_HEIGHT;

  const amountInWords = numberToWords(calculatedTotals.total, order.currency as 'VES' | 'USD');
  drawText(state, `Monto en Letras: ${amountInWords}`, MARGIN, state.y, { font: state.italicFont });
  state.y -= LINE_HEIGHT * 3;
  return state;
};

const drawFooter = (state: PDFState, order: any, user: any): PDFState => {
  const footerY = MARGIN;
  state.page.drawLine({
    start: { x: state.width / 2 - 100, y: footerY + LINE_HEIGHT },
    end: { x: state.width / 2 + 100, y: footerY + LINE_HEIGHT },
    thickness: 1,
    color: DARK_GRAY,
  });
  drawText(state, 'Firma Autorizada', state.width / 2 - 50, footerY, { font: state.font, size: 9 });
  drawText(state, `Generado por: ${order.created_by || user.email}`, MARGIN, footerY + LINE_HEIGHT * 2);
  return state;
};

// --- MAIN SERVE HANDLER ---

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

    // --- Data Fetching ---
    const { data: order, error: orderError } = await supabaseClient
      .from('purchase_orders')
      .select(`
        *,
        suppliers (name, rif, email, phone, payment_terms, address),
        companies (name, logo_url, fiscal_data, rif, address, phone, email)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
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
      return new Response(JSON.stringify({ error: 'Error fetching order items.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- PDF Setup ---
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage(); 
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    
    const tableWidth = width - 2 * MARGIN;
    const tableColWidths = COL_WIDTHS.map(ratio => tableWidth * ratio);

    let state: PDFState = { 
      page, 
      y: height - MARGIN, 
      width, 
      height, 
      font, 
      boldFont, 
      italicFont,
      tableColWidths
    };

    // --- Execution Flow ---
    state = await drawHeader(state, order, pdfDoc);
    state = drawSupplierDetails(state, order);
    state = drawOrderDetails(state, order);
    state = drawObservations(state, order, pdfDoc);
    state = drawItemsTable(state, items, pdfDoc);
    state = drawTotalsAndSummary(state, order, items, pdfDoc);
    state = drawFooter(state, order, user);

    const pdfBytes = await pdfDoc.save();

    // Format filename as: OC-YYYY-MM-XXX-PROVEEDOR.pdf
    const supplierName = order.suppliers?.name || 'Proveedor';
    const safeSupplierName = supplierName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const filename = `${formatSequenceNumber(order.sequence_number, order.created_at)}-${safeSupplierName}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during PDF generation.';
    console.error('[generate-po-pdf] General Error:', errorMessage, error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});