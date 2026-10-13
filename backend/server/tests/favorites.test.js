import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { callController, useFakeRepos } from "./helpers.js";

process.env.JWT_SECRET = "test-secret";

const { supabaseRepo, mongoRepo, resetData } = useFakeRepos();

const { getFavorites, updateFavorites, register, login } = await import("../controllers/auth.controller.js");

let testUserId;

beforeEach(async () => {
  await resetData();
  mock.method(console, "error", () => {});
  const hashPassword = await bcrypt.hash("Password123", 10);
  const user = await supabaseRepo.insertOne("users", {
    username: "yair_user",
    email: "yair@example.com",
    hashPassword,
    role: "visitor",
    buildingIds: [],
    favorites: { buildings: [], places: [] },
  });
  testUserId = user.id;
});

test("getFavorites returns user favorites", async () => {
  const req = {
    user: { userId: testUserId },
  };

  const res = await callController(getFavorites, req);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.favorites, { buildings: [], places: [] });
});

test("updateFavorites saves new buildings and places to user", async () => {
  const sampleFavorites = {
    buildings: ["b1111111-1111-1111-1111-111111111111"],
    places: [
      {
        id: "p1",
        buildingId: "b1111111-1111-1111-1111-111111111111",
        name: "זארה",
        category: "אופנה",
        floor: 1,
      },
    ],
  };

  const req = {
    user: { userId: testUserId },
    body: { favorites: sampleFavorites },
  };

  const res = await callController(updateFavorites, req);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.favorites, sampleFavorites);

  // Check saved in DB
  const userInDb = await supabaseRepo.findOne("users", { id: testUserId });
  assert.deepEqual(userInDb.favorites, sampleFavorites);
});

test("login includes favorites in user response", async () => {
  // Update DB with a favorite building first
  await supabaseRepo.updateOne(
    "users",
    { id: testUserId },
    { favorites: { buildings: ["fav-b1"], places: [] } }
  );

  const res = await callController(login, {
    body: { email: "yair@example.com", password: "Password123" },
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.user);
  assert.deepEqual(res.body.user.favorites, { buildings: ["fav-b1"], places: [] });
});

test("register returns initial empty favorites", async () => {
  const res = await callController(register, {
    body: { username: "new_registered_user", email: "new@example.com", password: "NewPassword123" },
  });

  assert.equal(res.status, 201);
  assert.ok(res.body.user);
  assert.deepEqual(res.body.user.favorites, { buildings: [], places: [] });
});

test("a user that was saved before the favorites column existed has empty favorites", async () => {
  const old = await supabaseRepo.insertOne("users", { username: "old_user", email: "old@example.com", role: "visitor" });

  const res = await callController(getFavorites, { user: { userId: old.id } });

  assert.deepEqual(res.body.favorites, { buildings: [], places: [] });
});

test("when the favorites can't be saved the client gets the error, and nothing is saved anywhere else", async () => {
  supabaseRepo.failOn("updateOne", "users");

  const res = await callController(updateFavorites, {
    user: { userId: testUserId },
    body: { favorites: { buildings: ["b-1"], places: [] } },
  });

  assert.ok(res.error);
  assert.deepEqual(mongoRepo.all("user_favorites"), []);
  assert.deepEqual((await supabaseRepo.findOne("users", { id: testUserId })).favorites, { buildings: [], places: [] });
});

test("favorites that were emptied stay empty", async () => {
  const user = { userId: testUserId };
  await callController(updateFavorites, { user, body: { favorites: { buildings: ["b-1"], places: [] } } });
  await callController(updateFavorites, { user, body: { favorites: { buildings: [], places: [] } } });

  const res = await callController(getFavorites, { user });

  assert.deepEqual(res.body.favorites, { buildings: [], places: [] });
});

test("the favorites of a user that was deleted can't be saved", async () => {
  await supabaseRepo.deleteOne("users", { id: testUserId });

  const res = await callController(updateFavorites, {
    user: { userId: testUserId },
    body: { favorites: { buildings: [], places: [] } },
  });

  assert.equal(res.error.code, "USER_NOT_FOUND");
});
