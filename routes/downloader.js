const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '1e22132846msheff477ea24a4ce4p1890bejsnf1540c59823e';
const RAPIDAPI_HOST = 'social-download-all-in-one.p.rapidapi.com';
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: call RapidAPI to get media links
// ─────────────────────────────────────────────────────────────────────────────
function fetchMediaLinks(socialUrl) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      hostname: RAPIDAPI_HOST,
      path: '/v1/social/autolink',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { reject(new Error('Failed to parse API response')); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ url: socialUrl }));
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: detect platform from URL
// ─────────────────────────────────────────────────────────────────────────────
function detectPlatform(url) {
  if (/tiktok\.com/i.test(url)) return 'TikTok';
  if (/instagram\.com/i.test(url)) return 'Instagram';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube';
  if (/twitter\.com|x\.com/i.test(url)) return 'Twitter/X';
  if (/facebook\.com|fb\.com/i.test(url)) return 'Facebook';
  return 'Unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: stream a remote URL to disk, track progress
// ─────────────────────────────────────────────────────────────────────────────
function streamToDisk(mediaUrl, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const protocol = mediaUrl.startsWith('https') ? https : http;

    const doRequest = (url, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));
      protocol.get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          return doRequest(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} from media server`));
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress) onProgress(downloaded, total);
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => resolve({ downloaded, total }));
        fileStream.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    };

    doRequest(mediaUrl);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: guess extension from URL / content-type
// ─────────────────────────────────────────────────────────────────────────────
function guessExtension(mediaUrl) {
  const clean = mediaUrl.split('?')[0];
  const ext = path.extname(clean);
  if (['.mp4','.webm','.mov','.mkv','.mp3','.m4a'].includes(ext)) return ext;
  return '.mp4'; // safe default
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format bytes
// ─────────────────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /downloader — main form page
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.render('downloader/index', { error: null });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /downloader/fetch — step 1: get media options from RapidAPI
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fetch', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.render('downloader/index', { error: 'Please enter a URL.' });

  try {
    const apiResult = await fetchMediaLinks(url);

    if (apiResult.error) {
      return res.render('downloader/index', { error: `API Error: ${apiResult.error}` });
    }
    console.log('API Result:', apiResult);
    console.log('URL',url);
    res.render('downloader/select', {
      apiResult,
      originalUrl: url,
      platform: detectPlatform(url),
    });
    
  } catch (err) {
    res.render('downloader/index', { error: err.message });
  }
});


router.post('/downloader/save', (req, res) => {
  const { mediaUrl } = req.body;

  if (!mediaUrl) {
    return res.json({ error: "No URL provided" });
  }

  const fileName = uuidv4() + ".mp4";
  const filePath = path.join(__dirname, '../downloads', fileName);

  const file = fs.createWriteStream(filePath);

  https.get(mediaUrl, (response) => {
    response.pipe(file);

    file.on('finish', () => {
      file.close();
      res.json({ fileName });
    });
  }).on('error', (err) => {
    fs.unlink(filePath, () => {});
    res.json({ error: "Download failed" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /downloader/serve/:fileName — stream file to browser
// ─────────────────────────────────────────────────────────────────────────────
router.get('/downloader/serve/:fileName', (req, res) => {
  const filePath = path.join(__dirname, '../downloads', req.params.fileName);

  if (!fs.existsSync(filePath)) {
    return res.sendStatus(404);
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    const chunkSize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4"
    });

    file.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4"
    });

    fs.createReadStream(filePath).pipe(res);
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// DELETE /downloader/delete/:fileName — remove file from server
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/delete/:fileName', (req, res) => {
  const filePath = path.join(DOWNLOADS_DIR, path.basename(req.params.fileName));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    // Remove from jobs
    for (const [id, job] of Object.entries(jobs)) {
      if (job.fileName === req.params.fileName) delete jobs[id];
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
