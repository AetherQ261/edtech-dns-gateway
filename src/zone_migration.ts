import { createHash } from "node:crypto";
import { z } from "zod";
import type { InfraiDnsClient, RecordInput } from "./infrai_dns.ts";

export const migrationRequestSchema = z.object({
  domain: z.string().min(1),
  course_delivery: z.object({
    name: z.string().min(1),
    target: z.string().min(1),
  }),
  learner_deadlines: z.object({
    name: z.string().min(1),
    policy: z.string().min(1),
    publish: z.boolean(),
  }),
  educator_reporting: z.object({
    name: z.string().min(1),
    target: z.string().min(1),
  }),
});

export type MigrationRequest = z.infer<typeof migrationRequestSchema>;

export type PlannedRecord = Omit<RecordInput, "zone_id">;

export function planEdtechRecords(input: MigrationRequest): PlannedRecord[] {
  const records: PlannedRecord[] = [
    {
      record_type: "CNAME",
      name: input.course_delivery.name,
      content: input.course_delivery.target,
      ttl: 300,
    },
    {
      record_type: "CNAME",
      name: input.educator_reporting.name,
      content: input.educator_reporting.target,
      ttl: 300,
    },
  ];

  if (input.learner_deadlines.publish) {
    records.push({
      record_type: "TXT",
      name: input.learner_deadlines.name,
      content: input.learner_deadlines.policy,
      ttl: 300,
    });
  }

  return records;
}

function operationKey(domain: string, record: PlannedRecord): string {
  const digest = createHash("sha256")
    .update(JSON.stringify({ domain, record }))
    .digest("hex")
    .slice(0, 24);
  return `edtech-dns-${digest}`;
}

export async function migrateEdtechZone(
  client: InfraiDnsClient,
  input: MigrationRequest,
) {
  const zone = await client.addDomain(input.domain, `edtech-domain-${input.domain}`);
  const records = planEdtechRecords(input);

  await Promise.all(
    records.map((record) =>
      client.upsertRecord(
        { zone_id: zone.zone_id, ...record },
        operationKey(input.domain, record),
      ),
    ),
  );
  await client.verifyDomain(input.domain, `edtech-verify-${input.domain}`);

  return {
    domain: input.domain,
    zone_id: zone.zone_id,
    published_records: records.map(({ record_type, name }) => ({ record_type, name })),
    status: "verified" as const,
  };
}
