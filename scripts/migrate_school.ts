import { readFile } from "node:fs/promises";
import { InfraiDnsClient } from "../src/infrai_dns.ts";
import { migrateEdtechZone, migrationRequestSchema } from "../src/zone_migration.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the migration");

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Pass the migration JSON path as the first argument");

const input = migrationRequestSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
const result = await migrateEdtechZone(new InfraiDnsClient(apiKey), input);
console.log(JSON.stringify(result, null, 2));
