const db = require('../config/db');
const logger = require('../utils/logger');
const express = require('express');
const { avatarUrl, paintingImageUrl } = require('../utils/imageUrls');

const router = express.Router();

// Лише публічні поля профілю. НІКОЛИ не віддавати Password, Email, Birthday.
// Аватар не читаємо: віддаємо URL /api/images/avatar з версією (хеш) для кешування.
const PUBLIC_CREATOR_COLUMNS =
  'Creator_ID, Name, Other_Details, LEFT(MD5(Image), 8) AS imageVersion, styles, likes, Instagram, Behance, TikTok, languages, Availability';
// Колонки картини без самого зображення
const PAINTING_COLUMNS =
  'Painting_ID, Title, Description, Creation_Date, Author, Creator_ID, Style, Price, Batch_ID, width, height, likes, Category, Format';

function parseList(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  } catch { /* not JSON */ }
  return raw.split(/[;,/|]+/).map((s) => s.trim()).filter(Boolean);
}

function toPainting(p) {
  const likes = Number(p.likes) || 0;
  return { ...p, image_url: paintingImageUrl(p.Painting_ID), Likes: likes, likes };
}

// Same shape as before (imageBase64/avatar now hold an image URL) + rating, availability, minPrice
function toArtist(row, paintings, rating = {}) {
  const avatar = avatarUrl(row.Creator_ID, row.imageVersion || 'default');
  const { imageVersion, ...artist } = row;
  const likesFromPaintings = paintings.reduce((sum, p) => sum + p.likes, 0);
  let stylesArray = parseList(row.styles);
  if (!stylesArray.length) stylesArray = [...new Set(paintings.map((p) => p.Style).filter(Boolean).map(String))];
  return {
    ...artist,
    imageBase64: avatar,
    avatar,
    paintings,
    id: row.Creator_ID,
    name: row.Name,
    bio: row.Other_Details || '',
    stylesArray,
    languagesArray: parseList(row.languages),
    likesCount: Number(row.likes) || likesFromPaintings,
    availability: row.Availability || 'open',
    ratingAvg: rating.average === undefined || rating.average === null ? null : Number(rating.average),
    ratingCount: rating.count || 0,
    minPrice: paintings.length ? Math.min(...paintings.map((p) => Number(p.Price) || 0)) : null,
  };
}

async function loadRatings(artistId) {
  const [rows] = await db.query(
    `SELECT Artist_ID, COUNT(*) AS count, ROUND(AVG(Rating), 2) AS average FROM reviews
      ${artistId ? 'WHERE Artist_ID = ?' : ''} GROUP BY Artist_ID`,
    artistId ? [artistId] : []
  );
  return new Map(rows.map((r) => [r.Artist_ID, r]));
}

const SORTERS = {
  name_asc: (a, b) => String(a.Name).localeCompare(String(b.Name)),
  name_desc: (a, b) => String(b.Name).localeCompare(String(a.Name)),
  rating: (a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) || b.ratingCount - a.ratingCount,
  newest: (a, b) => b.Creator_ID - a.Creator_ID,
};

// Optional filters: q (name), minRating, availability, maxPrice (has a painting at or below), sort
function applyArtistFilters(list, query) {
  let out = list;
  if (query.q) {
    const q = String(query.q).toLowerCase();
    out = out.filter((a) => String(a.Name || '').toLowerCase().includes(q));
  }
  if (query.minRating !== undefined && Number.isFinite(Number(query.minRating))) {
    out = out.filter((a) => a.ratingAvg !== null && a.ratingAvg >= Number(query.minRating));
  }
  if (['open', 'busy', 'vacation'].includes(query.availability)) {
    out = out.filter((a) => a.availability === query.availability);
  }
  if (query.maxPrice !== undefined && Number.isFinite(Number(query.maxPrice))) {
    out = out.filter((a) => a.minPrice !== null && a.minPrice <= Number(query.maxPrice));
  }
  if (SORTERS[query.sort]) out = [...out].sort(SORTERS[query.sort]);
  return out;
}

// GET all artists + artworks: two queries instead of one per artist
router.get('/getartists', async (req, res) => {
  try {
    // Only artist accounts are listed (customers are not artists)
    const [artists] = await db.query(`SELECT ${PUBLIC_CREATOR_COLUMNS} FROM creators WHERE Role = 'artist' ORDER BY Creator_ID`);
    const [paintings] = await db.query(`SELECT ${PAINTING_COLUMNS} FROM paintings ORDER BY Painting_ID DESC`);

    const byArtist = new Map();
    for (const p of paintings) {
      if (!byArtist.has(p.Creator_ID)) byArtist.set(p.Creator_ID, []);
      byArtist.get(p.Creator_ID).push(toPainting(p));
    }
    const ratings = await loadRatings();
    const list = artists.map((a) => toArtist(a, byArtist.get(a.Creator_ID) || [], ratings.get(a.Creator_ID)));
    res.json(applyArtistFilters(list, req.query));
  } catch (error) {
    logger.error('Error fetching artists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Single artist
router.get('/artist/:id', async (req, res) => {
  const artistId = Number(req.params.id);
  if (!Number.isInteger(artistId) || artistId <= 0) return res.status(400).json({ error: 'Invalid artist id' });
  try {
    const [artistRows] = await db.query(`SELECT ${PUBLIC_CREATOR_COLUMNS} FROM creators WHERE Creator_ID = ?`, [artistId]);
    if (artistRows.length === 0) return res.status(404).json({ error: 'Artist not found' });

    const [paintings] = await db.query(
      `SELECT ${PAINTING_COLUMNS} FROM paintings WHERE Creator_ID = ? ORDER BY Painting_ID DESC`,
      [artistId]
    );
    const ratings = await loadRatings(artistId);
    res.json(toArtist(artistRows[0], paintings.map(toPainting), ratings.get(artistId)));
  } catch (error) {
    logger.error('Error fetching artist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
