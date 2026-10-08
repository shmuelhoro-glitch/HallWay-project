import { createClient } from '@supabase/supabase-js'

function getConnection(){
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    console.log("sql connect")
    return db
}

export const supabase = getConnection()