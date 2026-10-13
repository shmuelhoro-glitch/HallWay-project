import { mock } from "node:test";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

// Helpers for the tests. Nothing here touches a real database:
// the controllers get fake repositories that keep everything in memory.

export const BUILDING_ID = "11111111-1111-4111-8111-111111111111";

// Puts fake repositories in the place of the real ones. Call it BEFORE importing a controller:
// the controllers import the repositories by themselves, and this way the real files
// (which connect to the databases) never run.
export function useFakeRepos() {
  const mongoRepo = createFakeMongoRepo();
  const supabaseRepo = createFakeSupabaseRepo();

  mock.module(new URL("../repositories/mongoRepo.js", import.meta.url).href, { namedExports: { mongoRepo } });
  mock.module(new URL("../repositories/sqlRepo.js", import.meta.url).href, { namedExports: { supabaseRepo } });

  // Empty databases with one building in them. Call it before every test.
  async function resetData() {
    mongoRepo.reset();
    supabaseRepo.reset();
    await supabaseRepo.insertOne("buildings", { id: BUILDING_ID, name: "Sea Mall" });
  }

  return { mongoRepo, supabaseRepo, resetData };
}

// The same functions as repositories/sqlRepo.js, on arrays in memory.
// A query matches like supabase's match(): equal values, and a value that was not sent is skipped.
export function createFakeSupabaseRepo() {
  const tables = new Map();
  const plannedFailures = [];

  // In the real database these tables number their rows (1, 2, 3...). The others use a uuid.
  const numberedTables = ["owner_requests", "route_requests", "alerts", "chat_bans"];
  let lastNumber = 0;

  function rowsOf(table) {
    if (!tables.has(table)) {
      tables.set(table, []);
    }
    return tables.get(table);
  }

  function matchesRow(row, query) {
    return Object.entries(query).every(([key, value]) => value === undefined || row[key] === value);
  }

  function failIfPlanned(method, table) {
    const index = plannedFailures.findIndex((item) => item.method === method && item.table === table);
    if (index !== -1) {
      plannedFailures.splice(index, 1);
      throw new Error(`Fake database failure: ${method} ${table}`);
    }
  }

  return {
    async insertOne(table, newData) {
      failIfPlanned("insertOne", table);
      const id = numberedTables.includes(table) ? ++lastNumber : randomUUID();
      const row = { id, ...newData };
      rowsOf(table).push(row);
      return { ...row };
    },

    async findOne(table, query) {
      failIfPlanned("findOne", table);
      const row = rowsOf(table).find((item) => matchesRow(item, query));
      return row ? { ...row } : null;
    },

    async findMany(table, query = {}) {
      failIfPlanned("findMany", table);
      return rowsOf(table)
        .filter((item) => matchesRow(item, query))
        .map((item) => ({ ...item }));
    },

    async updateOne(table, query, updateData) {
      failIfPlanned("updateOne", table);
      const rows = rowsOf(table).filter((item) => matchesRow(item, query));
      rows.forEach((row) => Object.assign(row, updateData));
      return rows.map((row) => ({ ...row }));
    },

    async deleteOne(table, query) {
      failIfPlanned("deleteOne", table);
      const rows = rowsOf(table);
      const deleted = rows.filter((item) => matchesRow(item, query));
      tables.set(table, rows.filter((item) => !matchesRow(item, query)));
      return deleted;
    },

    // ---------- Only for the tests ----------

    failOn(method, table) {
      plannedFailures.push({ method, table });
    },

    all(table) {
      return rowsOf(table).map((item) => ({ ...item }));
    },

    reset() {
      tables.clear();
      plannedFailures.length = 0;
      lastNumber = 0;
    },
  };
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

    async insertMany(collection, newData) {
      failIfPlanned("insertMany", collection);
      for (const doc of newData) {
        doc._id = doc._id ?? new ObjectId();
        docsOf(collection).push({ ...doc });
      }
      return newData.length;
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
export async function callController(controller, { params = {}, body = {}, query = {}, user = null } = {}) {
  const result = { status: 200, body: undefined, error: null };

  const req = { params, body, query, validatedQuery: query, user };
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
