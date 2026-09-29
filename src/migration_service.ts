import { createServer } from "node:http";
import { InfraiDnsClient, InfraiError } from "./infrai_dns.ts";
import { migrateEdtechZone, migrationRequestSchema } from "./zone_migration.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiDnsClient(apiKey);

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/zone-migrations") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsedJson: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const input = migrationRequestSchema.parse(parsedJson);
    json(response, 201, await migrateEdtechZone(client, input));
  } catch (error) {
    if (error instanceof InfraiError) {
      json(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (error instanceof SyntaxError || error instanceof Error && error.name === "ZodError") {
      json(response, 400, { error: { message: "Request body is invalid" } });
      return;
    }
    json(response, 500, { error: { message: "Migration could not be completed" } });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Migration service listening on http://localhost:${port}`));
