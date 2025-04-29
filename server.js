require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const flaskApiUrl = process.env.FLASK_API_URL || 'http://localhost:5000';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/api/recommendations', (req, res) => {
  const { query } = req.body;

  if (!query) {
    console.warn('Missing query in request body');
    return res.status(400).json({ error: 'Query is required' });
  }

  console.log(`Received query: "${query}"`);
  console.log('Spawning Python process...');

  const pythonProcess = spawn('python', ['api_handler.py', query], {
    cwd: path.resolve(__dirname)
  });

  let result = '';
  let error = '';

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python STDOUT: ${data}`);
    result += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python STDERR: ${data}`);
    error += data.toString();
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code: ${code}`);
    
    if (code !== 0) {
      console.error(`Python script error:\n${error}`);
      return res.status(500).json({ error: 'Python error', details: error });
    }

    try {
      const jsonStart = result.indexOf('{');
      const jsonEnd = result.lastIndexOf('}') + 1;

      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonContent = result.substring(jsonStart, jsonEnd);
        console.log(`Parsed JSON output: ${jsonContent}`);
        const recommendations = JSON.parse(jsonContent);
        return res.json(recommendations);
      } else {
        console.warn(`Raw output from Python (invalid JSON):\n${result}`);
        throw new Error('No valid JSON found in Python output');
      }
    } catch (e) {
      console.error(`Failed to parse JSON from Python:\n${e.message}`);
      return res.status(500).json({
        error: 'Failed to parse Python output',
        raw: result,
        details: e.message
      });
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Node.js server is running' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Node.js server running on port ${port}`);
});
