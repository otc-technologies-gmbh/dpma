/**
 * DPMA Trademark Registration API Server
 * Express-based REST API for automated trademark registration
 */

import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DPMAClient } from '../client/DPMAClient';
import { validateTrademarkRequest, isValidRequest } from '../validation/validateRequest';
import {
  TrademarkRegistrationRequest,
  TrademarkRegistrationResult,
  TrademarkRegistrationSuccess,
} from '../types/dpma';

// ============================================================================
// Types
// ============================================================================

interface ApiResponse<T> {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
}

// ============================================================================
// Server Setup
// ============================================================================

export function createServer(options: { debug?: boolean } = {}): express.Application {
  const app = express();
  const startTime = Date.now();

  // Middleware
  app.use(express.json({ limit: '10mb' })); // Allow larger payloads for image uploads
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = uuidv4();
    (req as any).requestId = requestId;

    if (options.debug) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - RequestID: ${requestId}`);
    }

    next();
  });

  // ============================================================================
  // Routes
  // ============================================================================

  /**
   * Health check endpoint
   */
  app.get('/health', (req: Request, res: Response) => {
    const response: ApiResponse<HealthCheckResponse> = {
      success: true,
      requestId: (req as any).requestId || uuidv4(),
      timestamp: new Date().toISOString(),
      data: {
        status: 'healthy',
        version: '1.0.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
      },
    };
    res.json(response);
  });

  /**
   * API documentation endpoint
   */
  app.get('/api', (req: Request, res: Response) => {
    const response: ApiResponse<object> = {
      success: true,
      requestId: (req as any).requestId || uuidv4(),
      timestamp: new Date().toISOString(),
      data: {
        name: 'DPMA Trademark Registration API',
        version: '1.0.0',
        endpoints: {
          'POST /api/trademark/register': 'Register a new trademark',
          'GET /health': 'Health check',
          'GET /api': 'API documentation',
        },
        documentation: 'See DPMA_AUTOMATION.md for detailed documentation',
      },
    };
    res.json(response);
  });

  /**
   * Main trademark registration endpoint
   */
  app.post('/api/trademark/register', async (req: Request, res: Response) => {
    const requestId = (req as any).requestId || uuidv4();
    const timestamp = new Date().toISOString();

    try {
      // Validate request
      const validationResult = validateTrademarkRequest(req.body);

      if (!isValidRequest(req.body, validationResult)) {
        const response: ApiResponse<null> = {
          success: false,
          requestId,
          timestamp,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: validationResult.errors,
          },
        };
        return res.status(400).json(response);
      }

      const trademarkRequest: TrademarkRegistrationRequest = req.body;

      if (options.debug) {
        console.log(`[${timestamp}] Processing registration for: ${trademarkRequest.trademark.type === 'word' ? (trademarkRequest.trademark as any).text : 'image/combined'}`);
      }

      // Create DPMA client and register trademark
      const client = new DPMAClient({ debug: options.debug });
      const result: TrademarkRegistrationResult = await client.registerTrademark(trademarkRequest);

      if (result.success) {
        const successResult = result as TrademarkRegistrationSuccess;

        // Convert all receipt documents to base64 for JSON response
        const documents = successResult.receiptDocuments?.map(doc => ({
          filename: doc.filename,
          mimeType: doc.mimeType,
          dataBase64: doc.data.toString('base64'),
        })) || [];

        const response: ApiResponse<object> = {
          success: true,
          requestId,
          timestamp,
          data: {
            aktenzeichen: successResult.aktenzeichen,
            drn: successResult.drn,
            transactionId: successResult.transactionId,
            submissionTime: successResult.submissionTime,
            fees: successResult.fees,
            payment: successResult.payment,
            documents, // All documents from the ZIP
            receiptFilePath: successResult.receiptFilePath, // Path to saved ZIP
          },
        };

        if (options.debug) {
          console.log(`[${timestamp}] Registration successful: ${successResult.aktenzeichen}`);
        }

        return res.status(201).json(response);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          requestId,
          timestamp,
          error: {
            code: result.errorCode,
            message: result.errorMessage,
            details: {
              failedAtStep: result.failedAtStep,
              validationErrors: result.validationErrors,
            },
          },
        };

        if (options.debug) {
          console.log(`[${timestamp}] Registration failed: ${result.errorMessage}`);
        }

        return res.status(500).json(response);
      }

    } catch (error: any) {
      console.error(`[${timestamp}] Unexpected error:`, error);

      const response: ApiResponse<null> = {
        success: false,
        requestId,
        timestamp,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'An unexpected error occurred',
          details: options.debug ? error.stack : undefined,
        },
      };

      return res.status(500).json(response);
    }
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  // 404 handler
  app.use((req: Request, res: Response) => {
    const response: ApiResponse<null> = {
      success: false,
      requestId: (req as any).requestId || uuidv4(),
      timestamp: new Date().toISOString(),
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} not found`,
      },
    };
    res.status(404).json(response);
  });

  // Global error handler
  app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', error);

    const response: ApiResponse<null> = {
      success: false,
      requestId: (req as any).requestId || uuidv4(),
      timestamp: new Date().toISOString(),
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal server error occurred',
        details: options.debug ? error.message : undefined,
      },
    };
    res.status(500).json(response);
  });

  return app;
}

/**
 * Start the server
 */
export function startServer(port: number = 3000, options: { debug?: boolean } = {}): void {
  const app = createServer(options);

  app.listen(port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   DPMA Trademark Registration API                             ║
║   ─────────────────────────────────────────────────────────   ║
║                                                               ║
║   Server running on: http://localhost:${port.toString().padEnd(24)}║
║                                                               ║
║   Endpoints:                                                  ║
║   • POST /api/trademark/register  - Register trademark        ║
║   • GET  /health                  - Health check              ║
║   • GET  /api                     - API documentation         ║
║                                                               ║
║   Debug mode: ${(options.debug ? 'ENABLED' : 'DISABLED').padEnd(45)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}
