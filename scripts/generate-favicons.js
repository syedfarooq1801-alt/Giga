const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateFavicons() {
  const inputFile = path.join(__dirname, '..', 'assets', 'favicon.png');
  const outputDir = path.join(__dirname, '..', 'public');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate different sizes
  const sizes = [16, 32, 48, 72, 96, 144, 192, 256, 384, 512];
  
  try {
    // Copy original favicon to public directory
    fs.copyFileSync(inputFile, path.join(outputDir, 'favicon.png'));
    
    // Generate different sizes
    for (const size of sizes) {
      const outputFile = path.join(outputDir, `favicon-${size}x${size}.png`);
      await sharp(inputFile)
        .resize(size, size)
        .toFile(outputFile);
      console.log(`Generated ${outputFile}`);
    }
    
    console.log('Favicon generation complete!');
  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();
