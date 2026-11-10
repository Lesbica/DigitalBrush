const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const express = require('express');
const router = express.Router();

// Лише публічні поля профілю. НІКОЛИ не віддавати Password, Email, Birthday.
const PUBLIC_CREATOR_COLUMNS = 'Creator_ID, Name, Other_Details, Image, styles, likes, Instagram, Behance, TikTok, languages';

function bufferToDataUri(buffer, fallbackExt = 'jpeg') {
  if (!buffer) return null;
  const ext = fallbackExt.toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;
}

function filePathToDataUri(filePath) {
  try {
    if (!filePath) return null;
    if (String(filePath).startsWith('data:')) return filePath; // already data URI
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
    if (!fs.existsSync(resolved)) return null;
    const buffer = fs.readFileSync(resolved);
    const ext = path.extname(resolved).slice(1) || 'jpeg';
    return bufferToDataUri(buffer, ext);
  } catch (err) {
    console.error('filePathToDataUri error:', err);
    return null;
  }
}

// GET all artists + artworks
router.get('/getartists', async (req, res) => {
  try {
    const [artists] = await db.query(`SELECT ${PUBLIC_CREATOR_COLUMNS} FROM creators`);

    const artistsWithArtworks = await Promise.all(
      artists.map(async (artist) => {
        // normalize artist id field
        const artistId = artist.Creator_ID || artist.Creator_Id || artist.CreatorId || artist.id;

        // Fetch paintings for this artist (try both possible column names)
        const [paintings] = await db.query(
          'SELECT * FROM paintings WHERE Creator_ID = ? OR Creator_Id = ?',
          [artistId, artistId]
        );

        // Normalize artist avatar: handle BLOB or file path or existing data URI
        let avatarData = null;
        if (artist.Image && Buffer.isBuffer(artist.Image)) {
          avatarData = bufferToDataUri(artist.Image);
        } else if (artist.imageBase64) {
          avatarData = artist.imageBase64;
        } else {
          avatarData = filePathToDataUri(artist.image || artist.image_path || artist.photo || artist.avatar);
        }
        if (avatarData) artist.imageBase64 = avatarData;

        // Convert each painting image to data URI if needed and set image_url
        artist.paintings = paintings.map((p) => {
          let imageUrl = null;
          // p.Image may be a Buffer from DB (BLOB) or a filesystem path string or already data URI
          if (p.Image && Buffer.isBuffer(p.Image)) {
            imageUrl = bufferToDataUri(p.Image);
          } else if (typeof p.Image === 'string') {
            imageUrl = filePathToDataUri(p.Image) || (p.Image.startsWith('data:') ? p.Image : null);
          }

          // also check any precomputed fields
          if (!imageUrl && (p.imageBase64 || p.image_url)) {
            imageUrl = p.imageBase64 || p.image_url;
          }

          // normalize returned fields, including likes
          const likesNum = Number(p.Likes ?? p.likes) || 0;
          return {
            ...p,
            image_url: imageUrl || null,
            Likes: likesNum,
            likes: likesNum
          };
        });

        // compute aggregated likes for artist if not present
        try {
          const likesFromPaintings = Array.isArray(artist.paintings)
            ? artist.paintings.reduce((sum, p) => sum + (Number(p.likes ?? p.Likes) || 0), 0)
            : 0;
          const normLikes = Number(artist.likesCount || artist.likes || artist.Likes || likesFromPaintings) || 0;
          artist.likesCount = normLikes;
        } catch (e) {
          // ignore aggregation errors
        }

        return artist;
      })
    );

    res.json(artistsWithArtworks);
  } catch (error) {
    console.error('Error fetching artists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Single artist
router.get('/artist/:id', async (req, res) => {
  const artistId = req.params.id;
  try {
    const [artistRows] = await db.query(
      `SELECT ${PUBLIC_CREATOR_COLUMNS} FROM creators WHERE Creator_ID = ?`,
      [artistId]
    );
    if (artistRows.length === 0)
      return res.status(404).json({ error: 'Artist not found' });

    const artist = artistRows[0];

    // normalize avatar for single artist
    if (artist.Image && Buffer.isBuffer(artist.Image)) {
      artist.imageBase64 = bufferToDataUri(artist.Image);
    } else {
      artist.imageBase64 = filePathToDataUri(artist.image || artist.image_path || artist.photo || artist.avatar) || artist.imageBase64;
    }

    const [paintings] = await db.query(
      'SELECT * FROM paintings WHERE Creator_Id = ? OR Creator_ID = ?',
      [artistId, artistId]
    );

    artist.paintings = paintings.map((p) => {
      let imageUrl = null;
      if (p.Image && Buffer.isBuffer(p.Image)) {
        imageUrl = bufferToDataUri(p.Image);
      } else if (typeof p.Image === 'string') {
        imageUrl = filePathToDataUri(p.Image) || (p.Image.startsWith('data:') ? p.Image : null);
      }
      if (!imageUrl && (p.imageBase64 || p.image_url)) imageUrl = p.imageBase64 || p.image_url;
      const likesNum = Number(p.Likes ?? p.likes) || 0;
      return { ...p, image_url: imageUrl || null, Likes: likesNum, likes: likesNum };
    });

    // --- Normalize creators fields for frontend convenience ---
    try {
      // id/name/email
      const normId = artist.Creator_ID || artist.Creator_Id || artist.id;
      const normName = artist.Name || artist.name;

      // bio: prefer explicit bio field if any, else Other_Details/Description
      const normBio = artist.bio || artist.Bio || artist.Other_Details || artist.Description || '';

      // styles: can be JSON string/array/single value; fallback extract from paintings
      let normStyles = [];
      const rawStyles = artist.styles !== undefined ? artist.styles : (artist.Styles !== undefined ? artist.Styles : undefined);
      if (Array.isArray(rawStyles)) {
        normStyles = rawStyles.filter(Boolean).map(String);
      } else if (typeof rawStyles === 'string' && rawStyles.trim()) {
        try {
          const parsed = JSON.parse(rawStyles);
          if (Array.isArray(parsed)) normStyles = parsed.filter(Boolean).map(String);
          else {
            const split = rawStyles.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean);
            if (split.length) normStyles = split;
          }
        } catch {
          const split = rawStyles.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean);
          if (split.length) normStyles = split;
        }
      } else if (artist.Style || artist.style) {
        normStyles = [String(artist.Style || artist.style)];
      }
      if (!normStyles.length && Array.isArray(artist.paintings)) {
        const set = new Set();
        artist.paintings.forEach(p => {
          const ps = p.Style || p.style || p.artistStyle;
          if (ps) set.add(String(ps));
        });
        if (set.size) normStyles = Array.from(set);
      }

      // languages: JSON string/array; treat as human languages, not country
      let normLanguages = [];
      const rawLang = artist.languages !== undefined ? artist.languages : (artist.Languages !== undefined ? artist.Languages : undefined);
      if (Array.isArray(rawLang)) {
        normLanguages = rawLang.filter(Boolean).map(String);
      } else if (typeof rawLang === 'string' && rawLang.trim()) {
        try {
          const parsed = JSON.parse(rawLang);
          if (Array.isArray(parsed)) normLanguages = parsed.filter(Boolean).map(String);
          else {
            const split = rawLang.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean);
            if (split.length) normLanguages = split;
          }
        } catch {
          const split = rawLang.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean);
          if (split.length) normLanguages = split;
        }
      }

      // likesCount: prefer artist field if present, else sum paintings
      const likesFromPaintings = Array.isArray(artist.paintings)
        ? artist.paintings.reduce((sum, p) => sum + (Number(p.likes || p.Likes) || 0), 0)
        : 0;
      const normLikes = Number(artist.likesCount || artist.likes || artist.Likes || likesFromPaintings) || 0;

      // expose normalized fields (keep original ones for compatibility)
      artist.id = normId;
      artist.name = normName;
      artist.bio = normBio;
      artist.avatar = artist.imageBase64 || artist.avatar || null;
      artist.stylesArray = normStyles; // additional explicit array field
      artist.languagesArray = normLanguages; // additional explicit array field
      artist.likesCount = normLikes;
    } catch (e) {
      // do not break response on normalization error
      console.error('Artist normalization error:', e);
    }

    res.json(artist);
  } catch (error) {
    console.error('Error fetching artist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
