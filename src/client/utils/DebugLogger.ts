/**
 * DebugLogger - Centralized debug logging and file saving
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DebugLoggerOptions {
  enabled: boolean;
  debugDir: string;
}

export class DebugLogger {
  private enabled: boolean;
  private debugDir: string;

  constructor(options: DebugLoggerOptions) {
    this.enabled = options.enabled;
    this.debugDir = options.debugDir;
  }

  /**
   * Log a message if debug mode is enabled
   */
  log(message: string, data?: unknown): void {
    if (this.enabled) {
      console.log(`[DPMAClient] ${message}`, data ?? '');
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Save a debug file (only if debug mode is enabled)
   */
  saveFile(filename: string, content: string | Buffer): void {
    if (!this.enabled) return;
    try {
      this.ensureDir(this.debugDir);
      fs.writeFileSync(path.join(this.debugDir, filename), content);
      this.log(`Saved debug file: ${filename}`);
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Check if debug mode is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the debug directory path
   */
  getDebugDir(): string {
    return this.debugDir;
  }
}
