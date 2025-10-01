#!/usr/bin/env node

/**
 * Convert images to WebP format
 * Usage: node scripts/convert-to-webp.js <input-file> [output-file] [quality]
 * 
 * This script uses sharp library (will install if needed)
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📦 Installing sharp library...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const { execSync } = require('child_process');
    try {
        execSync('pnpm add -D sharp', { stdio: 'inherit' });
        sharp = require('sharp');
        console.log('\n✓ Sharp library installed successfully!\n');
    } catch (installError) {
        console.error('✗ Failed to install sharp library');
        console.error('  Please run: pnpm add -D sharp');
        process.exit(1);
    }
}

async function convertToWebP(inputPath, outputPath = null, quality = 85) {
    try {
        // Validate input file exists
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
        }

        // Generate output path if not provided
        if (!outputPath) {
            const dir = path.dirname(inputPath);
            const name = path.basename(inputPath, path.extname(inputPath));
            outputPath = path.join(dir, `${name}.webp`);
        }

        // Get input file size
        const inputStats = fs.statSync(inputPath);
        const inputSizeKB = (inputStats.size / 1024).toFixed(2);

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  🖼️  Converting: ${path.basename(inputPath)}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        console.log(`  Input size: ${inputSizeKB} KB`);

        // Convert to WebP
        await sharp(inputPath)
            .webp({ quality: quality, effort: 6 })
            .toFile(outputPath);

        // Get output file size
        const outputStats = fs.statSync(outputPath);
        const outputSizeKB = (outputStats.size / 1024).toFixed(2);
        const savings = ((1 - (outputStats.size / inputStats.size)) * 100).toFixed(1);

        console.log(`  ✓ Output: ${path.basename(outputPath)}`);
        console.log(`  ✓ Output size: ${outputSizeKB} KB`);
        console.log(`  ✓ Savings: ${savings}%`);
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  ✨ Conversion Successful!`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        return {
            inputPath,
            outputPath,
            inputSize: inputStats.size,
            outputSize: outputStats.size,
            savings: parseFloat(savings)
        };
    } catch (error) {
        console.error(`\n✗ Error: ${error.message}\n`);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  WebP Image Converter');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('Usage:');
        console.log('  node scripts/convert-to-webp.js <input-file> [output-file] [quality]\n');
        console.log('Examples:');
        console.log('  node scripts/convert-to-webp.js image.png');
        console.log('  node scripts/convert-to-webp.js image.png image.webp');
        console.log('  node scripts/convert-to-webp.js image.png image.webp 90\n');
        console.log('Default quality: 85 (range: 0-100)\n');
        process.exit(1);
    }

    const [inputPath, outputPath, quality] = args;
    const qualityValue = quality ? parseInt(quality) : 85;

    convertToWebP(inputPath, outputPath, qualityValue)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { convertToWebP };

