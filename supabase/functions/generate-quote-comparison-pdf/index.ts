import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { PDFDocument, rgb, StandardFonts, PDFPage } from 'https://esm.sh/pdf-lib@1.17.1';

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

// --- UTILITY FUNCTIONS ---

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

// --- PDF State Management ---
interface PDFState {
  page: PDFPage;
  y: number;
  width: number;
  height: number;
  font: any;
  boldFont: any;
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

const checkPageBreak = (pdfDoc: PDFDocument, state: PDFState, requiredSpace: number): PDFState => {
  // Check if required space pushes content below the footer area
  if (state.y - requiredSpace < MARGIN + LINE_HEIGHT * 2) {
    state.page = pdfDoc.addPage();
    state.y = state.height - MARGIN;
  }
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

    const { comparisonResults, baseCurrency, globalExchangeRate, isSingleMaterial } = await req.json();
    console.log(`[generate-quote-comparison-pdf] Generating PDF for ${comparisonResults.length} materials by user: ${user.email}`);

    // --- PDF Setup ---
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage(); 
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let state: PDFState = { page, y: height - MARGIN, width, height, font, boldFont };

    // --- Header ---
    drawText(state, 'REPORTE DE COMPARACIÓN DE COTIZACIONES', MARGIN, state.y, { font: boldFont, size: 16, color: PROC_RED });
    state.y -= LINE_HEIGHT * 2;
    drawText(state, `Moneda Base: ${baseCurrency}`, MARGIN, state.y, { font: boldFont, size: 12 });
    state.y -= LINE_HEIGHT;
    if (globalExchangeRate) {
        drawText(state, `Tasa Global (USD/VES): ${globalExchangeRate.toFixed(2)}`, MARGIN, state.y, { font: boldFont, size: 12 });
        state.y -= LINE_HEIGHT;
    }
    drawText(state, `Fecha de Generación: ${new Date().toLocaleDateString('es-VE')}`, MARGIN, state.y, { size: 10, color: DARK_GRAY });
    state.y -= LINE_HEIGHT * 2;

    state.page.drawLine({
      start: { x: MARGIN, y: state.y },
      end: { x: width - MARGIN, y: state.y },
      thickness: 2,
      color: PROC_RED,
    });
    state.y -= LINE_HEIGHT * 2;

    // --- Table Column Configuration ---
    const tableWidth = width - 2 * MARGIN;
    // Columns: Proveedor, Precio Original, Moneda, Tasa, Precio Comparado
    const colWidths = [
      tableWidth * 0.30,  // Proveedor
      tableWidth * 0.15,  // Precio Original
      tableWidth * 0.10,  // Moneda
      tableWidth * 0.15,  // Tasa
      tableWidth * 0.30,  // Precio Comparado
    ];
    const colHeaders = ['Proveedor', 'Precio Original', 'Moneda', 'Tasa', `Precio Comparado (${baseCurrency})`];

    const drawComparisonTable = (state: PDFState, materialName: string, results: any[], bestPrice: number | null): PDFState => {
        // Draw Material Title
        state = checkPageBreak(pdfDoc, state, LINE_HEIGHT * 2);
        drawText(state, `MATERIAL: ${materialName}`, MARGIN, state.y, { font: boldFont, size: 12, color: PROC_RED });
        state.y -= LINE_HEIGHT * 2;

        // Draw Table Header
        let currentX = MARGIN;
        const headerY = state.y;
        
        // Draw thin gray line below header row
        state.page.drawLine({
            start: { x: MARGIN, y: headerY - LINE_HEIGHT },
            end: { x: MARGIN + tableWidth, y: headerY - LINE_HEIGHT },
            thickness: 1,
            color: LIGHT_GRAY,
        });
        
        for (let i = 0; i < colHeaders.length; i++) {
            drawText(state, colHeaders[i], currentX + 5, headerY - LINE_HEIGHT + (LINE_HEIGHT - FONT_SIZE) / 2, { 
                font: boldFont, 
                size: 10,
                color: PROC_RED
            });
            currentX += colWidths[i];
        }
        state.y -= LINE_HEIGHT;

        // Draw Table Rows
        for (const quote of results) {
            const isBestPrice = quote.isValid && quote.convertedPrice === bestPrice;
            
            // Calculate row height based on content (Proveedor name might wrap, but usually not in this context)
            const rowHeight = LINE_HEIGHT * 1.5; 
            state = checkPageBreak(pdfDoc, state, rowHeight);

            // Draw row background/border if it's the best price
            if (isBestPrice) {
                state.page.drawRectangle({
                    x: MARGIN,
                    y: state.y - rowHeight,
                    width: tableWidth,
                    height: rowHeight,
                    color: rgb(0.9, 1, 0.9), // Light green background
                    opacity: 0.5,
                });
            }

            // Draw separator line above row content
            state.page.drawLine({
                start: { x: MARGIN, y: state.y },
                end: { x: MARGIN + tableWidth, y: state.y },
                thickness: 0.5,
                color: LIGHT_GRAY,
            });

            currentX = MARGIN;
            // Calculate vertical center position: state.y (top of row) - rowHeight/2 (center) + 0 (ADJUSTED baseline adjustment)
            const verticalCenterY = state.y - rowHeight / 2;

            // 1. Proveedor
            drawText(state, quote.supplierName || 'N/A', currentX + 5, verticalCenterY, { 
                font: isBestPrice ? boldFont : font,
                color: isBestPrice ? PROC_RED : rgb(0, 0, 0)
            });
            currentX += colWidths[0];

            // Helper to draw data centered vertically and right-aligned
            const drawCellData = (text: string, colIndex: number, isBold: boolean = false) => {
                const cellWidth = colWidths[colIndex];
                const fontToUse = isBold ? state.boldFont : state.font;
                const textWidth = fontToUse.widthOfTextAtSize(text, FONT_SIZE);
                
                const xPos = currentX + cellWidth - 5 - textWidth;
                
                drawText(state, text, xPos, verticalCenterY, { font: fontToUse });
                currentX += cellWidth;
            };

            // 2. Precio Original
            drawCellData(`${quote.currency} ${quote.unitPrice.toFixed(2)}`, 1);

            // 3. Moneda
            currentX += colWidths[2]; // Skip drawing, already in original price

            // 4. Tasa
            drawCellData(quote.exchangeRate ? quote.exchangeRate.toFixed(4) : 'N/A', 3);

            // 5. Precio Comparado
            const priceComparedText = quote.isValid 
                ? `${baseCurrency} ${quote.convertedPrice.toFixed(2)}`
                : `INVÁLIDO (${quote.error})`;
            
            const color = isBestPrice ? PROC_RED : (quote.isValid ? rgb(0, 0, 0) : DARK_GRAY);
            
            const textWidth = state.boldFont.widthOfTextAtSize(priceComparedText, FONT_SIZE);
            drawText(state, priceComparedText, currentX + colWidths[4] - 5 - textWidth, verticalCenterY, { 
                font: boldFont, 
                color: color
            });
            currentX += colWidths[4];

            state.y -= rowHeight;
            
            // Draw separator line below row
            state.page.drawLine({
                start: { x: MARGIN, y: state.y },
                end: { x: MARGIN + tableWidth, y: state.y },
                thickness: 0.5,
                color: LIGHT_GRAY,
            });
        }
        
        state.y -= LINE_HEIGHT;
        return state;
    };

    // --- Draw all comparison tables ---
    for (const comparison of comparisonResults) {
        state = drawComparisonTable(state, `${comparison.material.name} (${comparison.material.code})`, comparison.results, comparison.bestPrice);
        state.y -= LINE_HEIGHT * 2; // Extra space between materials
    }

    const pdfBytes = await pdfDoc.save();

    // Format filename
    const filename = isSingleMaterial 
        ? `Comparacion_SC_${comparisonResults[0].material.code}_${new Date().toLocaleDateString('es-VE').replace(/\//g, '-')}.pdf`
        : `Comparacion_SC_General_${new Date().toLocaleDateString('es-VE').replace(/\//g, '-')}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during PDF generation.';
    console.error('[generate-quote-comparison-pdf] General Error:', errorMessage, error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});