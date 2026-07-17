const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

try {
  const dimensions = sizeOf(path.join(__dirname, '..', 'assets', 'favicon.png'));
  console.log(`Favicon dimensions: ${dimensions.width}x${dimensions.height}`);
} catch (error) {
  console.error('Error reading favicon:', error.message);
}
