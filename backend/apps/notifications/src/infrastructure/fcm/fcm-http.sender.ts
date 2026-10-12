import { Inject, Injectable, Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { FCM_CONFIG } from '../../tokens';
import type { FcmConfig } from '../../models/fcm-config';
import type { PushSendOutcome } from '../interfaces/push-sender.interface';
import type { IFcmSender } from '../interfaces/fcm-sender.interface';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TIMEOUT_MS = 10_000;

class NoAccessToken extends Error {
  constructor(
    readonly outcome: PushSendOutcome,
    message: string,
  ) {
    super(message);
  }
}

// The only file that talks to Google: an OAuth access token from the service-account key (signed
// JWT, cached until a minute before it expires), then FCM's HTTP v1 send. Tokens are never logged.
@Injectable()
export class FcmHttpSender implements IFcmSender {
  private readonly logger = new Logger(FcmHttpSender.name);
  private cached: { value: string; refreshAt: number } | null = null;

  constructor(@Inject(FCM_CONFIG) private readonly config: FcmConfig | null) {}

  async send(
    token: string,
    data: Record<string, string>,
    ttlSeconds: number,
  ): Promise<PushSendOutcome> {
    if (!this.config) return 'failed';
    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.config.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${await this.accessToken()}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              data,
              // High priority: delivered at once, also in Doze (see the plan's 2.23b check).
              android: { priority: 'HIGH', ttl: `${ttlSeconds}s` },
            },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (res.ok) return 'sent';
      const error = await fcmError(res);
      if (res.status === 401) this.cached = null; // a revoked or expired token: the retry gets a new one
      const outcome = classify(res.status, error);
      if (outcome !== 'gone') {
        this.logger.warn(
          `FCM send ${outcome} (${res.status} ${error.code ?? ''}): ${error.message ?? ''}`,
        );
      }
      return outcome;
    } catch (err) {
      if (err instanceof NoAccessToken) {
        this.logger.error(`FCM access token ${err.outcome}: ${err.message}`);
        return err.outcome;
      }
      this.logger.warn(
        `FCM send retry (no response): ${(err as Error).message}`,
      );
      return 'retry';
    }
  }

  private async accessToken(): Promise<string> {
    if (this.cached && Date.now() < this.cached.refreshAt)
      return this.cached.value;
    const { clientEmail, privateKey } = this.config!;
    const assertion = jwt.sign({ scope: SCOPE }, privateKey, {
      algorithm: 'RS256',
      issuer: clientEmail,
      audience: TOKEN_URL,
      expiresIn: 3600,
    });
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new NoAccessToken(
        'retry',
        `no response: ${(err as Error).message}`,
      );
    }
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !body.access_token) {
      // A wrong or deleted key won't fix itself; Google being down might.
      const outcome =
        res.status === 429 || res.status >= 500 ? 'retry' : 'failed';
      throw new NoAccessToken(outcome, `${res.status} ${body.error ?? ''}`);
    }
    const lifetimeMs = (body.expires_in ?? 3600) * 1000;
    this.cached = {
      value: body.access_token,
      refreshAt: Date.now() + Math.max(0, lifetimeMs - 60_000),
    };
    return body.access_token;
  }
}

interface FcmErrorBody {
  status?: string;
  code?: string;
  message?: string;
}

/** FCM's error: `status` (e.g. NOT_FOUND) and the FcmError detail's `errorCode` (e.g. UNREGISTERED). */
async function fcmError(res: Response): Promise<FcmErrorBody> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: {
      status?: string;
      message?: string;
      details?: { errorCode?: string }[];
    };
  };
  const e = body.error ?? {};
  const code = e.details?.find((d) => d.errorCode)?.errorCode ?? e.status;
  return { status: e.status, code, message: e.message };
}

function classify(status: number, error: FcmErrorBody): PushSendOutcome {
  if (status === 404 || error.code === 'UNREGISTERED') return 'gone';
  if (error.code === 'SENDER_ID_MISMATCH') return 'gone'; // another Firebase project's token
  // A token FCM can't parse at all ("not a valid FCM registration token").
  if (status === 400 && /registration token/i.test(error.message ?? ''))
    return 'gone';
  if (status === 429 || status >= 500 || status === 401) return 'retry';
  return 'failed';
}
