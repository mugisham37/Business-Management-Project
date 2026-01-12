#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const files = [
  'src/modules/analytics/services/data-warehouse.service.ts',
  'src/modules/analytics/services/etl.service.ts',
  'src/modules/analytics/services/comparative-analysis.service.ts',
  'src/modules/analytics/services/custom-reporting.service.ts',
  'src/modules/analytics/services/metrics-calculation.service.ts',
  'src/modules/analytics/services/mobile-analytics.service.ts',
  'src/modules/analytics/services/predictive-analytics.service.ts',
];

function replaceDrizzleExecute(content) {
  // Replace await this.drizzle.execute with await this.drizzle.getDb().execute
  return content.replace(/await this\.drizzle\.execute\(/g, 'await this.drizzle.getDb().execute(');
}

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = replaceDrizzleExecute(content);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Updated ${file}`);
  } else {
    console.log(`✗ File not found: ${file}`);
  }
});

console.log('Done!');
