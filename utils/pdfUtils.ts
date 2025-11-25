
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

        // Explicitly force worker source if missing to prevent "FakeWorker" errors
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const loadingTask = window.pdfjsLib.getDocument(typedarray);
        const pdf = await loadingTask.promise;
        const images: string[] = [];

        const numPages = pdf.numPages;
        console.log(`Processing PDF: ${file.name}, Pages: ${numPages}`);

        for (let i = 1; i <= numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            
            // Scale 2.0 provides good balance for OCR
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
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            const cleanBase64 = base64.split(',')[1];
            images.push(cleanBase64);
          } catch (pageError) {
            console.error(`Error processing page ${i}:`, pageError);
            // We continue to next page even if one fails, to salvage data
          }
        }

        if (images.length === 0) {
            reject(new Error("No images could be extracted from the PDF."));
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
