import { Router } from "express"
import { getPlaces } from "../controllers/places.controller.js";



const router = Router({mergeParams:true})

router.get("/", getPlaces);

// router.post('/')

// router.put('/:poiId')

// router.delete('/:poiId')


export default router