/**
 * Image Signal Extractor Module
 * Extracts basic heuristic signals from an uploaded image.
 *
 * NO AI is used — only file metadata and basic heuristics.
 *
 * Extracts:
 *  - File name
 *  - File size (bytes, human-readable)
 *  - Image dimensions (from buffer header parsing)
 *  - MIME type
 *  - Basic heuristic signals (placeholder for future expansion)
 */

const fs = require('fs');
const path = require('path');

/**
 * Parses image dimensions from file buffer header.
 * Supports PNG, JPEG, GIF, WebP, BMP.
 */
function parseImageDimensions(buffer) {
  try {
    // PNG: bytes 16-23 contain width and height as 4-byte big-endian
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, format: 'PNG' };
    }

    // JPEG: scan for SOF markers
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) { offset++; continue; }
        const marker = buffer[offset + 1];
        // SOF0, SOF1, SOF2
        if (marker >= 0xc0 && marker <= 0xc3 && marker !== 0xc1) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height, format: 'JPEG' };
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
      return { width: null, height: null, format: 'JPEG' };
    }

    // GIF: bytes 6-9
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height, format: 'GIF' };
    }

    // WebP: RIFF header
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      // VP8 lossy
      if (buffer.toString('ascii', 12, 16) === 'VP8 ') {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height, format: 'WebP' };
      }
      return { width: null, height: null, format: 'WebP' };
    }

    // BMP: bytes 18-25
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      const width = buffer.readInt32LE(18);
      const height = Math.abs(buffer.readInt32LE(22));
      return { width, height, format: 'BMP' };
    }

    return { width: null, height: null, format: 'Unknown' };
  } catch {
    return { width: null, height: null, format: 'Unknown' };
  }
}

/**
 * Formats bytes to human-readable size string.
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generates basic heuristic signals from file metadata.
 * Placeholder for future AI/ML expansion.
 */
function generateHeuristicSignals(fileName, fileSize, dimensions) {
  const signals = [];
  const nameLower = fileName.toLowerCase();

  // File name based heuristics
  if (nameLower.includes('login') || nameLower.includes('giris')) {
    signals.push({ type: 'filename_hint', signal: 'login_screen', confidence: 0.6 });
  }
  if (nameLower.includes('error') || nameLower.includes('hata')) {
    signals.push({ type: 'filename_hint', signal: 'error_screen', confidence: 0.6 });
  }
  if (nameLower.includes('form') || nameLower.includes('register') || nameLower.includes('kayit')) {
    signals.push({ type: 'filename_hint', signal: 'form_screen', confidence: 0.6 });
  }
  if (nameLower.includes('dashboard') || nameLower.includes('panel')) {
    signals.push({ type: 'filename_hint', signal: 'dashboard_screen', confidence: 0.5 });
  }
  if (nameLower.includes('payment') || nameLower.includes('odeme') || nameLower.includes('checkout')) {
    signals.push({ type: 'filename_hint', signal: 'payment_screen', confidence: 0.6 });
  }
  if (nameLower.includes('cart') || nameLower.includes('sepet')) {
    signals.push({ type: 'filename_hint', signal: 'cart_screen', confidence: 0.6 });
  }
  if (nameLower.includes('search') || nameLower.includes('arama')) {
    signals.push({ type: 'filename_hint', signal: 'search_screen', confidence: 0.5 });
  }
  if (nameLower.includes('profile') || nameLower.includes('profil')) {
    signals.push({ type: 'filename_hint', signal: 'profile_screen', confidence: 0.5 });
  }
  if (nameLower.includes('mobile') || nameLower.includes('mobil')) {
    signals.push({ type: 'filename_hint', signal: 'mobile_view', confidence: 0.5 });
  }
  if (nameLower.includes('screenshot') || nameLower.includes('ekran')) {
    signals.push({ type: 'filename_hint', signal: 'screenshot', confidence: 0.7 });
  }

  // Size based heuristics
  if (fileSize > 5 * 1024 * 1024) {
    signals.push({ type: 'size_hint', signal: 'large_image', confidence: 0.4 });
  }
  if (fileSize < 10 * 1024) {
    signals.push({ type: 'size_hint', signal: 'small_image_possibly_icon', confidence: 0.3 });
  }

  // Dimension based heuristics
  if (dimensions.width && dimensions.height) {
    const ratio = dimensions.width / dimensions.height;
    if (ratio > 1.5 && ratio < 2.0) {
      signals.push({ type: 'dimension_hint', signal: 'landscape_widescreen', confidence: 0.5 });
    }
    if (ratio > 0.4 && ratio < 0.7) {
      signals.push({ type: 'dimension_hint', signal: 'portrait_mobile', confidence: 0.6 });
    }
    if (Math.abs(ratio - 1) < 0.1) {
      signals.push({ type: 'dimension_hint', signal: 'square_possibly_icon', confidence: 0.4 });
    }
    if (dimensions.width >= 1920) {
      signals.push({ type: 'dimension_hint', signal: 'full_hd_screenshot', confidence: 0.5 });
    }
  }

  // If no signals found, add a generic one
  if (signals.length === 0) {
    signals.push({ type: 'generic', signal: 'unclassified_image', confidence: 0.1 });
  }

  return signals;
}

/**
 * Extracts signals from an uploaded image file.
 *
 * @param {string} filePath - Absolute or relative path to the image file
 * @param {string} originalName - Original file name from upload
 * @returns {object} Structured image signal data
 */
function extractImageSignals(filePath, originalName) {
  try {
    console.log(`[ImageSignalExtractor] Processing: ${originalName}`);

    if (!fs.existsSync(filePath)) {
      console.error(`[ImageSignalExtractor] File not found: ${filePath}`);
      return {
        fileName: originalName,
        error: 'File not found',
        signals: [],
      };
    }

    const stats = fs.statSync(filePath);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(originalName).toLowerCase();
    const dimensions = parseImageDimensions(buffer);

    const result = {
      fileName: originalName,
      filePath: path.basename(filePath),
      extension: ext,
      mimeType: getMimeType(ext),
      fileSize: {
        bytes: stats.size,
        readable: formatFileSize(stats.size),
      },
      dimensions: {
        width: dimensions.width,
        height: dimensions.height,
        format: dimensions.format,
      },
      extractedAt: new Date().toISOString(),
      signals: generateHeuristicSignals(originalName, stats.size, dimensions),
    };

    console.log(`[ImageSignalExtractor] Signals:\n${JSON.stringify(result, null, 2)}`);

    return result;
  } catch (error) {
    console.error(`[ImageSignalExtractor] Error:`, error.message);
    return {
      fileName: originalName,
      error: error.message,
      signals: [],
    };
  }
}

/**
 * Returns MIME type for common image extensions.
 */
function getMimeType(ext) {
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

module.exports = { extractImageSignals };

