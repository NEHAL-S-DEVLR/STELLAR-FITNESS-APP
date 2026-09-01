// Exports the production database to a local Excel file, one sheet per
// table. Meant to run on a schedule from this laptop (see setup-mac-schedule.md)
// rather than from Vercel — Vercel has no way to write a file onto your
// machine, so this has to run locally.
//
// Only actually re-exports if 20+ days have passed since the last run (a
// marker file next to the output tracks this), so it's safe to fire this
// more often than every 20 days without doing extra work.
//
// Usage:
//   DATABASE_URL=<production connection string> node scripts/export-to-excel.js [output-path]

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env.production') });

const { Pool } = require('pg');
const ExcelJS = require('exceljs');

const EXPORT_INTERVAL_MS = 20 * 24 * 60 * 60 * 1000;
const outputPath = process.argv[2] || path.join(require('os').homedir(), 'Documents', 'Stellar Fitness Club', 'gym-data.xlsx');
const markerPath = outputPath + '.last-export';

async function main() {
  if (fs.existsSync(markerPath)) {
    const last = new Date(fs.readFileSync(markerPath, 'utf8').trim()).getTime();
    if (Date.now() - last < EXPORT_INTERVAL_MS) {
      console.log(`Skipping — last export was ${new Date(last).toISOString()}, not due for 20 days yet.`);
      return;
    }
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('Set DATABASE_URL (the production connection string) in backend/scripts/.env.production');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const { rows: tables } = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);

  const workbook = new ExcelJS.Workbook();
  for (const { tablename } of tables) {
    const { rows } = await pool.query(`SELECT * FROM "${tablename}"`);
    const sheet = workbook.addWorksheet(tablename.slice(0, 31));
    if (rows.length > 0) {
      sheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key, width: 18 }));
      sheet.addRows(rows);
      sheet.getRow(1).font = { bold: true };
    }
  }
  await pool.end();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  fs.writeFileSync(markerPath, new Date().toISOString());
  console.log(`Wrote ${tables.length} sheets to ${outputPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
