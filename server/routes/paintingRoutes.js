const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/authMiddleware');
const { imageUpload, withImageUpload, MAX_FILES } = require('../config/multerConfig');
const { paintingImageUrl, paintingExtraImageUrl, avatarUrl, DETAIL_WIDTH } = require('../utils/imageUrls');

const router = express.Router();

/* =====================================================
   GET PAINTINGS (main image only, as URL)
   Optional filters: category, style, q (title), creatorId, minPrice, maxPrice,
   sort = newest | price_asc | price_desc | popular.
   Pagination: page (1-based) + limit (max 100). Without page/limit returns everything (up to 500)
   so the current frontend keeps working.
===================================================== */
const SORTS = {
  newest: 'p.Painting_ID DESC',
  price_asc: 'p.Price ASC, p.Painting_ID DESC',
  price_desc: 'p.Price DESC, p.Painting_ID DESC',
  popular: 'p.likes DESC, p.Painting_ID DESC',
};

router.get('', async (req, res) => {
  try {
    const q = req.query;
    const where = [];
    const params = [];
    const like = (s) => `%${String(s).replace(/[\\%_]/g, (c) => '\\' + c)}%`;

    if (q.category) { where.push('p.Category = ?'); params.push(String(q.category)); }
    if (q.style) { where.push('p.Style = ?'); params.push(String(q.style)); }
    if (q.q) { where.push('p.Title LIKE ?'); params.push(like(String(q.q).slice(0, 100))); }
    if (q.creatorId && Number.isInteger(Number(q.creatorId))) { where.push('p.Creator_ID = ?'); params.push(Number(q.creatorId)); }
    if (q.minPrice !== undefined && Number.isFinite(Number(q.minPrice))) { where.push('p.Price >= ?'); params.push(Number(q.minPrice)); }
    if (q.maxPrice !== undefined && Number.isFinite(Number(q.maxPrice))) { where.push('p.Price <= ?'); params.push(Number(q.maxPrice)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = SORTS[q.sort] || SORTS.newest;

    const paginated = q.page !== undefined || q.limit !== undefined;
    const limit = paginated ? Math.min(Math.max(Number.parseInt(q.limit, 10) || 24, 1), 100) : 500;
    const page = paginated ? Math.max(Number.parseInt(q.page, 10) || 1, 1) : 1;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM paintings p ${whereSql}`, params);
    const [rows] = await db.query(`
        SELECT p.Painting_ID, p.Title, p.Description, p.Price, p.Style, p.Category, p.likes,
               p.Creator_ID, c.Name AS author_name
          FROM paintings p
          JOIN creators c ON p.Creator_ID = c.Creator_ID
          ${whereSql}
         ORDER BY ${orderSql}
         LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);

    const paintings = rows.map((row) => ({
      Painting_ID: row.Painting_ID,
      id: row.Painting_ID,
      Title: row.Title,
      title: row.Title,
      Description: row.Description,
      description: row.Description,
      Price: row.Price,
      price: row.Price,
      Style: row.Style,
      style: row.Style,
      Category: row.Category,
      category: row.Category,
      Likes: row.likes,
      likes: row.likes,
      author_name: row.author_name,
      Creator_ID: row.Creator_ID,
      image: paintingImageUrl(row.Painting_ID),
    }));

    res.json({ success: true, paintings, total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    console.error('Error fetching paintings:', err);
    res.status(500).json({ success: false, message: 'Error fetching paintings' });
  }
});

// Перевірка полів картини. Повертає { values } або { error }.
function validatePaintingFields(body) {
    const title = String(body.title || '').trim();
    if (!title) return { error: 'Title is required' };
    if (title.length > 255) return { error: 'Title is too long (max 255)' };

    const description = body.description === undefined ? null : String(body.description).slice(0, 5000);

    const price = body.price === undefined || body.price === '' ? 0 : Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 1e7) return { error: 'Price must be a number from 0 to 10 000 000' };

    const dim = (v, name) => {
        if (v === undefined || v === null || v === '') return { value: null };
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0 || n > 100000) return { error: `${name} must be a positive integer` };
        return { value: n };
    };
    const width = dim(body.width, 'Width');
    if (width.error) return width;
    const height = dim(body.height, 'Height');
    if (height.error) return height;

    const short = (v) => (v ? String(v).trim().slice(0, 100) || null : null);

    return {
        values: {
            title,
            description,
            category: short(body.category),
            style: short(body.style),
            format: short(body.format),
            price: Math.round(price * 100) / 100,
            width: width.value,
            height: height.value,
        },
    };
}

router.post("/upload", auth, withImageUpload(imageUpload.any()), async (req, res) => {
    const Author = req.session.user?.name || null;
    const Creator_ID = req.session.user?.id || null;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: "No images uploaded" });
    }
    if (req.files.length > MAX_FILES) {
        return res.status(400).json({ success: false, message: `Too many images uploaded (max ${MAX_FILES})` });
    }

    const { values, error } = validatePaintingFields(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    const images = req.files;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        /* 1️⃣ Create a new batch */
        const [batchResult] = await conn.query(`INSERT INTO painting_batches () VALUES ()`);
        const Batch_ID = batchResult.insertId;

        /* 2️⃣ First image becomes main painting */
        const [paintingResult] = await conn.query(
            `INSERT INTO paintings
             (Title, Description, Category, Style, Format, Width, Height, Price, Author, Creation_Date, Image, Creator_ID, Batch_ID)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
            [
                values.title, values.description, values.category, values.style, values.format,
                values.width, values.height, values.price,
                Author, images[0].buffer, Creator_ID, Batch_ID
            ]
        );

        /* 3️⃣ Additional images go to painting_images */
        for (let i = 1; i < images.length; i++) {
            await conn.query(
                `INSERT INTO painting_images (Batch_ID, Image) VALUES (?, ?)`,
                [Batch_ID, images[i].buffer]
            );
        }

        await conn.commit();
        res.status(201).json({
            success: true,
            message: "Painting uploaded successfully",
            paintingID: paintingResult.insertId,
            Batch_ID,
        });
    } catch (err) {
        await conn.rollback();
        console.error("Upload error:", err);
        res.status(500).json({ success: false, message: "Database error" });
    } finally {
        conn.release();
    }
});

/* =====================================================
   GET PAINTING + ALL IMAGES IN SAME BATCH
===================================================== */
router.get('/:id', async (req, res) => {
  const paintingId = Number(req.params.id);
  if (!Number.isInteger(paintingId) || paintingId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid painting id' });
  }

  try {
    // Painting with author info; image bytes are served by /api/images
    const [paintingRows] = await db.query(
      `SELECT p.Painting_ID, p.Title, p.Description, p.Creator_ID, p.Price, p.Style, p.likes,
              p.Category, p.Format, p.width, p.height, p.Creation_Date, p.Batch_ID,
              p.Image IS NOT NULL AS hasImage,
              c.Name AS author_name, LEFT(MD5(c.Image), 8) AS author_image_version
         FROM paintings p
         JOIN creators c ON p.Creator_ID = c.Creator_ID
        WHERE p.Painting_ID = ?`,
      [paintingId]
    );

    if (paintingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Painting not found' });
    }
    const painting = paintingRows[0];

    const [extraImagesRows] = painting.Batch_ID
      ? await db.query('SELECT Image_ID FROM painting_images WHERE Batch_ID = ? ORDER BY Image_ID', [painting.Batch_ID])
      : [[]];

    let likedByCurrentUser = false;
    const userId = req.session?.user?.Creator_ID || req.session?.user?.id || null;
    if (userId) {
      const [likeRows] = await db.query(
        'SELECT 1 FROM painting_likes WHERE Painting_ID = ? AND User_ID = ? LIMIT 1',
        [paintingId, userId]
      );
      likedByCurrentUser = likeRows.length > 0;
    }

    const width = painting.width || null;
    const height = painting.height || null;

    res.json({
      success: true,
      painting: {
        id: painting.Painting_ID,
        title: painting.Title,
        description: painting.Description,
        author_name: painting.author_name,
        author_avatar: avatarUrl(painting.Creator_ID, painting.author_image_version || 'default'),
        artistId: painting.Creator_ID,
        creator_id: painting.Creator_ID, // backward compatibility
        price: painting.Price,
        style: painting.Style,
        likes: painting.likes || 0,
        likedByCurrentUser,
        category: painting.Category || null,
        format: painting.Format || null,
        size: width && height ? `${width}x${height}` : null,
        width,
        height,
        creationDate: painting.Creation_Date || null,
        mainImage: painting.hasImage ? paintingImageUrl(painting.Painting_ID, DETAIL_WIDTH) : null,
        gallery: extraImagesRows.map((img) => paintingExtraImageUrl(painting.Painting_ID, img.Image_ID)),
        batchId: painting.Batch_ID
      }
    });
  } catch (err) {
    console.error('Error fetching painting:', err);
    res.status(500).json({ success: false, message: 'Error fetching painting' });
  }
});

/* =====================================================
   LIKE / UNLIKE A PAINTING (toggle per user)
===================================================== */
router.post('/:id/like', auth, async (req, res) => {
  const paintingId = parseInt(req.params.id, 10);
  const userId = req.session?.user?.Creator_ID || req.session?.user?.id;

  if (!Number.isFinite(paintingId)) {
    return res.status(400).json({ success: false, message: 'Invalid painting id' });
  }
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {

    // Check painting exists
    const [existsRows] = await db.query('SELECT Painting_ID FROM paintings WHERE Painting_ID = ?', [paintingId]);
    if (existsRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Painting not found' });
    }

    // Is currently liked by this user?
    const [likeRows] = await db.query(
      'SELECT 1 FROM painting_likes WHERE Painting_ID = ? AND User_ID = ? LIMIT 1',
      [paintingId, userId]
    );

    let liked;
    if (likeRows.length > 0) {
      // Unlike: remove link and decrement counter (not below 0)
      await db.query('DELETE FROM painting_likes WHERE Painting_ID = ? AND User_ID = ?', [paintingId, userId]);
      await db.query('UPDATE paintings SET Likes = CASE WHEN Likes > 0 THEN Likes - 1 ELSE 0 END WHERE Painting_ID = ?', [paintingId]);
      liked = false;
    } else {
      // Like: add link and increment counter
      try {
        await db.query('INSERT INTO painting_likes (Painting_ID, User_ID) VALUES (?, ?)', [paintingId, userId]);
        await db.query('UPDATE paintings SET Likes = COALESCE(Likes, 0) + 1 WHERE Painting_ID = ?', [paintingId]);
        liked = true;
      } catch (e) {
        // In case of race/duplicate, ensure consistency
        if (e && e.code === 'ER_DUP_ENTRY') {
          liked = true;
        } else {
          throw e;
        }
      }
    }

    // Return fresh counter
    const [[{ Likes } = { Likes: 0 }]] = await db.query('SELECT COALESCE(Likes, 0) AS Likes FROM paintings WHERE Painting_ID = ?', [paintingId]);
    return res.json({ success: true, liked, likes: Likes });
  } catch (err) {
    console.error('Error toggling like:', err);
    return res.status(500).json({ success: false, message: 'Error toggling like' });
  }
});

/* =====================================================
   DELETE PAINTING (also deletes batch and all images)
===================================================== */
router.delete('/delete/:id', auth, async (req, res) => {
    const paintingId = req.params.id;
    const userId = req.session.user.id;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [[painting]] = await conn.query(
            'SELECT Batch_ID FROM paintings WHERE Painting_ID = ? AND Creator_ID = ? FOR UPDATE',
            [paintingId, userId]
        );
        if (!painting) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Painting not found' });
        }

        // user_purchases має ON DELETE CASCADE: видалення стерло б покупку в покупців.
        const [[sold]] = await conn.query('SELECT COUNT(*) AS n FROM user_purchases WHERE Painting_ID = ?', [paintingId]);
        if (sold.n > 0) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: 'This painting has already been purchased and cannot be deleted' });
        }

        await conn.query('DELETE FROM paintings WHERE Painting_ID = ?', [paintingId]);
        if (painting.Batch_ID) {
            // painting_images видаляються каскадно разом із batch (FK ON DELETE CASCADE)
            await conn.query('DELETE FROM painting_batches WHERE Batch_ID = ?', [painting.Batch_ID]);
        }

        await conn.commit();
        res.json({ success: true, message: 'Painting deleted successfully' });
    } catch (err) {
        await conn.rollback();
        console.error('Error deleting painting:', err);
        res.status(500).json({ success: false, message: 'Error deleting painting' });
    } finally {
        conn.release();
    }
});

module.exports = router;
