const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('https');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '1e22132846msheff477ea24a4ce4p1890bejsnf1540c59823e';
const RAPIDAPI_HOST = 'social-media-video-downloader.p.rapidapi.com';

// Helper: make RapidAPI request
function rapidRequest(url) {
  return new Promise((resolve, reject) => {

    const options = {
      method: 'POST',
      hostname: 'social-download-all-in-one.p.rapidapi.com',
      path: '/v1/social/autolink',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'social-download-all-in-one.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));

      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve(data); // ✅ CRITICAL
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);

    // ✅ Use dynamic URL
    req.write(JSON.stringify({ url }));

    req.end();
  });
}
// ── HOME ────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.render('index');
});

// ── AUTOLINK (universal) ─────────────────────────────────────────────────
router.get('/autolink', (req, res) => {
  res.render('social/autolink', { result: null, error: null, url: '' });
});
router.post('/autolink', async (req, res) => {
  const { url } = req.body;

  try {
    const result = await rapidRequest(url);

    console.log(result);

    res.render('social/autolink', {
      result,
      error: null,
      url
    });

  } catch (err) {
    res.render('social/autolink', {
      result: null,
      error: err.message,
      url
    });
  }
});

// ── TIKTOK ───────────────────────────────────────────────────────────────
router.get('/tiktok', (req, res) => {
  res.render('social/tiktok', { result: null, error: null, url: '' });
});

router.post('/tiktok', async (req, res) => {
  const { url } = req.body;
  try {
    // const apiPath = `/v1/social/autolink?url=${encodeURIComponent(url)}`;
    await rapidRequest(url);
    const result = await rapidRequest(apiPath);
    res.render('social/tiktok', { result, error: null, url });
  } catch (err) {
    res.render('social/tiktok', { result: null, error: err.message, url });
  }
});

// ── INSTAGRAM ────────────────────────────────────────────────────────────
router.get('/instagram', (req, res) => {
  res.render('social/instagram', { result: null, error: null, url: '' });
});

router.post('/instagram', async (req, res) => {
  const { url } = req.body;
  try {
    // const apiPath = `/v1/social/autolink?url=${encodeURIComponent(url)}`;
    const result = await rapidRequest(url);
    res.render('social/instagram', { result, error: null, url });
  } catch (err) {
    res.render('social/instagram', { result: null, error: err.message, url });
  }
});

// ── YOUTUBE ──────────────────────────────────────────────────────────────
router.get('/youtube', (req, res) => {
  res.render('social/youtube', { result: null, error: null, url: '' });
});

router.post('/youtube', async (req, res) => {
  const { url } = req.body;

  try {
    const apiPath = `/v1/social/autolink?url=${encodeURIComponent(url)}`;
    const result = await rapidRequest(apiPath);

    res.render('social/youtube', { result, error: null, url });

  } catch (err) {
    res.render('social/youtube', { result: null, error: err.message, url });
  }
});

// ── TWITTER / X ──────────────────────────────────────────────────────────
router.get('/twitter', (req, res) => {
  res.render('social/twitter', { result: null, error: null, url: '' });
});

router.post('/twitter', async (req, res) => {
  const { url } = req.body;
  try {
    const apiPath = `/v1/social/autolink?url=${encodeURIComponent(url)}`;
    
    const result = await rapidRequest(apiPath);
    res.render('social/twitter', { result, error: null, url });
  } catch (err) {
    res.render('social/twitter', { result: null, error: err.message, url });
  }
});

// ── FACEBOOK ─────────────────────────────────────────────────────────────
router.get('/facebook', (req, res) => {
  res.render('social/facebook', { result: null, error: null, url: '' });
});

router.post('/facebook', async (req, res) => {
  const { url } = req.body;
  try {
    // const apiPath = `/v1/social/autolink?url=${encodeURIComponent(url)}`;
    const result = await rapidRequest(url);
    res.render('social/facebook', { result, error: null, url });
  } catch (err) {
    res.render('social/facebook', { result: null, error: err.message, url });
  }
});

// ── API: JSON endpoint for AJAX ───────────────────────────────────────────
router.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const apiPath = `/v1/social/autolink?url=${encodeURIComponent(url)}`;
    const result = await rapidRequest(apiPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;