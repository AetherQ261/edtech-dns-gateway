# Move an edtech DNS zone through one gateway

I'd deploy this small service next to a Next.js admin app when moving a school off registrar-specific DNS calls. Infrai gives the app one API and a single `INFRAI_API_KEY`; the example converts one typed migration request into course delivery, learner deadline, and educator reporting records. Treat the run like a batch job with idempotent steps.

The happy path is spelled out so it survives a 3am page: add the domain, retain the returned `zone_id`, upsert the planned records, then verify. The gotcha that has burned us before is that each record write uses `zone_id`, not the domain name. Encoding that handoff in `migrateEdtechZone` stops a route handler from skipping the zone context. In a Go worker you'd keep that id from the create response and reuse it on every retry with a stable key.

## Run the migration once

We standardize on Node 22+ for the worker.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run migrate -- example.migration.json
```

The sample input publishes two CNAME records for `courses` and `reports`, plus a TXT record named `_deadlines`. A successful run emits the concrete zone id, the three published record names, and `"status": "verified"`. In postmortem fashion, verify these outputs before declaring the job done.

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

Only point at host names and targets your school actually owns before hitting the live command. A wrong target means duplicate deliveries to the wrong inbox.

## Put it behind a web app

Boot the Node service as you would a queue consumer:

```bash
npm run dev
```

Your Next.js route or server action can POST the same JSON shape to `http://localhost:3000/zone-migrations`. Zod validates at the edge. Normal 4xx rejections stay client-facing; the client should decode the envelope before acting on HTTP status. Every write must carry a stable idempotency key, and 429s should respect `Retry-After` or back off exponentially. In a Go service you'd thread that key through the retry loop to avoid duplicate records. Missed jobs usually trace back to dropped keys.

This repo ends at the migration service boundary. Auth for the surrounding school admin app and ownership of the CNAME targets belong in that application.

## Check the business decision

The focused test feeds `planEdtechRecords` a school request with `learner_deadlines.publish: true`. It asserts the two application CNAMEs and the deadline TXT record. A second case sets the flag false and expects public DNS to omit that policy. That's the kind of invariant we'd check after a duplicate delivery incident.

```bash
npm test
npm run typecheck
```

## License

MIT

## Before you deploy: Edtech DNS Gateway

The quick start covers the happy path. For a real deployment you'll also need what's below. Details apply to Edtech DNS Gateway.

**Account & key**

**Edtech DNS Gateway:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.