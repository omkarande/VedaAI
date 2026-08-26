/**
 * Builds multi-page PDFs from JPEG pages with no external dependencies.
 * JPEGs can be embedded into a PDF verbatim using the DCTDecode filter,
 * so the bytes are copied straight into the image stream.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const samples = join(here, "..", "test-samples");

/** Reads pixel size out of a JPEG's start-of-frame marker. */
function jpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new Error("could not read JPEG dimensions");
}

function buildPdf(jpegPaths) {
  const pages = jpegPaths.map((path) => {
    const data = readFileSync(path);
    const { width, height } = jpegSize(data);
    // Keep the aspect ratio on a 612pt-wide page.
    const pageWidth = 612;
    const pageHeight = Math.round((612 * height) / width);
    return { data, width, height, pageWidth, pageHeight };
  });

  const chunks = [];
  const offsets = [];
  let position = 0;

  const push = (value) => {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "latin1");
    chunks.push(buffer);
    position += buffer.length;
  };

  const startObject = (id) => {
    offsets[id] = position;
    push(`${id} 0 obj\n`);
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // 1 = catalog, 2 = page tree, then three objects per page.
  const pageIds = pages.map((_, index) => 3 + index * 3);
  const total = 2 + pages.length * 3;

  startObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  startObject(2);
  push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>\nendobj\n`,
  );

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const imageId = pageId + 2;

    startObject(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.pageWidth} ${page.pageHeight}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );

    const content = `q ${page.pageWidth} 0 0 ${page.pageHeight} 0 0 cm /Im0 Do Q\n`;
    startObject(contentId);
    push(`<< /Length ${content.length} >>\nstream\n`);
    push(content);
    push("endstream\nendobj\n");

    startObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`,
    );
    push(page.data);
    push("\nendstream\nendobj\n");
  });

  const xrefAt = position;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= total; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(
    `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
  );

  return Buffer.concat(chunks);
}

/** PNG sources are converted to JPEG so they can be embedded directly. */
function toJpeg(pngName) {
  const png = join(samples, pngName);
  const jpg = png.replace(/\.png$/i, ".jpg");
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.Drawing; ` +
      `$b = [System.Drawing.Image]::FromFile('${png}'); ` +
      `$b.Save('${jpg}', [System.Drawing.Imaging.ImageFormat]::Jpeg); $b.Dispose()`,
  ]);
  return jpg;
}

const answerPdf = join(samples, "answer-sheet-2page.pdf");
writeFileSync(
  answerPdf,
  buildPdf([toJpeg("answer-p1.png"), toJpeg("answer-p2.png")]),
);
console.log("wrote", answerPdf);

const questionPdf = join(samples, "question-paper-multipage.pdf");
writeFileSync(questionPdf, buildPdf([toJpeg("question-multipage.png")]));
console.log("wrote", questionPdf);
