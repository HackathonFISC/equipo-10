import { createHash } from "node:crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { AppError } from "../../errors";
import type { SourceKind } from "@equipo10/contracts";

export interface ParsedFragment {
  text: string;
  page?: number | null;
  startMillis?: number | null;
  endMillis?: number | null;
}

export interface ParsedSourceResult {
  kind: SourceKind;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  fragments: ParsedFragment[];
  status: "READY" | "FAILED";
  needsManualInput?: boolean;
}

interface RawPdfItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MultimodalParserService {
  private readonly MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MiB
  private readonly MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MiB
  private readonly MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MiB

  async validateAndParse(buffer: Buffer, declaredKind: string): Promise<ParsedSourceResult> {
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const sizeBytes = buffer.length;

    switch (declaredKind.toLowerCase()) {
      case "pdf":
        return await this.parsePdf(buffer, sizeBytes, sha256);
      case "image":
        return this.parseImage(buffer, sizeBytes, sha256);
      case "audio":
        return this.parseAudio(buffer, sizeBytes, sha256);
      default:
        throw new AppError(415, "UNSUPPORTED_SOURCE", `Formato de fuente no soportado: ${declaredKind}`);
    }
  }

  private async parsePdf(buffer: Buffer, sizeBytes: number, sha256: string): Promise<ParsedSourceResult> {
    if (sizeBytes > this.MAX_PDF_BYTES) {
      throw new AppError(413, "SOURCE_TOO_LARGE", "El archivo PDF supera el límite de 10 MiB");
    }

    // Validación estricta de Magic Bytes %PDF-
    if (buffer.length < 5 || buffer.toString("utf-8", 0, 5) !== "%PDF-") {
      throw new AppError(415, "UNSUPPORTED_SOURCE", "El archivo no es un documento PDF válido (magic bytes inválidos)");
    }

    let doc: any;
    try {
      const data = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
      });
      doc = await loadingTask.promise;
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("password") || msg.includes("Password") || msg.includes("encrypted")) {
        throw new AppError(422, "PDF_PASSWORD_PROTECTED", "El documento PDF está protegido con contraseña");
      }
      throw new AppError(422, "INVALID_SOURCE_FILE", "El documento PDF está corrupto o no se puede interpretar");
    }

    const numPages = doc.numPages || 1;
    if (numPages > 10) {
      throw new AppError(422, "VALIDATION_FAILED", "El PDF supera el límite de 10 páginas permitidas");
    }

    const fragments: ParsedFragment[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const pageText = this.orderPageText(textContent.items, viewport.width);
      if (pageText.trim().length > 0) {
        fragments.push({
          text: pageText.trim(),
          page: pageNum,
          startMillis: null,
          endMillis: null,
        });
      }
    }

    // Si el PDF no contiene texto digital utilizable (ej. escaneo puro sin OCR o en blanco)
    if (fragments.length === 0) {
      return {
        kind: "PDF",
        mediaType: "application/pdf",
        sizeBytes,
        sha256,
        fragments: [],
        status: "FAILED",
        needsManualInput: true,
      };
    }

    return {
      kind: "PDF",
      mediaType: "application/pdf",
      sizeBytes,
      sha256,
      fragments,
      status: "READY",
      needsManualInput: false,
    };
  }

  /**
   * Ordena los bloques de texto de una página respetando el flujo de lectura humano.
   * Si detecta una separación en 2 columnas, extrae primero la columna 1 y luego la columna 2,
   * evitando que se intercalen líneas de experiencia con habilidades adyacentes.
   */
  private orderPageText(items: any[], pageWidth: number): string {
    const rawItems: RawPdfItem[] = items
      .filter((it: any) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it: any) => ({
        str: it.str.trim(),
        x: it.transform[4],
        y: it.transform[5],
        width: it.width || 0,
        height: it.height || 10,
      }));

    if (rawItems.length === 0) return "";

    const splitX = pageWidth * 0.45;
    const leftItems = rawItems.filter((it) => it.x + it.width / 2 < splitX);
    const rightItems = rawItems.filter((it) => it.x > splitX);

    // Si hay al menos 2 elementos a la izquierda y 2 a la derecha, evaluar distribución en 2 columnas
    const isTwoColumn = leftItems.length >= 2 && rightItems.length >= 2;

    if (isTwoColumn) {
      const colTopY = Math.min(
        Math.max(...leftItems.map((i) => i.y)),
        Math.max(...rightItems.map((i) => i.y))
      );

      const headers: RawPdfItem[] = [];
      const col1: RawPdfItem[] = [];
      const col2: RawPdfItem[] = [];

      for (const it of rawItems) {
        if (it.y > colTopY + 20) {
          headers.push(it);
        } else if (it.x + it.width / 2 < splitX) {
          col1.push(it);
        } else {
          col2.push(it);
        }
      }

      const parts = [
        this.groupLinesAndSort(headers),
        this.groupLinesAndSort(col1),
        this.groupLinesAndSort(col2),
      ].filter((p) => p.length > 0);

      return parts.join("\n\n");
    }

    // Columna única
    return this.groupLinesAndSort(rawItems);
  }

  private groupLinesAndSort(items: RawPdfItem[]): string {
    if (items.length === 0) return "";

    const lines: { y: number; items: RawPdfItem[] }[] = [];
    const sortedByY = [...items].sort((a, b) => b.y - a.y);

    for (const item of sortedByY) {
      const line = lines.find((l) => Math.abs(l.y - item.y) <= 4);
      if (line) {
        line.items.push(item);
      } else {
        lines.push({ y: item.y, items: [item] });
      }
    }

    return lines
      .map((line) =>
        line.items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.str)
          .join(" ")
      )
      .join("\n");
  }

  private parseImage(buffer: Buffer, sizeBytes: number, sha256: string): ParsedSourceResult {
    if (sizeBytes > this.MAX_IMAGE_BYTES) {
      throw new AppError(413, "SOURCE_TOO_LARGE", "La imagen supera el límite de 8 MiB");
    }

    let mediaType = "";
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      mediaType = "image/jpeg";
    } else if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      mediaType = "image/png";
    } else if (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
      mediaType = "image/webp";
    } else {
      throw new AppError(
        415,
        "UNSUPPORTED_SOURCE",
        "El archivo no es una imagen compatible (se requiere JPEG, PNG o WebP con magic bytes válidos)"
      );
    }

    return {
      kind: "IMAGE",
      mediaType,
      sizeBytes,
      sha256,
      fragments: [
        {
          text: `Evidencia visual importada (${mediaType}, ${sizeBytes} bytes). Certificado o constancia laboral visual registrada para revisión.`,
          page: null,
          startMillis: null,
          endMillis: null,
        },
      ],
      status: "READY",
      needsManualInput: false,
    };
  }

  private parseAudio(buffer: Buffer, sizeBytes: number, sha256: string): ParsedSourceResult {
    if (sizeBytes > this.MAX_AUDIO_BYTES) {
      throw new AppError(413, "SOURCE_TOO_LARGE", "El audio supera el límite de 10 MiB");
    }

    let mediaType = "";
    if (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WAVE"
    ) {
      mediaType = "audio/wav";
    } else if (
      (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
    ) {
      mediaType = "audio/mpeg";
    } else if (
      buffer.length >= 8 &&
      buffer.toString("ascii", 4, 8) === "ftyp"
    ) {
      mediaType = "audio/mp4";
    } else {
      throw new AppError(
        415,
        "UNSUPPORTED_SOURCE",
        "El archivo no es un audio compatible (se requiere WAV, MP3 o M4A con cabeceras válidas)"
      );
    }

    return {
      kind: "AUDIO",
      mediaType,
      sizeBytes,
      sha256,
      fragments: [
        {
          text: `Evidencia de audio importada (${mediaType}, ${sizeBytes} bytes). Declaración verbal grabada para análisis de trayectoria.`,
          page: null,
          startMillis: 0,
          endMillis: 15000,
        },
      ],
      status: "READY",
      needsManualInput: false,
    };
  }
}
