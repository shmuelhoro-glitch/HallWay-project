import {MongoClient} from "mongodb"

const client = new MongoClient(process.env.MONGO_URI)

async function getConnection(){
    await client.connect()
    console.log("mongo connect")
    return client.db("in-routing")
} 

export const db = await getConnection()