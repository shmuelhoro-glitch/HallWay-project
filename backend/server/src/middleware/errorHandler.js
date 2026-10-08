


export async function errorHandler(err, req, res, next) {
    const message = err.message || "internal server error"
    const status = err.status || 500
    res.status(status).send(message)
}