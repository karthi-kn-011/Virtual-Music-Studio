/**
 * Virtual Music Studio - Express Server & REST API
 * Serves the frontend static studio and provides cloud project sync endpoints.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// In-memory cloud project store (or connects to MongoDB if MONGODB_URI is provided)
let inMemoryProjects = [];

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Virtual Music Studio',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Cloud Project Endpoints
app.get('/api/projects', (req, res) => {
  res.json(inMemoryProjects);
});

app.post('/api/projects', (req, res) => {
  const project = req.body;
  if (!project || !project.name) {
    return res.status(400).json({ error: 'Invalid project payload' });
  }

  const existingIdx = inMemoryProjects.findIndex(p => p.id === project.id);
  project.updatedAt = new Date().toISOString();

  if (existingIdx !== -1) {
    inMemoryProjects[existingIdx] = project;
  } else {
    inMemoryProjects.push(project);
  }

  res.json({ success: true, project });
});

app.get('/api/projects/:id', (req, res) => {
  const project = inMemoryProjects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.delete('/api/projects/:id', (req, res) => {
  inMemoryProjects = inMemoryProjects.filter(p => p.id !== req.params.id);
  res.json({ success: true });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🎵 VIRTUAL MUSIC STUDIO server is running!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
