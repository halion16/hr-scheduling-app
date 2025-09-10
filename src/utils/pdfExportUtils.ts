import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Store } from '../types';

export const exportScheduleGridToPDF = async (
  gridElementId: string,
  store: Store,
  weekStart: Date
) => {
  try {
    console.log('🖨️ AVVIO NUOVA PROCEDURA CATTURA PDF MIGLIORATA...');
    
    const gridElement = document.getElementById(gridElementId);
    if (!gridElement) {
      console.error('❌ Elemento griglia non trovato:', gridElementId);
      throw new Error('Elemento griglia non trovato');
    }

    console.log('✅ Elemento griglia trovato:', gridElement);
    console.log('📏 Dimensioni prima della preparazione:', {
      width: gridElement.offsetWidth,
      height: gridElement.offsetHeight,
      scrollWidth: gridElement.scrollWidth,
      scrollHeight: gridElement.scrollHeight
    });

    // NUOVA PROCEDURA: Attesa esplicita e preparazione avanzata
    // 1. Attendi 500ms per essere sicuri che il rendering sia completo
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 2. Forza un reflow del DOM
    gridElement.getBoundingClientRect();

    // 3. Salva lo stato originale dell'elemento
    const originalDisplay = gridElement.style.display;
    const originalVisibility = gridElement.style.visibility;
    const originalPosition = gridElement.style.position;
    const originalZIndex = gridElement.style.zIndex;
    
    // 4. Rendi l'elemento completamente visibile ma preserva la posizione
    gridElement.style.display = 'block';
    gridElement.style.visibility = 'visible';
    gridElement.style.position = 'relative';
    gridElement.style.zIndex = '9999';

    console.log('📏 Dimensioni dopo preparazione:', {
      width: gridElement.offsetWidth,
      height: gridElement.offsetHeight,
      scrollWidth: gridElement.scrollWidth,
      scrollHeight: gridElement.scrollHeight
    });

    // 5. Attendi ancora per assicurarsi che i cambiamenti siano applicati
    await new Promise(resolve => setTimeout(resolve, 500));

    // 6. Applica stili ottimizzati per PDF 
    const { cleanupFunction } = applyPDFOptimizedStyles(gridElement);

    // 7. Attendi ancora per gli stili CSS
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log('📸 AVVIO CATTURA CANVAS MIGLIORATA...');

    // CATTURA MIGLIORATA: opzioni ottimizzate per la massima compatibilità
    const canvas = await html2canvas(gridElement, {
      scale: 2, // Scala 2x per migliore qualità e chiarezza
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: true,
      width: Math.max(gridElement.offsetWidth, gridElement.scrollWidth),
      height: Math.max(gridElement.offsetHeight, gridElement.scrollHeight),
      allowTaint: false,
      foreignObjectRendering: false, // Disabilitato per maggiore compatibilità
      removeContainer: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: 0,
      y: 0
    });

    console.log('✅ Canvas catturato:', canvas.width, 'x', canvas.height);

    // Debug: verifica che il canvas non sia vuoto
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas vuoto - elemento non visibile o errore di cattura');
    }

    // Ripristina stili originali
    cleanupFunction();
    
    // Ripristina le proprietà originali dell'elemento
    gridElement.style.display = originalDisplay;
    gridElement.style.visibility = originalVisibility;
    gridElement.style.position = originalPosition;
    gridElement.style.zIndex = originalZIndex;

    // NUOVA GENERAZIONE PDF: migliorata per garantire la visualizzazione completa
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    console.log('📄 Dimensioni canvas catturato:', canvas.width, 'x', canvas.height);

    // Dimensioni A4 orizzontale
    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 8;

    // Aggiungi header
    addCompactPDFHeader(pdf, store, weekStart, pageWidth, margin);

    // Area disponibile per la griglia
    const headerHeight = 18;
    const footerHeight = 10;
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - headerHeight - footerHeight;

    // Calcola dimensioni mantenendo aspect ratio
    const aspectRatio = canvas.width / canvas.height;
    let imgWidth = availableWidth;
    let imgHeight = imgWidth / aspectRatio;

    // Se non entra in altezza, adatta
    if (imgHeight > availableHeight - 5) { // 5mm di margine extra
      imgHeight = availableHeight;
      imgWidth = imgHeight * aspectRatio;
    }

    // Posiziona la griglia al centro
    const imgX = margin + (availableWidth - imgWidth) / 2;
    const imgY = headerHeight + (availableHeight - imgHeight) / 2;

    console.log(`📄 Posizionamento: ${imgX.toFixed(1)}, ${imgY.toFixed(1)} - Dimensioni: ${imgWidth.toFixed(1)}x${imgHeight.toFixed(1)}mm`);

    // Converti canvas in immagine PNG con compressione ottimale
    const imgData = canvas.toDataURL('image/png', 0.95);
    
    // Verifica che l'immagine non sia vuota
    if (imgData === 'data:,') {
      throw new Error('Immagine vuota generata dal canvas');
    }

    try {
      console.log('📄 Aggiunta immagine al PDF...');
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);
    } catch (error) {
      console.error('❌ Errore durante l\'aggiunta dell\'immagine al PDF:', error);
      throw new Error('Errore durante l\'aggiunta dell\'immagine al PDF: ' + error.message);
    }

    // Aggiungi footer
    addCompactPDFFooter(pdf, pageWidth, pageHeight, margin);

    // Nome file e salvataggio
    const fileName = `Turni_${store.name.replace(/[^a-zA-Z0-9]/g, '_')}_${formatDateForFilename(weekStart)}.pdf`;
    
    console.log('💾 Salvataggio PDF:', fileName);
    pdf.save(fileName);

    console.log('✅ PDF generato con successo!');
    showSuccessNotification('PDF generato con successo!');

  } catch (error) {
    console.error('❌ Errore durante l\'export PDF:', error);
    showErrorNotification('Errore durante la generazione del PDF: ' + (error as Error).message);
    throw error;
  }
};

