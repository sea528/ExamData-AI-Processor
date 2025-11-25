
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
        
        // Ensure PDF.js is loaded
        if (!window.pdfjsLib) {
            reject(new Error("PDF.js library is not loaded. Please check your internet connection or script tags."));
            return;
        }

        // Explicitly force worker source if missing
        // Using the exact version match for stability
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // CRITICAL FOR KOREAN PDFS: Load CMaps to ensure text renders correctly
        // Without this, Korean characters often render as empty boxes or whitespace
        const loadingTask = window.pdfjsLib.getDocument({
            data: typedarray,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            enableXfa: true, // Support XFA forms if present
        });

        const pdf = await loadingTask.promise;
        const images: string[] = [];

        const numPages = pdf.numPages;
        console.log(`Processing PDF: ${file.name}, Pages: ${numPages}`);

        for (let i = 1; i <= numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            
            // Scale 2.0 provides good balance for OCR resolution vs file size
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (!context) {
                throw new Error("Canvas context could not be created.");
            }

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            // Convert to base64
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            const cleanBase64 = base64.split(',')[1];
            images.push(cleanBase64);
          } catch (pageError) {
            console.error(`Error processing page ${i}:`, pageError);
            // We continue to next page even if one fails
          }
        }

        if (images.length === 0) {
            reject(new Error("No images could be extracted from the PDF. The file might be corrupted or password protected."));
            return;
        }

        resolve(images);
      } catch (error: any) {
        console.error("PDF Processing Error:", error);
        reject(new Error(`PDF processing failed: ${error.message}`));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
};
