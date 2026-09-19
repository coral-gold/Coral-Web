#!/usr/bin/env node
/* Aggregates every content/products/*.json file (one per product, edited
   via the admin panel) into a single content/products.json the static
   site fetches at runtime. Run manually with `node scripts/build-catalog.js`
   or automatically by .github/workflows/build-catalog.yml on every push
   that touches content/products/**. */

const fs = require("fs");
const path = require("path");

const productsDir = path.join(__dirname, "..", "content", "products");
const outFile = path.join(__dirname, "..", "content", "products.json");

const files = fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"));

const products = files.map((file) => {
  const raw = fs.readFileSync(path.join(productsDir, file), "utf8");
  const data = JSON.parse(raw);
  return Object.assign({ slug: file.replace(/\.json$/, "") }, data);
});

products.sort((a, b) => (a.order || 0) - (b.order || 0));

fs.writeFileSync(outFile, JSON.stringify(products, null, 2) + "\n");
console.log(`Wrote ${products.length} products to ${path.relative(process.cwd(), outFile)}`);
