// Decrypts a backup produced by GET /api/cron/backup.
//
// Usage:
//   BACKUP_ENCRYPTION_KEY=<the key from Vercel env vars> node scripts/decrypt-backup.js <downloaded-file.json.gz.enc> [output.json]
//
// Download the file first from the URL the backup endpoint returns (or from
// the Vercel Blob dashboard, under Storage), then run this locally.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const [, , inputPath, outputPath] = process.argv;

if (!inputPath) {
  console.error('Usage: BACKUP_ENCRYPTION_KEY=... node scripts/decrypt-backup.js <input.json.gz.enc> [output.json]');
  process.exit(1);
}

const secret = process.env.BACKUP_ENCRYPTION_KEY;
if (!secret) {
  console.error('Set BACKUP_ENCRYPTION_KEY to the same value configured in Vercel.');
  process.exit(1);
}

const key = crypto.createHash('sha256').update(secret).digest();
const data = fs.readFileSync(inputPath);

// Layout matches encryptBuffer() in server.js: [12-byte iv][16-byte auth tag][ciphertext]
const iv = data.subarray(0, 12);
const authTag = data.subarray(12, 28);
const ciphertext = data.subarray(28);

const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
const gz = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
const json = zlib.gunzipSync(gz).toString('utf8');

const out = outputPath || path.basename(inputPath).replace(/\.json\.gz\.enc$/, '') + '.json';
fs.writeFileSync(out, json);
console.log(`Decrypted backup written to ${out}`);
