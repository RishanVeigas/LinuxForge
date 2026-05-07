/**
 * requireAuth middleware
 * Attach to any route or router that should only be accessible
 * to logged-in users.
 *
 * Usage:
 *   const { requireAuth } = require('../middleware/auth');
 *   router.get('/some-feature', requireAuth, handler);
 *   app.use('/features', requireAuth, featuresRouter);
 */
export const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    // API request — return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ message: 'You must be logged in to access this feature' });
    }
    // Browser request — redirect to login page
    return res.redirect('/login');
  }
  // Attach user info to req for use in downstream handlers
  res.locals.userId = req.session.userId;
  res.locals.email = req.session.email;
  next();
};