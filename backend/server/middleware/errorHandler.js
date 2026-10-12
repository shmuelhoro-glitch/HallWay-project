


export function errorHandler(err, req, res, next) {
  if (!err.status) {
    console.error(err);
    return res.status(500).json({ error: { code: "SERVER_ERROR", message: "Internal server error" } });
  }

  res.status(err.status).json({ error: { code: err.code || "ERROR", message: err.message } });
}