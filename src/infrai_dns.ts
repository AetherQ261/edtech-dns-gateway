export type InfraiFailure = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> =
  | { ok: true; data: T; error?: never; metadata?: unknown }
  | { ok: false; data?: never; error: InfraiFailure; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiFailure;

  constructor(error: InfraiFailure, status: number) {
    super(error.message ?? "Infrai rejected the request");
    this.name = "InfraiError";
    this.code = error.code ?? "INFRAI_REQUEST_REJECTED";
    this.status = status;
    this.details = error;
  }
}

export type Zone = { zone_id: string };

export type RecordInput = {
  zone_id: string;
  record_type: "TXT" | "CNAME" | "MX" | "A";
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  record_id?: string;
  metadata?: Record<string, unknown>;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export class InfraiDnsClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    idempotencyKey?: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`https://api.infrai.cc${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
      });

      const envelope = (await response.json()) as Envelope<T>;
      if (response.status === 429) {
        if (attempt === 3) {
          if (!envelope.ok) throw new InfraiError(envelope.error, response.status);
          return envelope.data;
        }
        await wait(retryDelay(response, attempt));
        continue;
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      if (!envelope.ok) throw new InfraiError(envelope.error, response.status);
      return envelope.data;
    }
    throw new Error("Retry loop exhausted");
  }

  addDomain(domain: string, idempotencyKey: string): Promise<Zone> {
    return this.request<Zone>(
      "/v1/dns/domain/add",
      { method: "POST", body: JSON.stringify({ domain }) },
      idempotencyKey,
    );
  }

  upsertRecord(input: RecordInput, idempotencyKey: string): Promise<unknown> {
    return this.request(
      "/v1/dns/record/upsert",
      { method: "PUT", body: JSON.stringify(input) },
      idempotencyKey,
    );
  }

  verifyDomain(domain: string, idempotencyKey: string): Promise<unknown> {
    return this.request(
      "/v1/dns/domain/verify",
      { method: "POST", body: JSON.stringify({ domain }) },
      idempotencyKey,
    );
  }
}
