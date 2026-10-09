import assert from "node:assert/strict";
import { test } from "node:test";
import { findSourceByName } from "./income-sources";

test("a typed source name matches ignoring case and repeated spaces, preferring an active source", () => {
  const archived = new Date("2026-01-01");
  const sources = [
    { id: "old", name: "Uber Eats", archivedAt: archived },
    { id: "uber", name: "Uber", archivedAt: null },
    { id: "eats", name: "uber  eats", archivedAt: null },
  ];
  assert.equal(findSourceByName(sources, "  UBER ")?.id, "uber");
  assert.equal(findSourceByName(sources, "Uber eats")?.id, "eats");
  assert.equal(findSourceByName([sources[0]], "uber eats")?.id, "old");
  assert.equal(findSourceByName(sources, "Didi"), undefined);
  assert.equal(findSourceByName(sources, "   "), undefined);
});