// Prepara l'elemento per la cattura
async function prepareElementForCapture(element: HTMLElement) {
  // Assicurati che l'elemento sia visibile
  const originalPosition = element.style.position;
  const originalZIndex = element.style.zIndex;
  const originalTransform = element.style.transform;

  // Temporaneamente porta l'elemento in primo piano
  element.style.position = 'relative';
  element.style.zIndex = '9999';
  element.style.transform = 'none';

  // Forza il reflow
  element.offsetHeight;

  // Scroll to top se necessario
  const scrollableParent = findScrollableParent(element);
  if (scrollableParent) {
    scrollableParent.scrollTop = 0;
    scrollableParent.scrollLeft = 0;
  }

  // Ripristina posizione originale se necessario
  if (originalPosition) {
    if (originalPosition) element.style.position = originalPosition;
    if (originalZIndex) element.style.zIndex = originalZIndex;
    if (originalTransform) element.style.transform = originalTransform;
  }

  // Espandi eventuali contenitori collassati
  expandCollapsedElements(element);

  // Attendi il rendering
  await new Promise(resolve => setTimeout(resolve, 100));

  // Ripristina posizione originale
  element.style.position = originalPosition;
  element.style.zIndex = originalZIndex;
  element.style.transform = originalTransform;
}

function findScrollableParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const overflow = window.getComputedStyle(parent).overflow;
    if (overflow === 'auto' || overflow === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function expandCollapsedElements(element: HTMLElement) {
  // Espandi eventuali tabelle o contenitori che potrebbero essere collassati
  const tables = element.querySelectorAll('table');
  tables.forEach(table => {
    (table as HTMLElement).style.width = 'auto';
    (table as HTMLElement).style.tableLayout = 'auto';
  });

  // Rimuovi overflow hidden temporaneamente
  const overflowElements = element.querySelectorAll('[style*="overflow"]');
  overflowElements.forEach(el => {
    (el as HTMLElement).style.overflow = 'visible';
  });
}

// Applica stili ottimizzati per PDF (meno aggressivi)
function applyPDFOptimizedStyles(element: HTMLElement) {
  // 🆕 STILI MIGLIORATI: più semplici e focalizzati sul rendering corretto
  const optimizedStyles = document.createElement('style');
  optimizedStyles.id = 'pdf-optimized-styles';
  optimizedStyles.textContent = `
    /* Assicura che tutti gli elementi siano visibili */
    #${element.id} * {
      visibility: visible !important;
      opacity: 1 !important;
    }

    /* Nascondi elementi non necessari per il PDF */
    #${element.id} .no-print,
    #${element.id} [aria-hidden="true"],
    #${element.id} button,
    #${element.id} .hidden {
      display: none !important;
    }
    
    /* Stili base per il contenuto */
    #${element.id} {
      display: block !important;
      overflow: visible !important;
      font-size: 10px !important;
      line-height: 1.2 !important;
      font-family: Arial, sans-serif !important;
      color: #000 !important;
      background: white !important;
    }
    
    #${element.id} .text-xs {
      font-size: 8px !important;
    }
    
    #${element.id} .text-sm {
      font-size: 9px !important;
    }
    
    #${element.id} .font-semibold,
    #${element.id} .font-bold {
      font-weight: bold !important;
    }
    
    /* Tabelle e celle ottimizzate */
    #${element.id} table {
      display: table !important;
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
    }
    
    #${element.id} tr { 
      display: table-row !important;
    }
    
    #${element.id} td,
    #${element.id} th,
    #${element.id} td {
      display: table-cell !important;
      padding: 3px 4px !important;
      border: 0.5px solid #ccc !important;
      overflow: visible !important;
    }
    
    #${element.id} .min-h-\\[60px\\] {
      min-height: 25px !important;
    }
    
    /* Gestisci spazi */
    #${element.id} .space-y-1 > * + * {
      margin-top: 1px !important;
    }
    
    #${element.id} .space-x-1 > * + * {
      margin-left: 2px !important;
    }
    
    /* Larghezze colonne */
    #${element.id} .min-w-\\[180px\\] {
      min-width: 120px !important;
      max-width: 120px !important;
    }
    
    #${element.id} .min-w-\\[140px\\] {
      min-width: 90px !important;
      max-width: 90px !important;
    }
    
    #${element.id} .min-w-\\[120px\\] {
      min-width: 80px !important;
      max-width: 80px !important;
    }
    
    /* Mantieni testo leggibile */
    #${element.id} .text-xs.text-gray-900 {
      font-weight: bold !important;
      color: #000 !important;
      font-size: 10px !important;
    }
    
    /* Rimuovi scrolling */
    #${element.id} .overflow-x-auto,
    #${element.id} .overflow-y-auto,
    #${element.id} .overflow-auto {
      overflow: visible !important;
    }

    /* Rimuovi ombre e effetti */
    #${element.id} .shadow-sm,
    #${element.id} .shadow-md,
    #${element.id} .shadow-lg {
      box-shadow: none !important;
    }
  `;
  
  document.head.appendChild(optimizedStyles);
  
  // Funzione di cleanup
  const cleanupFunction = () => {
    // Rimuovi lo style sheet
    const styleElement = document.getElementById('pdf-optimized-styles');
    if (styleElement) {
      styleElement.remove();
    }
  };

  return { cleanupFunction };
}

function addCompactPDFHeader(pdf: jsPDF, store: Store, weekStart: Date, pageWidth: number, margin: number) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  // Titolo principale
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PIANIFICAZIONE TURNI', pageWidth / 2, 10, { align: 'center' });
  
  // Info negozio e settimana
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${store.name}`, margin, 16);
  
  const weekText = `Settimana: ${weekStart.toLocaleDateString('it-IT')} - ${weekEnd.toLocaleDateString('it-IT')}`;
  pdf.text(weekText, pageWidth - margin, 16, { align: 'right' });
}

function addCompactPDFFooter(pdf: jsPDF, pageWidth: number, pageHeight: number, margin: number) {
  const footerY = pageHeight - 4;
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  
  // Data generazione
  const now = new Date();
  const generatedText = `Generato: ${now.toLocaleDateString('it-IT')} ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  pdf.text(generatedText, margin, footerY);
  
  // Info
  pdf.text('Per domande contattare il responsabile', pageWidth - margin, footerY, { align: 'right' });
}

function formatDateForFilename(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
}

function showSuccessNotification(message: string) {
  // Crea un elemento più visibile
  const notification = document.createElement('div'); 
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 15px;
    font-weight: 600;
    animation: slideInRight 0.3s ease-out;
  `;

  // Aggiungi animazione CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideInRight 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }, 4000);
}

function showErrorNotification(message: string) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    max-width: 400px;
  `;
  notification.textContent = '❌ ' + message;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}