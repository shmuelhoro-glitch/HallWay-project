import { supabaseRepo } from "../repositories/sqlRepo.js";

// Requests of visitors who want to manage a building.
// Nothing here changes a role: approving a request is done by hand, in the users table.

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

    // Only what is needed to find the user in the users table - never his password hash
    const users = await supabaseRepo.findMany("users");
    const usersById = new Map(users.map((user) => [user.id, user]));

    res.json(
      requests.map((request) => {
        const user = usersById.get(request.user_id);
        return {
          ...request,
          user: user ? { id: user.id, username: user.username, email: user.email, role: user.role } : null,
        };
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
