import express from 'express';
import { WebSocketServer } from 'ws';
import { Profile, ServiceListing } from '../shared/types';
import { createGraphNetwork } from './graphNetwork';

const app = express();
const port = process.env.PORT || 3000;

// Initialize in-memory data stores
const profiles: Record<string, Profile> = {};
const listings: ServiceListing[] = [];
const graphNetwork = createGraphNetwork();

// Middleware
app.use(express.json());

// API Routes
app.get('/api/profile', (req, res) => {
  const profileId = req.query.id as string;
  const profile = profiles[profileId];
  if (profile) {
    res.json(profile);
  } else {
    res.status(404).send('Profile not found');
  }
});

app.post('/api/profile', (req, res) => {
  const profile = req.body as Profile;
  profiles[profile.id] = profile;
  graphNetwork.addNode(profile);
  res.status(201).json(profile);
});

app.get('/api/listings', (req, res) => {
  res.json(listings);
});

app.post('/api/listings', (req, res) => {
  const listing = req.body as ServiceListing;
  listings.push(listing);
  graphNetwork.addListing(listing);
  res.status(201).json(listing);
});

// WebSocket Server
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    // Handle real-time updates
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});