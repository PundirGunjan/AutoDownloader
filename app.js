require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const socialRoutes = require('./routes/social');

const downloaderRoutes = require('./routes/downloader');

app.use('/', socialRoutes);

app.use('/downloader', downloaderRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found', code: 404 });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: err.message || 'Something went wrong', code: 500 });
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
