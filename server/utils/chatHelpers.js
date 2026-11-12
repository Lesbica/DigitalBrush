// Utility helpers for chat routes
const { messageImageUrl } = require('./imageUrls');

// Message columns without the image bytes (images are served by /api/images/message/:id)
const MESSAGE_COLUMNS = 'id, senderId, receiverId, commissionId, type, content, image IS NOT NULL AS hasImage, status, timestamp';

function rowToMessage(row) {
  const hasImage = Boolean(row.hasImage ?? row.image);
  const image = hasImage ? messageImageUrl(row.id) : null;

  // Image messages have no text: the frontend reads the picture from `image` or `content`
  let outContent = row.content;
  let outType = row.type;
  const contentStr = outContent === null || outContent === undefined ? '' : String(outContent).trim();
  if ((contentStr === '' || contentStr.toLowerCase() === 'null') && image) {
    outContent = image;
    outType = 'image'; // як і раніше: повідомлення з картинкою показуються в чаті як image
  }

  return {
    id: row.id,
    senderId: row.senderId,
    receiverId: row.receiverId,
    commissionId: row.commissionId,
    type: outType,
    content: outContent,
    image,
    status: row.status,
    timestamp: row.timestamp
  };
}

module.exports = { MESSAGE_COLUMNS, rowToMessage };
