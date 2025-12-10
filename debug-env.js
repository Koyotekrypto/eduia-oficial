
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

console.log("--- DEBUG ENV VARS (FS) ---");
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) {
            console.log(`${key.trim()}: ${val.trim().substring(0, 10)}... (Length: ${val.trim().length})`);
        }
    });
} else {
    console.log(".env file NOT FOUND at", envPath);
}
console.log("--- END DEBUG ---");
