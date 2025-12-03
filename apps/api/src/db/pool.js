import { Pool } from "pg";

const conn = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/appdb";

export const pool = new Pool({ connectionString: conn });
export async function query(text, params) { return pool.query(text, params); }
