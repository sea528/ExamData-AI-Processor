// Access the global pdfjsLib injected via index.html script tag
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const convertPdfToImages = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        
        // Use the global window.pdfjsLib
        if (!window.pdfjsLib) {
            reject(new Error("PDF.js library not loaded"));
            return;
        }

        const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
        const images: string[] = [];

        // Process ALL pages, no limit.
        const numPages = pdf.numPages;

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          
          // Set scale. 2.0 is good for OCR accuracy.
          // If files are extremely large (>30 pages), we might consider lowering this to 1.5,
          // but 2.0 ensures best text recognition for dense tables.
          const viewport = page.getViewport({ scale: 2.0 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (!context) continue;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Convert to base64 string
          // Using 0.7 quality to keep payload size reasonable while maintaining legibility for OCR
          const base64 = canvas.toDataURL('image/jpeg', 0.7);
          
          // Remove the data URL prefix for Gemini API
          const cleanBase64 = base64.split(',')[1];
          images.push(cleanBase64);
        }

        resolve(images);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};