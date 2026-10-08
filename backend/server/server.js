import "dotenv/config"
import  express from "express"
import cors from "cors"
import { errorHandler } from "./src/middleware/errorHandler.js"
import authRoutes from './src/routes/auth.routes.js';
import buildingsRoutes from './src/routes/buildings.routes.js';
import placesRoutes from './src/routes/places.routes.js';
import graphRoutes from './src/routes/graph.routes.js';
import qrRoutes from './src/routes/qr.routes.js';
import analyticsRoutes from './src/routes/analytics.routes.js';
import chatRoutes from './src/routes/chat.routes.js';
import navigationRoutes from './src/routes/navigation.routes.js';
import alertsRoutes from './src/routes/alerts.routes.js';



const app = express()

app.use(express.json())
app.use(cors())

app.get("/test", (req, res) => {
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