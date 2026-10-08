export const validateRequest = (schemas) => {
    return (req, res, next) => {
        
        if (schemas.body) {
            const result = schemas.body.safeParse(req.body);
            if (!result.success) {
                return res.status(400).json({
                    error: "Invalid request body",
                    details: result.error.flatten().fieldErrors
                });
            }
            req.body = result.data;
        }

        if (schemas.query) {
            const result = schemas.query.safeParse(req.query);
            if (!result.success) {
                return res.status(400).json({
                    error: "Invalid query parameters",
                    details: result.error.flatten().fieldErrors
                });
            }
            req.query = result.data; 
        }

        if (schemas.params) {
            const result = schemas.params.safeParse(req.params);
            if (!result.success) {
                return res.status(400).json({
                    error: "Invalid URL parameters",
                    details: result.error.flatten().fieldErrors
                });
            }
            req.params = result.data;
        }

        next();
    };
};