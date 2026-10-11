import {db} from "../db/mongoConfig.js"

function createMongoFactory(db) {
    return {
        async insertOne(collection, newData) {
            const result = await db.collection(collection).insertOne(newData);
            return result.insertedId;
        },

        async insertMany(collection, newData) {
            const result = await db.collection(collection).insertMany(newData);
            return result.insertedCount;
        },

        async findOne(collection, query) {
            return await db.collection(collection).findOne(query);
        },

        async findMany(collection, query = {}) {
            return await db.collection(collection).find(query).toArray();
        },

        async updateOne(collection, query, updateData) {
            const result = await db.collection(collection).updateOne(query, updateData);
            return result.modifiedCount;
        },

        async updateMany(collection, query, updateData) {
            const result = await db.collection(collection).updateMany(query, updateData);
            return result.modifiedCount;
        },

        async deleteOne(collection, query) {
            const result = await db.collection(collection).deleteOne(query);
            return result.deletedCount;
        },

        async deleteMany(collection, query) {
            const result = await db.collection(collection).deleteMany(query);
            return result.deletedCount;
        }
    };
}

export const mongoRepo = createMongoFactory(db)