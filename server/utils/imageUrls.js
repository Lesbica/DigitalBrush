// Absolute URLs of image endpoints (/api/images/...) that list/detail responses return
// instead of embedding base64 data. API_URL is the public API base including /api.
const crypto = require('crypto');

function apiBase() {
    return (process.env.API_URL || 'http://localhost:8080/api').replace(/\/+$/, '');
}

// Card size for lists, large size for detail views (see ALLOWED_WIDTHS in imageService)
const LIST_WIDTH = 600;
const DETAIL_WIDTH = 1600;
const AVATAR_WIDTH = 200;

const paintingImageUrl = (paintingId, w = LIST_WIDTH) => `${apiBase()}/images/painting/${paintingId}?w=${w}`;
const paintingExtraImageUrl = (paintingId, imageId, w = DETAIL_WIDTH) =>
    `${apiBase()}/images/painting/${paintingId}/extra/${imageId}?w=${w}`;

// v changes when the avatar changes, so browsers can cache the URL for long
const avatarUrl = (userId, version, w = AVATAR_WIDTH) =>
    `${apiBase()}/images/avatar/${userId}?w=${w}${version ? `&v=${version}` : ''}`;

// slot: ref | 2 | 3 | 4 | 5 | result
const commissionImageUrl = (commissionId, slot, w = DETAIL_WIDTH) =>
    `${apiBase()}/images/commission/${commissionId}/${slot}?w=${w}`;

const messageImageUrl = (messageId, w = DETAIL_WIDTH) => `${apiBase()}/images/message/${messageId}?w=${w}`;

const imageVersion = (buffer) => (buffer ? crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8) : null);

module.exports = {
    apiBase,
    LIST_WIDTH,
    DETAIL_WIDTH,
    AVATAR_WIDTH,
    paintingImageUrl,
    paintingExtraImageUrl,
    avatarUrl,
    commissionImageUrl,
    messageImageUrl,
    imageVersion,
};
