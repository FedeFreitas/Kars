import { query } from "../db/pool.js";

export async function listLatestMovements(search) {
  const params = [];
  let where = "(c.status ILIKE 'dispon%' OR c.status ILIKE 'ativo%')";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (c.plate ILIKE $${params.length} OR COALESCE(c.model,'') ILIKE $${params.length} OR COALESCE(c.supplier,'') ILIKE $${params.length})`;
  }

  const { rows } = await query(
    `
    SELECT
      c.id AS car_id, c.plate, c.model, c.category, c.supplier, c.rate AS car_rate, c.status AS car_status,
      mv.id AS movement_id, mv.status AS movement_status, mv.km, mv.movement_date, mv.obs,
      mv.client_id, mv.client_rate, mv.is_reserve, mv.shop_id, mv.service_type, mv.service_eta,
      mv.tow_id, mv.yard_id, mv.yard_availability, mv.team_id, mv.author_id,
      u_client.name AS client_name, u_client.email AS client_email,
      cp.tarifa AS client_tariff,
      shop.name AS shop_name, tow.name AS tow_name, yard.name AS yard_name, team.name AS team_name
    FROM cars c
    LEFT JOIN LATERAL (
      SELECT m.*
      FROM car_movements m
      WHERE m.car_id = c.id
      ORDER BY m.movement_date DESC, m.created_at DESC
      LIMIT 1
    ) mv ON true
    LEFT JOIN users u_client ON u_client.id = mv.client_id
    LEFT JOIN client_profiles cp ON cp.user_id = mv.client_id
    LEFT JOIN car_options shop ON shop.id = mv.shop_id
    LEFT JOIN car_options tow ON tow.id = mv.tow_id
    LEFT JOIN car_options yard ON yard.id = mv.yard_id
    LEFT JOIN car_options team ON team.id = mv.team_id
    WHERE ${where}
    ORDER BY COALESCE(mv.movement_date, c.updated_at) DESC
    LIMIT 500
    `,
    params
  );
  return rows;
}

export async function listMovementsByCar(carId) {
  const { rows } = await query(
    `
    SELECT
      m.*,
      a.name AS author_name, a.email AS author_email,
      u_client.name AS client_name, u_client.email AS client_email,
      cp.tarifa AS client_tariff,
      shop.name AS shop_name, tow.name AS tow_name, yard.name AS yard_name, team.name AS team_name
    FROM car_movements m
    LEFT JOIN users a ON a.id = m.author_id
    LEFT JOIN users u_client ON u_client.id = m.client_id
    LEFT JOIN client_profiles cp ON cp.user_id = m.client_id
    LEFT JOIN car_options shop ON shop.id = m.shop_id
    LEFT JOIN car_options tow ON tow.id = m.tow_id
    LEFT JOIN car_options yard ON yard.id = m.yard_id
    LEFT JOIN car_options team ON team.id = m.team_id
    WHERE m.car_id = $1
    ORDER BY m.movement_date DESC, m.created_at DESC
    `,
    [carId]
  );
  return rows;
}

export async function getMovementById(id) {
  const { rows } = await query("SELECT * FROM car_movements WHERE id=$1", [id]);
  return rows[0] || null;
}

export async function insertMovement(data) {
  const keys = Object.keys(data);
  const cols = keys.join(",");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await query(
    `INSERT INTO car_movements (${cols}) VALUES (${placeholders})
     RETURNING *`,
    keys.map((k) => data[k])
  );
  return rows[0];
}

export async function updateMovement(id, data) {
  const keys = Object.keys(data);
  if (!keys.length) {
    return getMovementById(id);
  }
  const assignments = keys.map((k, i) => `${k}=$${i + 2}`);
  const params = [id, ...keys.map((k) => data[k])];
  const { rows } = await query(
    `UPDATE car_movements
     SET ${assignments.join(", ")}, updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    params
  );
  return rows[0] || null;
}

export async function insertMovementHistory(movementId, authorId, diff) {
  await query(
    `INSERT INTO car_movement_history (movement_id, author_id, diff)
     VALUES ($1,$2,$3)`,
    [movementId, authorId || null, diff || null]
  );
}

export async function listMovementHistory(movementId) {
  const { rows } = await query(
    `
    SELECT h.*, u.name AS author_name, u.email AS author_email
    FROM car_movement_history h
    LEFT JOIN users u ON u.id = h.author_id
    WHERE h.movement_id=$1
    ORDER BY h.created_at DESC
    `,
    [movementId]
  );
  return rows;
}
