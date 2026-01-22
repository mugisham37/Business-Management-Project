#!/usr/bin/env node

/**
 * Build validation script
 * Ensures all required configurations are in place before building
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'src/types/core.ts',
  'src/lib/config/env.ts',
  'codegen.ts',
  '.env.local',
];

const requiredDirs = [
  'src/lib',
  'src/types',
  'src/components',
  'src/modules',
  'src/hooks',
  'src/graphql',
];

function checkFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Required file missing: ${filePath}`);
    return false;
  }
  console.log(`✅ Found: ${filePath}`);
  return true;
}

function checkDirectory(dirPath) {
  const fullPath = path.join(process.cwd(), dirPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Required directory missing: ${dirPath}`);
    return false;
  }
  console.log(`✅ Found: ${dirPath}/`);
  return true;
}

function main() {
  console.log('🔍 Checking build requirements...\n');
  
  let allValid = true;
  
  // Check required files
  console.log('📄 Checking required files:');
  for (const file of requiredFiles) {
    if (!checkFile(file)) {
      allValid = false;
    }
  }
  
  console.log('\n📁 Checking required directories:');
  for (const dir of requiredDirs) {
    if (!checkDirectory(dir)) {
      allValid = false;
    }
  }
  
  console.log('\n📦 Checking package.json scripts:');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = ['build', 'dev', 'lint', 'test', 'codegen'];
  
  for (const script of requiredScripts) {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`✅ Script: ${script}`);
    } else {
      console.error(`❌ Missing script: ${script}`);
      allValid = false;
    }
  }
  
  if (allValid) {
    console.log('\n🎉 All build requirements satisfied!');
    process.exit(0);
  } else {
    console.log('\n💥 Build requirements not met. Please fix the issues above.');
    process.exit(1);
  }
}

main();