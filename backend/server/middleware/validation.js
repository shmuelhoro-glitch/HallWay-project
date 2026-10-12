// Checks body / query / params with zod before the controller runs.
// A failure returns 400 in the same shape as every other error:
// { error: { code: "VALIDATION_ERROR", message, fields } }
// "fields" says which field failed and why, for example { name: ["Too short"] }.

function validationError(res, message, zodError) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      fields: zodError.flatten().fieldErrors,
    },
  });
}

export const validateRequest = (schemas) => {
  return (req, res, next) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        return validationError(res, "Invalid request body", result.error);
      }
      req.body = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        return validationError(res, "Invalid query parameters", result.error);
      }
      req.validatedQuery = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        return validationError(res, "Invalid URL parameters", result.error);
      }
      req.params = result.data;
    }

    next();
  };
};
