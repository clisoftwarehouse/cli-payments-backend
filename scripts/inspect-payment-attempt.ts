/**
 * Lee el último intento de Sitef para un payment dado y muestra raw_request/raw_response.
 * Útil cuando un pago falla con failureCode/Message null y queremos saber por qué.
 *
 * Uso: PAYMENT_ID=<uuid> npx tsx scripts/inspect-payment-attempt.ts
 */
import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const paymentId = process.env.PAYMENT_ID ?? process.argv[2];
  if (!paymentId) {
    console.error('Pasa PAYMENT_ID via env o arg.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const result = await client.query(
      `SELECT id, status, failure_code, failure_message, raw_request, raw_response, "createdAt"
       FROM payment_attempt
       WHERE payment_id = $1
       ORDER BY "createdAt" ASC`,
      [paymentId],
    );
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
