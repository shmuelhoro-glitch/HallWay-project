// Every error reaches the client in the same shape: { error: { code, message } }.
//
// An error we threw on purpose comes with a status, for example:
//   throw { status: 404, code: "PLACE_NOT_FOUND", message: "Place not found" }
// Anything else is a bug: the client gets a general 500, and we see the details in the log.
//
// Express knows this is the error handler because it has 4 parameters, so "next" must stay.
export function errorHandler(err, req, res, next) {
  if (!err.status) {
    console.error(err);
    return res.status(500).json({ error: { code: "SERVER_ERROR", message: "Internal server error" } });
  }

  res.status(err.status).json({ error: { code: err.code || "ERROR", message: err.message } });
}
