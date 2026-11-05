/**
 * Vercel Serverless Function: /api/health
 */
module.exports = (req, res) => {
  res.status(200).json({
    status: 'online',
    app: 'Virtual Music Studio',
    version: '1.0.0',
    platform: 'Vercel Serverless',
    timestamp: new Date().toISOString()
  });
};
