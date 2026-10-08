import "dotenv/config"
import  express from "express"
import cors from "cors"
import { errorHandler } from "./src/middleware/errorHandler.js"

const app = express()

app.use(express.json())
app.use(cors())

app.get("/test", (req, res) => {
    res.send("hyy")
})

app.use(errorHandler)

app.listen(process.env.PORT, () => {
    console.log(`server is listening on port ${process.env.PORT}`)
})