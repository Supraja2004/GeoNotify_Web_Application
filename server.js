// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());


const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

//  Connect to MongoDB Atlas
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log(' MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Define Geofence Schema
const geofenceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  reminder: { type: String, default: '' },
  coordinates: { type: [[Number]], required: true }, // [lng, lat]
  createdAt: { type: Date, default: Date.now }
});
const Geofence = mongoose.model('Geofence', geofenceSchema);

//Routes

// Create new geofence
app.post('/api/geofences', async (req, res) => {
  try {
    const { name, reminder, coordinates } = req.body;
    if (!name || !Array.isArray(coordinates) || coordinates.length < 3)
      return res.status(400).json({ error: 'Invalid input. name and >=3 coordinates required.' });

    const doc = await Geofence.create({ name, reminder, coordinates });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List all geofences
app.get('/api/geofences', async (req, res) => {
  try {
    const items = await Geofence.find().sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a geofence by ID
app.delete('/api/geofences/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Geofence.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Geofence not found' });
    res.json({ message: 'Geofence deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Check which geofences contain a point
app.get('/api/check', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng))
      return res.status(400).json({ error: 'lat & lng required' });

    const point = turf.point([lng, lat]);
    const fences = await Geofence.find().lean();

    const inside = fences.filter(f => {
      let coords = f.coordinates.slice();
      const first = coords[0], last = coords[coords.length - 1];
      if (!first || !last || first[0] !== last[0] || first[1] !== last[1])
        coords.push(first);
      const poly = turf.polygon([coords]);
      return turf.booleanPointInPolygon(point, poly);
    });

    res.json(inside);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server listening on port ${PORT}`));
