import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
const directory = fileURLToPath(new URL('../../demo-documents/', import.meta.url));
await mkdir(directory,{recursive:true});
const escapeXML = v => v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function docx(lines) {
  const zip=new AdmZip();
  zip.addFile('[Content_Types].xml',Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  zip.addFile('_rels/.rels',Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'));
  zip.addFile('word/document.xml',Buffer.from('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+lines.map(line=>`<w:p><w:r><w:t>${escapeXML(line)}</w:t></w:r></w:p>`).join('')+'<w:sectPr/></w:body></w:document>'));
  return zip.toBuffer();
}
async function pdf(lines) {
  const document = await PDFDocument.create(); const page = document.addPage([595,842]); const font = await document.embedFont(StandardFonts.Helvetica);
  const wrapped = lines.flatMap(line => line.match(/.{1,82}(?:\s|$)|.{1,82}/g) || ['']);
  let y=795; for(const line of wrapped){page.drawText(line,{x:48,y,size:11,font});y-=18;}
  return Buffer.from(await document.save({useObjectStreams:false}));
}

const resume=['FICTIONAL SAMPLE RESUME - FOR SOFTWARE TESTING ONLY','Aarohi Mehta | demo@example.test | Mysuru','EDUCATION','B.Tech Information Science, Demo Engineering College. Graduation: 2027. CGPA: 8.2/10.','SKILLS','JavaScript, Node.js, Express, MongoDB, React, Git.','PROJECTS','Demo API Gateway - Built an Express API that routes requests to backend services.','Added JWT authentication and wrote request validation tests.','Documented endpoints and error responses in a project README.','No employment, certifications or awards are claimed in this fictional fixture.'];
await writeFile(directory+'sample-resume-demo.docx',docx(resume));await writeFile(directory+'sample-resume-demo.pdf',await pdf(resume));
const guidelines=['FICTIONAL DEMO GUIDELINES - NOT A REAL SCHOLARSHIP','Open Source Learners - Demo','Provider: Fictional Learning Foundation. Award amount: INR 25000.','Minimum CGPA: 7. Eligible degree: B.Tech. Eligible branches: ISE, CSE, IT.','Maximum annual family income: INR 400000.','Required documents: Enrollment proof, Academic transcript, Income certificate.','Use the current fictional demo database record for its generated demo deadline.','This document exists only to test ingestion, retrieval and source citations.'];
await writeFile(directory+'scholarship-guidelines-demo.pdf',await pdf(guidelines));await writeFile(directory+'scholarship-guidelines-demo.docx',docx(guidelines));
console.log('Created four clearly labeled PDF/DOCX fixtures.');
