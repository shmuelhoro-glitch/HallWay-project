import { supabaseRepo } from "../repositories/sqlRepo.js"

export async function getAllBuildings(req, res, next) {
    const {city, type} = req.query
    const data = await supabaseRepo.findMany("buildings", {city, type})
    res.send(data)
}


export async function getBuildingById(req, res, next) {
    const { buildingId } = req.params
    const data = await supabaseRepo.findOne("buildings", {id: buildingId})
    if (!data) {
        return res.status(404).send("empty")
    }
    res.send(data)
}