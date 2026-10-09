import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { AppError } from '../utils/errors.js';
import { cleanText } from './chunker.js';
export async function extractDocument(file) {
  if (!file || file.size > 5 * 1024 * 1024) throw new AppError(400, 'Upload a PDF or DOCX under 5 MB.');
  const filename = file.originalname.toLowerCase(); let pages;
  try {
    if (filename.endsWith('.pdf') && file.buffer.subarray(0, 5).toString() === '%PDF-') {
      const pageTexts = [];
      const parsedPdf = await pdf(new Uint8Array(file.buffer), { max: 40, pagerender: async page => { const content = await page.getTextContent(); const text = content.items.map(item => item.str).join(' '); pageTexts.push({ pageNumber: page.pageIndex + 1, text }); return text; } });
      if (parsedPdf.numpages > 40) throw new AppError(400, 'PDFs must contain at most 40 pages.');
      pages = pageTexts.sort((a, b) => a.pageNumber - b.pageNumber);
    } else if (filename.endsWith('.docx') && file.buffer.subarray(0, 2).toString() === 'PK') {
      const entries = new AdmZip(file.buffer).getEntries();
      if (!entries.some(e => e.entryName === 'word/document.xml') || entries.length > 1000 || entries.reduce((sum, e) => sum + e.header.size, 0) > 20 * 1024 * 1024) throw new Error('Invalid archive');
      const result = await mammoth.extractRawText({ buffer: file.buffer }); pages = [{ pageNumber: null, text: result.value }];
    } else throw new Error('Invalid format');
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError(400, 'This file is not a readable PDF or DOCX. Encrypted and malformed files are not supported.'); }
  pages = pages.map(p => ({ ...p, text: cleanText(p.text) }));
  const text = pages.map(p => p.text).join('\n\n');
  if (text.length < 30) throw new AppError(400, 'No readable text found. Scanned PDFs need OCR before uploading.');
  if (text.length > 80000) throw new AppError(400, 'Document exceeds the 80,000 character processing limit.');
  return { pages, text };
}
