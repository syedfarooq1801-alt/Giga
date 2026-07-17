const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createLargeFavicon() {
  try {
    const inputFile = path.join(__dirname, '..', 'assets', 'favicon.png');
    const outputFile = path.join(__dirname, '..', 'public', 'favicon-512x512.png');
    
    // Ensure public directory exists
    if (!fs.existsSync(path.dirname(outputFile))) {
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    }
    
    // Create a larger version of the favicon
    await sharp(inputFile)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }  // Transparent background
      })
      .toFile(outputFile);
    
    console.log(`Created large favicon at: ${outputFile}`);
    
    // Also create a copy as favicon.ico
    const icoOutput = path.join(__dirname, '..', 'public', 'favicon.ico');
    await sharp(inputFile)
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(icoOutput);
    
    console.log(`Created favicon.ico at: ${icoOutput}`);
    
  } catch (error) {
    console.error('Error creating large favicon:', error);
    process.exit(1);
  }
}

createLargeFavicon();
