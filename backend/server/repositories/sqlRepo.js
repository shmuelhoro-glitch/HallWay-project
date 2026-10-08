import {db} from "../db/sqlComfig.js"

function createSupabaseFactory(supabase) {
    return {
        async insertOne(table, newData) {
            const { data, error } = await supabase.from(table).insert(newData).select().single();
            if (error) throw error;
            return data; 
        },

        async insertMany(table, newData) {
            const { data, error } = await supabase.from(table).insert(newData).select();
            if (error) throw error;
            return data; 
        },

        async findOne(table, query) {
            const { data, error } = await supabase.from(table).select().match(query).single();
            if (error) throw error;
            return data;
        },

        async findMany(table, query = {}) {
            let request = supabase.from(table).select();
            if (Object.keys(query).length > 0) {
                request = request.match(query);
            }
            
            const { data, error } = await request;
            if (error) throw error;
            return data;
        },

        async updateOne(table, query, updateData) {
            const { data, error } = await supabase.from(table).update(updateData).match(query).select();
            if (error) throw error;
            return data;
        },

        async updateMany(table, query, updateData) {
            const { data, error } = await supabase.from(table).update(updateData).match(query).select();
            if (error) throw error;
            return data;
        },

        async deleteOne(table, query) {
            const { data, error } = await supabase.from(table).delete().match(query).select();
            if (error) throw error;
            return data;
        },

        async deleteMany(table, query) {
            const { data, error } = await supabase.from(table).delete().match(query).select();
            if (error) throw error;
            return data;
        }
    };
}

export const supabaseRepo = createSupabaseFactory(db)