import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  firestoreQueryInventory,
  requiredFirestoreIndexes,
  type FirestoreIndexDefinition,
} from "../src/config/firestore-query-indexes";

const backendRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(backendRoot, "..");
const indexesPath = path.join(repositoryRoot, "firestore.indexes.json");

function normalizeIndex(index: FirestoreIndexDefinition) {
  return {
    collectionGroup: index.collectionGroup,
    queryScope: index.queryScope,
    fields: index.fields.map((field) => ({
      fieldPath: field.fieldPath,
      order: field.order,
    })),
  };
}

function readConfiguredIndexes(): FirestoreIndexDefinition[] {
  const config = JSON.parse(fs.readFileSync(indexesPath, "utf8")) as {
    indexes?: FirestoreIndexDefinition[];
  };
  return config.indexes ?? [];
}

describe("Firestore query-to-index audit", () => {
  it("has a source inventory for every backend query", () => {
    expect(firestoreQueryInventory.length).toBeGreaterThan(0);

    for (const query of firestoreQueryInventory) {
      const sourcePath = path.join(backendRoot, query.sourceFile);
      const source = fs.readFileSync(sourcePath, "utf8");
      expect(source).toContain(`${query.functionName}(`);
    }
  });

  it("requires exactly the indexes declared by the query inventory", () => {
    const required = requiredFirestoreIndexes.map(normalizeIndex);
    const configured = readConfiguredIndexes().map(normalizeIndex);

    expect(configured).toEqual(expect.arrayContaining(required));
    expect(configured).toHaveLength(required.length);
  });

  it("has an exact matching definition for every composite-index query", () => {
    const configured = readConfiguredIndexes().map(normalizeIndex);

    for (const query of firestoreQueryInventory) {
      if (!query.requiredCompositeIndex) continue;

      expect(configured).toContainEqual(normalizeIndex(query.requiredCompositeIndex));
    }
  });

  it("reports no unused configured composite indexes", () => {
    const required = requiredFirestoreIndexes.map(normalizeIndex);
    const configured = readConfiguredIndexes().map(normalizeIndex);
    const unused = configured.filter(
      (index) => !required.some((requiredIndex) => JSON.stringify(requiredIndex) === JSON.stringify(index)),
    );

    expect(unused).toEqual([]);
  });
});
