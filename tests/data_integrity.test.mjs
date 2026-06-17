// Integrity checks on the committed seed data. Pure Node, no dependencies.
// Run with: node --test tests/

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seed = join(root, "data", "seed");

function readCsv(name) {
  const text = readFileSync(join(seed, name), "utf-8").trim();
  const [header, ...lines] = text.split("\n");
  const cols = header.split(",");
  return { cols, rows: lines };
}

test("jobs.csv has the expected header and rows", () => {
  const { cols, rows } = readCsv("jobs.csv");
  assert.ok(rows.length > 1000, "expected a meaningful number of jobs");
  for (const col of ["job_id", "date", "technician_id", "service_type", "revenue"]) {
    assert.ok(cols.includes(col), `missing column ${col}`);
  }
});

test("every seed file is present and non-empty", () => {
  for (const name of [
    "technicians.csv", "service_types.csv", "customers.csv",
    "jobs.csv", "invoices.csv", "calls.csv", "reviews.csv",
  ]) {
    const { rows } = readCsv(name);
    assert.ok(rows.length > 0, `${name} is empty`);
  }
});

test("job_id values are unique", () => {
  const { cols, rows } = readCsv("jobs.csv");
  const idx = cols.indexOf("job_id");
  const ids = new Set();
  for (const line of rows) {
    const id = line.split(",")[idx];
    assert.ok(!ids.has(id), `duplicate job_id ${id}`);
    ids.add(id);
  }
});
