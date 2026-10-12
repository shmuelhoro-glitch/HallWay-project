import { mock } from "node:test";
import { ObjectId } from "mongodb";

// Helpers for the tests. Nothing here touches a real database:
// the controllers get a fake mongoRepo that keeps everything in memory.

export const BUILDING_ID = "11111111-1111-4111-8111-111111111111";

// Puts fake repositories in the place of the real ones. Call it BEFORE importing a controller:
// the controllers import the repositories by themselves, and this way the real files
// (which connect to the database) never run.
export function useFakeRepos() {
  const mongoRepo = createFakeMongoRepo();
  const supabaseRepo = {
    async findOne(table, query) {
      return table === "buildings" && query.id === BUILDING_ID ? { id: BUILDING_ID } : null;
    },
  };

  mock.module(new URL("../repositories/mongoRepo.js", import.meta.url).href, { namedExports: { mongoRepo } });
  mock.module(new URL("../repositories/sqlRepo.js", import.meta.url).href, { namedExports: { supabaseRepo } });

  return { mongoRepo };
}

// Does a saved document match a query? Supports what the server really uses:
// plain values, ObjectId, $or and $regex. Anything else throws, so a test can't pass by mistake.
function matches(doc, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === "$or") {
      return expected.some((option) => matches(doc, option));
    }
    if (key.startsWith("$")) {
      throw new Error(`The fake repo does not support ${key}`);
    }

    const actual = doc[key];

    if (expected instanceof ObjectId) {
      return String(actual) === String(expected);
    }
    if (expected !== null && typeof expected === "object") {
      if (expected.$regex !== undefined) {
        return new RegExp(expected.$regex, expected.$options).test(actual ?? "");
      }
      throw new Error(`The fake repo does not support ${JSON.stringify(expected)}`);
    }
    return actual === expected;
  });
}

function applyUpdate(doc, update) {
  for (const [key, value] of Object.entries(update.$set ?? {})) {
    doc[key] = value;
  }
  for (const key of Object.keys(update.$unset ?? {})) {
    delete doc[key];
  }
}

// The same functions as repositories/mongoRepo.js, on arrays in memory.
// failOn("updateOne", "nodes") makes the next such call throw, like a database that went down.
export function createFakeMongoRepo() {
  const collections = new Map();
  const plannedFailures = [];

  function docsOf(collection) {
    if (!collections.has(collection)) {
      collections.set(collection, []);
    }
    return collections.get(collection);
  }

  function failIfPlanned(method, collection) {
    const index = plannedFailures.findIndex((item) => item.method === method && item.collection === collection);
    if (index !== -1) {
      plannedFailures.splice(index, 1);
      throw new Error(`Fake database failure: ${method} ${collection}`);
    }
  }

  return {
    async insertOne(collection, newData) {
      failIfPlanned("insertOne", collection);
      newData._id = newData._id ?? new ObjectId(); // the real driver adds _id to the object too
      docsOf(collection).push({ ...newData });
      return newData._id;
    },

    async findOne(collection, query) {
      failIfPlanned("findOne", collection);
      const doc = docsOf(collection).find((item) => matches(item, query));
      return doc ? { ...doc } : null;
    },

    async findMany(collection, query = {}) {
      failIfPlanned("findMany", collection);
      return docsOf(collection)
        .filter((item) => matches(item, query))
        .map((item) => ({ ...item }));
    },

    async updateOne(collection, query, updateData) {
      failIfPlanned("updateOne", collection);
      const doc = docsOf(collection).find((item) => matches(item, query));
      if (!doc) return 0;
      applyUpdate(doc, updateData);
      return 1;
    },

    async deleteOne(collection, query) {
      failIfPlanned("deleteOne", collection);
      const docs = docsOf(collection);
      const index = docs.findIndex((item) => matches(item, query));
      if (index === -1) return 0;
      docs.splice(index, 1);
      return 1;
    },

    async deleteMany(collection, query) {
      failIfPlanned("deleteMany", collection);
      const docs = docsOf(collection);
      const kept = docs.filter((item) => !matches(item, query));
      const deletedCount = docs.length - kept.length;
      collections.set(collection, kept);
      return deletedCount;
    },

    // ---------- Only for the tests ----------

    failOn(method, collection) {
      plannedFailures.push({ method, collection });
    },

    all(collection) {
      return docsOf(collection).map((item) => ({ ...item }));
    },

    reset() {
      collections.clear();
      plannedFailures.length = 0;
    },
  };
}

// Runs a controller like Express does, and returns what it answered.
// "error" is what the controller passed to next(), the way errors reach errorHandler.
export async function callController(controller, { params = {}, body = {}, query = {} } = {}) {
  const result = { status: 200, body: undefined, error: null };

  const req = { params, body, query, validatedQuery: query };
  const res = {
    status(code) {
      result.status = code;
      return res;
    },
    json(data) {
      result.body = data;
      return res;
    },
    end() {
      return res;
    },
  };

  await controller(req, res, (error) => {
    result.error = error ?? null;
  });

  return result;
}
