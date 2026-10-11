import "dotenv/config"
import  express from "express"
import cors from "cors"
import { errorHandler } from "./middleware/errorHandler.js"
import authRoutes from './routes/auth.routes.js';
import buildingsRoutes from './routes/buildings.routes.js';
import placesRoutes from './routes/places.routes.js';
import graphRoutes from './routes/graph.routes.js';
import qrRoutes from './routes/qr.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import chatRoutes from './routes/chat.routes.js';
import navigationRoutes from './routes/navigation.routes.js';
import alertsRoutes from './routes/alerts.routes.js';



const app = express()

app.use(express.json({limit: "5mb" }))
app.use(cors())

app.get("/test", (_req, res) => {
    res.send("hyy")
})

app.use('/api/auth', authRoutes);

app.use('/api/buildings', buildingsRoutes);

app.use('/api/buildings/:buildingId/places', placesRoutes);

app.use('/api/buildings/:buildingId/graph', graphRoutes);

app.use('/api/buildings/:buildingId/qr', qrRoutes);

app.use('/api/buildings/:buildingId/analytics', analyticsRoutes);

app.use('/api/buildings/:buildingId/chat', chatRoutes);

app.use('/api/navigation', navigationRoutes);

app.use('/api/alerts', alertsRoutes);

app.use(errorHandler)

app.listen(process.env.PORT, () => {
    console.log(`server is listening on port ${process.env.PORT}`)
})