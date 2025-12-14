// server/routes/webhook.js
const express = require('express');
const router = express.Router();
const { handleWebhook, verifyWebhook } = require('../controllers/whatsapp');

// GET /webhook - Webhook verification
router.get('/', verifyWebhook);

// POST /webhook - Receive messages
router.post('/', handleWebhook);

module.exports = router;