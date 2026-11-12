// Allows the request only for accounts with the artist role (read from the DB, so a role
// change in settings applies immediately). Use after the auth middleware.
const db = require('../config/db');

module.exports = async (req, res, next) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Not authorized' });
        const [[row]] = await db.query('SELECT Role FROM creators WHERE Creator_ID = ?', [userId]);
        if (!row || row.Role !== 'artist') {
            return res.status(403).json({
                success: false,
                code: 'ARTIST_ONLY',
                message: 'Only artist accounts can do this. Switch your account to artist in profile settings.',
            });
        }
        next();
    } catch (err) {
        next(err);
    }
};
