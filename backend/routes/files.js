const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const router   = express.Router();
const Todo     = require('../models/Todo');
const { requireAuth }           = require('../middleware/auth');
const { canUploadAttachment }   = require('../middleware/authorization');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

router.use(requireAuth);

router.post('/upload/:todoId', upload.single('file'), async (req, res) => {
  const todo = await Todo.findById(req.params.todoId);
  if (!todo) return res.status(404).json({ error: 'Todo nicht gefunden' });
  if (!canUploadAttachment(req.user, todo)) {
    return res.status(403).json({ error: 'Kein Upload-Zugriff auf dieses Todo' });
  }

  res.json({
    filename:     req.file.filename,
    originalname: req.file.originalname,
    url:          `/uploads/${req.file.filename}`
  });
});

router.use('/uploads', express.static('uploads'));

module.exports = router;