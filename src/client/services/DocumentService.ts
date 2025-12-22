/**
 * DocumentService - Download and save receipt documents
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { DownloadedDocument } from '../../types/dpma';
import { DPMAHttpClient, BASE_URL, VERSAND_PATH } from '../http';
import { DebugLogger } from '../utils/DebugLogger';

export class DocumentService {
  private http: DPMAHttpClient;
  private logger: DebugLogger;
  private receiptsDir: string;

  constructor(http: DPMAHttpClient, logger: DebugLogger, receiptsDir: string) {
    this.http = http;
    this.logger = logger;
    this.receiptsDir = receiptsDir;
  }

  /**
   * Download the receipt documents as a ZIP archive
   */
  async download(encryptedTransactionId: string): Promise<{
    zipData: Buffer;
    documents: DownloadedDocument[];
  }> {
    this.logger.log('Downloading receipt documents...');

    const downloadUrl = `${VERSAND_PATH}/versand/anlagen?encryptedTransactionId=${encodeURIComponent(encryptedTransactionId)}`;
    const response = await this.http.get(downloadUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': `${BASE_URL}${VERSAND_PATH}/index.html`,
      },
      responseType: 'arraybuffer',
    });

    const zipData = Buffer.from(response.data);
    const documents: DownloadedDocument[] = [];

    // Extract individual files from the ZIP for API response
    try {
      const zip = new AdmZip(zipData);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (!entry.isDirectory) {
          documents.push({
            filename: entry.entryName,
            data: entry.getData(),
            mimeType: entry.entryName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          });
          this.logger.log(`Extracted document: ${entry.entryName}`);
        }
      }
    } catch (error) {
      this.logger.log('Failed to extract ZIP contents');
    }

    return { zipData, documents };
  }

  /**
   * Save the complete ZIP archive to the receipts folder
   */
  saveZip(aktenzeichen: string, zipData: Buffer): string {
    this.ensureDir(this.receiptsDir);
    const safeAkz = aktenzeichen.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${safeAkz}_documents.zip`;
    const filepath = path.join(this.receiptsDir, filename);
    fs.writeFileSync(filepath, zipData);
    this.logger.log(`Saved ZIP archive: ${filepath}`);
    return filepath;
  }

  /**
   * Save an individual receipt document to the receipts folder
   */
  saveDocument(aktenzeichen: string, document: DownloadedDocument): string {
    this.ensureDir(this.receiptsDir);

    // Create filename from aktenzeichen (sanitize for filesystem)
    const safeAkz = aktenzeichen.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${safeAkz}_${document.filename}`;
    const filepath = path.join(this.receiptsDir, filename);

    fs.writeFileSync(filepath, document.data);
    this.logger.log(`Saved receipt: ${filepath}`);

    return filepath;
  }

  /**
   * Ensure a directory exists
   */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
