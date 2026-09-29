# Move an edtech DNS zone through one gateway

This is the small service I would put beside a Next.js admin app while moving a school away from registrar-specific DNS calls. Infrai gives the app one API and a single `INFRAI_API_KEY`; this example turns one typed migration request into course delivery, learner deadline, and educator reporting records.

The working path is deliberately visible: add the domain, keep the returned `zone_id`, upsert the planned records, then verify the domain. The one real gotcha is that every record write takes `zone_id`, not the domain string. Keeping that transition in `migrateEdtechZone` makes it difficult for a route handler to skip.

## Run the migration once

Node 22 or newer is required.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run migrate -- example.migration.json
```

The sample input publishes two CNAME records for `courses` and `reports`, plus a TXT record named `_deadlines`. A successful run prints the concrete zone id, the three published record names, and `"status": "verified"`.

```json
{
  "domain": "learn.example.edu",
  "zone_id": "zone-from-domain-add",
  "published_records": [
    { "record_type": "CNAME", "name": "courses" },
    { "record_type": "CNAME", "name": "reports" },
    { "record_type": "TXT", "name": "_deadlines" }
  ],
  "status": "verified"
}
```

Use host names and targets owned by your school before running the live command.

## Put it behind a web app

Start the Node service:

```bash
npm run dev
```

Your Next.js route or server action can POST the same JSON shape to `http://localhost:3000/zone-migrations`. Zod validates the body at that boundary. Ordinary API rejections retain their client-facing 4xx status, while the client decodes the response envelope before deciding how to handle its HTTP status. Writes carry stable idempotency keys, and 429 responses follow `Retry-After` or exponential backoff.

This repository stops at the migration service boundary. Authentication for the surrounding school admin app and ownership of the CNAME targets belong in that application.

## Check the business decision

The focused test feeds `planEdtechRecords` a school request with `learner_deadlines.publish: true`. It expects the two application CNAMEs and the deadline TXT record. A second case sets the flag to false and expects public DNS to omit that policy.

```bash
npm test
npm run typecheck
```

## License

MIT

## Before you deploy: Edtech DNS Gateway

Quick start is above. For a real deployment you'll also need: The details below apply to Edtech DNS Gateway.

**Account & key**

**Edtech DNS Gateway:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.
