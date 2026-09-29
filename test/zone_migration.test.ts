import assert from "node:assert/strict";
import test from "node:test";
import { planEdtechRecords } from "../src/zone_migration.ts";

test("a school that publishes deadline policy gets the learner TXT record", () => {
  const records = planEdtechRecords({
    domain: "learn.example.edu",
    course_delivery: { name: "courses", target: "delivery.example.net" },
    learner_deadlines: {
      name: "_deadlines",
      policy: "timezone=America/New_York;grace_minutes=15",
      publish: true,
    },
    educator_reporting: { name: "reports", target: "faculty.example.net" },
  });

  assert.deepEqual(records, [
    { record_type: "CNAME", name: "courses", content: "delivery.example.net", ttl: 300 },
    { record_type: "CNAME", name: "reports", content: "faculty.example.net", ttl: 300 },
    {
      record_type: "TXT",
      name: "_deadlines",
      content: "timezone=America/New_York;grace_minutes=15",
      ttl: 300,
    },
  ]);
});

test("an internal deadline policy is left out of public DNS", () => {
  const records = planEdtechRecords({
    domain: "learn.example.edu",
    course_delivery: { name: "courses", target: "delivery.example.net" },
    learner_deadlines: { name: "_deadlines", policy: "internal", publish: false },
    educator_reporting: { name: "reports", target: "faculty.example.net" },
  });

  assert.equal(records.some((record) => record.name === "_deadlines"), false);
});
