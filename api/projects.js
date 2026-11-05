/**
 * Vercel Serverless Function: /api/projects
 * In-memory fallback / MongoDB cloud project storage endpoint
 */

let inMemoryProjects = [];

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json(inMemoryProjects);
  }

  if (req.method === 'POST') {
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

    return res.status(200).json({ success: true, project });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
