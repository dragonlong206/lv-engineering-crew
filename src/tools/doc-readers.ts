import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export async function readRequirementDoc(absPath: string): Promise<string> {
  const ext = path.extname(absPath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(absPath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: absPath });
    return value;
  }

  // .md, .txt, .html, .htm and anything else text-based: read as-is.
  return fs.readFileSync(absPath, 'utf-8');
}
