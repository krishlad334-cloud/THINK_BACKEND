const express = require('express');
const { subscribeNewsletter } = require('../controllers/newsletterController');
const { newsletterLimiter } = require('../middleware/rateLimiters');
const { newsletterRules } = require('../middleware/validate');

const router = express.Router();

router.post('/', newsletterLimiter, newsletterRules, subscribeNewsletter);

module.exports = router;
