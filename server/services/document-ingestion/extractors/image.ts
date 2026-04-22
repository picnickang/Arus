import Tesseract from "tesseract.js";
import sharp from "sharp";
import type { TextExtractor, SupportedFileType } from "../types";

export class ImageExtractor implements TextExtractor {
  supportedTypes: SupportedFileType[] = ["png", "jpg", "jpeg"];

  async extract(buffer: Buffer): Promise<string> {
    try {
      const pngBuffer = await sharp(buffer).png().toBuffer();

      const {
        data: { text },
      } = await Tesseract.recognize(pngBuffer, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`[DocIngestion:OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      return text;
    } catch (error) {
      console.error("[DocIngestion:OCR] Failed:", error);
      throw new Error(
        `OCR extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export const imageExtractor = new ImageExtractor();
