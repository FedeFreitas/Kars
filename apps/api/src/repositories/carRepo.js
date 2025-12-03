import { query } from "../db/pool.js";

const selectCar = `
  id, plate, category, renavam, model, year_fabrication, year_model, supplier,
  fuel, tracker, spare_key, color, status, displacement, version, rate, notes, image_url,
  created_at, updated_at
`;

export async function listCars({ search }) {
  const params = [];
  let where = "WHERE 1=1";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (
      plate ILIKE $1 OR COALESCE(model,'') ILIKE $1 OR COALESCE(category,'') ILIKE $1 OR COALESCE(renavam,'') ILIKE $1
    )`;
  }
  const { rows } = await query(
    `SELECT ${selectCar} FROM cars ${where} ORDER BY updated_at DESC LIMIT 500`,
    params
  );
  return rows;
}

export async function getCarById(id) {
  const { rows } = await query(`SELECT ${selectCar} FROM cars WHERE id=$1`, [id]);
  return rows[0] || null;
}

export async function insertCar(data) {
  const keys = Object.keys(data);
  const cols = keys.join(",");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await query(
    `INSERT INTO cars (${cols}) VALUES (${placeholders}) RETURNING ${selectCar}`,
    keys.map((k) => data[k])
  );
  return rows[0];
}

export async function updateCar(id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return getCarById(id);
  const assignments = keys.map((k, i) => `${k}=$${i + 2}`);
  const params = [id, ...keys.map((k) => data[k])];
  const { rows } = await query(
    `UPDATE cars SET ${assignments.join(",")}, updated_at=NOW() WHERE id=$1 RETURNING ${selectCar}`,
    params
  );
  return rows[0] || null;
}

export async function insertCarHistory(carId, authorId, diff) {
  await query(
    "INSERT INTO car_history (car_id, author_id, diff) VALUES ($1,$2,$3)",
    [carId, authorId || null, diff || null]
  );
}

export async function listCarHistory(carId, limit = 100) {
  const { rows } = await query(
    `SELECT h.id, h.car_id, h.author_id, h.diff, h.created_at,
            u.name AS author_name, u.email AS author_email
     FROM car_history h
     LEFT JOIN users u ON u.id = h.author_id
     WHERE h.car_id=$1
     ORDER BY h.created_at DESC
     LIMIT $2`,
    [carId, limit]
  );
  return rows;
}

export async function listCarOptions(kind, includeInactive = false) {
  const params = [];
  let where = "WHERE 1=1";
  if (kind) {
    params.push(kind);
    where += ` AND kind=$${params.length}`;
  }
  if (!includeInactive) {
    where += ` AND active = true`;
  }
  const { rows } = await query(
    `SELECT id, kind, name, amount, active, created_at FROM car_options ${where} ORDER BY name ASC`,
    params
  );
  return rows;
}

export async function createCarOption(kind, name, amount) {
  const { rows } = await query(
    `INSERT INTO car_options (kind, name, amount)
     VALUES ($1,$2,$3)
     ON CONFLICT (kind, name) DO UPDATE SET amount=EXCLUDED.amount, active=true, created_at=car_options.created_at
     RETURNING id, kind, name, amount, active, created_at`,
    [kind, name, amount ?? null]
  );
  return rows[0];
}

export async function updateCarOptionRepo(id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return null;
  const assignments = keys.map((k, i) => `${k}=$${i + 2}`);
  const params = [id, ...keys.map((k) => data[k])];
  const { rows } = await query(
    `UPDATE car_options SET ${assignments.join(", ")}, created_at=created_at WHERE id=$1 RETURNING id, kind, name, amount, active, created_at`,
    params
  );
  return rows[0] || null;
}

export async function findCarsByImage(imagePath) {
  if (!imagePath) return [];
  const { rows } = await query(
    `SELECT id, plate, model, image_url FROM cars WHERE image_url = $1`,
    [imagePath]
  );
  return rows;
}
