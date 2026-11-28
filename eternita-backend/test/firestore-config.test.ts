import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");

describe("Firestore security configuration", () => {
  it("uses deny-by-default rules for every production path", () => {
    const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");

    expect(rules).toContain("rules_version = '2';");
    expect(rules).toContain("match /{document=**}");
    expect(rules).toContain("allow read, write: if false;");
    for (const collection of ["users", "entries", "policies", "legacyRequests", "deathReports", "aiUseLogs", "invites", "health"]) {
      expect(rules).toContain(`/${collection}`);
    }
  });

  it("declares exactly the production composite indexes", () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, "firestore.indexes.json"), "utf8"));
    const indexes = config.indexes.map((index: any) => ({
      collectionGroup: index.collectionGroup,
      fields: index.fields.map((field: any) => `${field.fieldPath}:${field.order}`),
    }));

    expect(indexes).toEqual([
      { collectionGroup: "entries", fields: ["isHidden:ASCENDING", "createdAt:DESCENDING"] },
      { collectionGroup: "entries", fields: ["isDraft:ASCENDING", "publishedAt:DESCENDING"] },
      { collectionGroup: "policies", fields: ["status:ASCENDING", "createdAt:DESCENDING"] },
      { collectionGroup: "legacyRequests", fields: ["requesterUid:ASCENDING", "requestedAt:DESCENDING"] },
      { collectionGroup: "invites", fields: ["code:ASCENDING", "status:ASCENDING"] },
    ]);
  });
});
