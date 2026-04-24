import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Services:DocumentIngestion:Extractors:Image");
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
            logger.info(`[DocIngestion:OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      return text;
    } catch (error) {
      logger.error("[DocIngestion:OCR] Failed:", undefined, error);
      throw new Error(
        `OCR extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export const imageExtractor = new ImageExtractor();
