import { supabaseRepo } from "../repositories/sqlRepo.js";
import { undo } from "../services/undo.js";

// Requests of visitors who want to manage a building.
// The only thing here that changes a role is approveOwnerRequest, and only we (super) can call it.

// What we show about the user who sent a request - never his password hash
function publicUser(user) {
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}

function newestFirst(a, b) {
  return b.id - a.id; // the id only grows, so a bigger id is a newer request
}

// POST /api/owner-requests  (any logged-in user)
export async function createOwnerRequest(req, res, next) {
  try {
    const { full_name, phone, building_name, building_type, city, message } = req.body;
    const userId = req.user.userId;

    // One open request for each user, so the list does not fill up with the same request
    const openRequest = await supabaseRepo.findOne("owner_requests", { user_id: userId, status: "new" });
    if (openRequest) {
      throw { status: 409, code: "REQUEST_EXISTS", message: "You already have an open request" };
    }

    // Optional fields only when they have a value
    const request = { user_id: userId, full_name, building_name, building_type, city, status: "new" };
    if (phone) request.phone = phone;
    if (message) request.message = message;

    const saved = await supabaseRepo.insertOne("owner_requests", request);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
}

// GET /api/owner-requests/mine  (any logged-in user) - his newest request, or null
export async function getMyOwnerRequest(req, res, next) {
  try {
    const requests = await supabaseRepo.findMany("owner_requests", { user_id: req.user.userId });
    requests.sort(newestFirst);
    res.json(requests[0] ?? null);
  } catch (error) {
    next(error);
  }
}

// GET /api/owner-requests  (super) - all the requests, each with the user who sent it
export async function getOwnerRequests(req, res, next) {
  try {
    const requests = await supabaseRepo.findMany("owner_requests");
    requests.sort(newestFirst);

    const users = await supabaseRepo.findMany("users");
    const usersById = new Map(users.map((user) => [user.id, user]));

    res.json(
      requests.map((request) => {
        const user = usersById.get(request.user_id);
        return { ...request, user: user ? publicUser(user) : null };
      })
    );
  } catch (error) {
    next(error);
  }
}

// PATCH /api/owner-requests/:requestId  { status }  (super)
export async function updateOwnerRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    const updated = await supabaseRepo.updateOne("owner_requests", { id: requestId }, { status });
    if (updated.length === 0) {
      throw { status: 404, code: "REQUEST_NOT_FOUND", message: "Request not found" };
    }

    res.json(updated[0]);
  } catch (error) {
    next(error);
  }
}

// POST /api/owner-requests/:requestId/approve  (super)
// Makes the user who sent the request a building manager, and marks the request as handled.
export async function approveOwnerRequest(req, res, next) {
  try {
    const { requestId } = req.params;

    const request = await supabaseRepo.findOne("owner_requests", { id: requestId });
    if (!request) {
      throw { status: 404, code: "REQUEST_NOT_FOUND", message: "Request not found" };
    }
    if (request.status !== "new") {
      throw { status: 409, code: "REQUEST_ALREADY_HANDLED", message: "This request was already handled" };
    }

    const user = await supabaseRepo.findOne("users", { id: request.user_id });
    if (!user) {
      throw { status: 404, code: "USER_NOT_FOUND", message: "User not found" };
    }

    // Only a visitor becomes a manager. An admin stays an admin, and a super is never lowered.
    const becomesAdmin = user.role === "visitor";
    if (becomesAdmin) {
      await supabaseRepo.updateOne("users", { id: user.id }, { role: "admin" });
    }

    let handled;
    try {
      handled = await supabaseRepo.updateOne("owner_requests", { id: requestId }, { status: "handled" });
    } catch (error) {
      if (becomesAdmin) {
        await undo("the new role of an approved user", () =>
          supabaseRepo.updateOne("users", { id: user.id }, { role: "visitor" })
        );
      }
      throw error;
    }

    res.json({ ...handled[0], user: publicUser({ ...user, role: becomesAdmin ? "admin" : user.role }) });
  } catch (error) {
    next(error);
  }
}
