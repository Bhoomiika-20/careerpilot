export function cleanText(text) { return text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
export function chunkText(text, size = 1600, overlap = 250) {
  if (size <= overlap || overlap < 0) throw new Error('Chunk size must exceed overlap');
  const cleaned = cleanText(text), chunks = [];
  for (let start = 0; start < cleaned.length;) {
    let end = Math.min(start + size, cleaned.length);
    const boundary = cleaned.lastIndexOf(' ', end);
    if (end < cleaned.length && boundary > start + size / 2) end = boundary;
    chunks.push(cleaned.slice(start, end));
    if (end === cleaned.length) break;
    start = end - overlap;
  }
  return chunks;
}
