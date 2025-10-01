/**
 * Next.js API Route for Converting Images to WebP
 * 
 * Endpoint: POST /api/convert-to-webp
 * 
 * Usage:
 *   - Send image file via multipart/form-data
 *   - Returns WebP image or JSON with error
 * 
 * Example with fetch:
 *   const formData = new FormData();
 *   formData.append('image', file);
 *   formData.append('quality', 85); // optional
 *   
 *   const response = await fetch('/api/convert-to-webp', {
 *     method: 'POST',
 *     body: formData
 *   });
 */

import formidable from 'formidable';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, we'll use formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  try {
    // Parse the multipart form data
    const form = formidable({ multiples: false });
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Get the uploaded image
    const imageFile = files.image?.[0] || files.image;
    
    if (!imageFile) {
      return res.status(400).json({ 
        error: 'No image provided',
        message: 'Please upload an image file'
      });
    }

    // Get quality parameter (default: 85)
    const quality = parseInt(fields.quality?.[0] || fields.quality || '85', 10);
    
    if (quality < 0 || quality > 100) {
      return res.status(400).json({ 
        error: 'Invalid quality',
        message: 'Quality must be between 0 and 100'
      });
    }

    // Read the uploaded file
    const inputBuffer = fs.readFileSync(imageFile.filepath);
    
    // Get original file size
    const originalSize = inputBuffer.length;

    // Convert to WebP
    const webpBuffer = await sharp(inputBuffer)
      .webp({ 
        quality: quality,
        effort: 6 // 0-6, higher = better compression but slower
      })
      .toBuffer();

    // Calculate savings
    const webpSize = webpBuffer.length;
    const savings = ((1 - (webpSize / originalSize)) * 100).toFixed(1);

    // Clean up uploaded file
    fs.unlinkSync(imageFile.filepath);

    // Get original filename
    const originalName = imageFile.originalFilename || 'image';
    const nameWithoutExt = path.basename(originalName, path.extname(originalName));

    // Set response headers
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Disposition', `attachment; filename="${nameWithoutExt}.webp"`);
    res.setHeader('X-Original-Size', originalSize.toString());
    res.setHeader('X-WebP-Size', webpSize.toString());
    res.setHeader('X-Savings-Percent', savings);

    // Send the WebP image
    return res.status(200).send(webpBuffer);

  } catch (error) {
    console.error('Error converting image:', error);
    
    return res.status(500).json({ 
      error: 'Conversion failed',
      message: error.message 
    });
  }
}

