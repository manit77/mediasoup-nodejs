import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Paths
const srcPath = path.resolve('./package.json');
const distDir = path.resolve('./dist');
const distPkgPath = path.join(distDir, 'package.json');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Read and parse the original package.json
const pkgJson = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));

// Remove devDependencies
delete pkgJson.devDependencies;
delete pkgJson.scripts;
delete pkgJson.types;

pkgJson.main = "./index.js"

// Write the modified package.json to ./dist
fs.writeFileSync(distPkgPath, JSON.stringify(pkgJson, null, 2), 'utf-8');

console.log('✅ package.json copied to dist/ with devDependencies removed.');

// Run npm install --production inside ./dist
try {
  console.log('📦 Running npm install --production in dist/...');
  execSync('npm install --production', { cwd: distDir, stdio: 'inherit' });
  console.log('✅ npm install completed in dist/');
} catch (err) {
  console.error('❌ Failed to run npm install:', err.message);
  process.exit(1);
}
