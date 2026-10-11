


export async function errorHandler(err, _req, res, _next) {
    console.log(err.status)
    const message = err.message || "internal server error"
    const status = err.status || 500
    res.status(status).send(message)
}