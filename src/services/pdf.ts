import * as pdfjsLib from 'pdfjs-dist';

// Configure the pdfjs worker using CDN to avoid bundler issues in Vite
// We dynamically match the installed version or fallback to a standard stable version (e.g., 3.4.120)
const PDFJS_VERSION = '3.4.120';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

/**
 * Extracts plain text from the first few pages of a PDF File.
 * Useful for summarizing notes with the Gemini API on the client side.
 * 
 * @param file The PDF File object uploaded by the user
 * @param maxPages The maximum number of pages to read (default 5 to keep summarization fast and cost-effective)
 * @returns Promise<string> The extracted text content
 */
export const extractTextFromPdf = async (file: File, maxPages = 5): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        
        const numPages = Math.min(pdf.numPages, maxPages);
        let extractedText = '';

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
            
          extractedText += `--- Page ${i} ---\n${pageText}\n\n`;
        }

        if (!extractedText.trim()) {
          resolve("This PDF note is scanned or contains no text layers. (Please provide a text-based PDF for detailed AI summaries).");
        } else {
          resolve(extractedText);
        }
      } catch (error) {
        console.error("Error parsing PDF text layers:", error);
        reject(new Error("Unable to parse text layers from this PDF. Please check if the file is encrypted or corrupted."));
      }
    };

    reader.onerror = () => {
      reject(new Error("File reader encountered an error."));
    };

    reader.readAsArrayBuffer(file);
  });
};
