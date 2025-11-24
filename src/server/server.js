const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 8080;

// World constants
const WORLD = { width: 5000, height: 5000 };

// Game state
const players = {};
const foodItems = [];

// Food helpers
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max)); }

// Safe spawn helper - find position away from other players
function getSafeSpawnPosition() {
  const margin = 100;
  const minDistance = 300; // Minimum distance from other players
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = rand(margin, WORLD.width - margin);
    const y = rand(margin, WORLD.height - margin);
    
    // Check if position is safe (far from other players)
    let isSafe = true;
    for (const id in players) {
      const player = players[id];
      const dx = x - player.x;
      const dy = y - player.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < minDistance * minDistance) {
        isSafe = false;
        break;
      }
    }
    
    if (isSafe) {
      return { x, y };
    }
  }
  
  // If no safe spot found after max attempts, return random position
  return { 
    x: rand(margin, WORLD.width - margin), 
    y: rand(margin, WORLD.height - margin) 
  };
}

const foodPalette = ['#FFDD57', '#7BED8D', '#57C7FF', '#FF5F57', '#C057FF', '#FFA857'];

function spawnFood(count) {
  for (let i = 0; i < count; i++) {
    const radius = 6;
    const margin = radius + 50;
    foodItems.push({
      id: Date.now() + Math.random(),
      x: rand(margin, WORLD.width - margin),
      y: rand(margin, WORLD.height - margin),
      radius,
      color: foodPalette[randInt(0, foodPalette.length)]
    });
  }
}

// Spawn initial food
spawnFood(200);

// Servera filer från public-mappen
app.use(express.static(path.join(__dirname, '../../public')));
app.use('/src/client', express.static(path.join(__dirname, '../client')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: Date.now(), players: Object.keys(players).length });
});

io.on('connection', (socket) => {
  console.log('Ny spelare ansluten:', socket.id);

  // Skapa ny spelare med Bootstrap-färger
  const colors = [
    '#0d6efd', // Bootstrap Primary (blå)
    '#6610f2', // Bootstrap Purple
    '#d63384', // Bootstrap Pink
    '#dc3545', // Bootstrap Danger (röd)
    '#fd7e14', // Bootstrap Orange
    '#ffc107', // Bootstrap Warning (gul)
    '#198754', // Bootstrap Success (grön)
    '#20c997', // Bootstrap Teal
    '#0dcaf0', // Bootstrap Cyan
    '#6c757d', // Bootstrap Secondary (grå)
    '#9b59b6', // Lila
    '#e74c3c', // Röd
    '#3498db', // Ljusblå
    '#2ecc71', // Ljusgrön
    '#f39c12', // Guld
    '#1abc9c', // Turkos
    '#e67e22', // Korall
    '#95a5a6'  // Silver
  ];
  
  // Välj en slumpmässig färg (inte bara rotation)
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  // Get safe spawn position away from other players
  const spawnPos = getSafeSpawnPosition();
  
  players[socket.id] = {
    id: socket.id,
    x: spawnPos.x,
    y: spawnPos.y,
    angle: rand(0, Math.PI * 2),
    radius: 12,
    color: color,
    body: [],
    length: 20,
    score: 0,
    boosting: false,
    name: 'Player'  // Default name
  };

  // Skicka initial state till nya spelaren
  socket.emit('init', {
    id: socket.id,
    players: players,
    food: foodItems,
    world: WORLD
  });

  // Ta emot namn från klient
  socket.on('setName', (name) => {
    if (players[socket.id] && name && typeof name === 'string') {
      // Validera och sanera namnet
      const cleanName = name.trim().substring(0, 15);
      if (cleanName.length > 0) {
        players[socket.id].name = cleanName;
        console.log(`Spelare ${socket.id} satte namn: ${cleanName}`);
        // Meddela andra om ny spelare NU när vi har namnet
        socket.broadcast.emit('playerJoined', players[socket.id]);
      }
    }
  });

  // Ta emot input från klient
  socket.on('input', (data) => {
    if (players[socket.id]) {
      players[socket.id].targetAngle = data.angle;
    }
  });

  // Ta emot position-uppdateringar (client-authoritative för nu)
  socket.on('update', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle;
      players[socket.id].body = data.body;
      players[socket.id].length = data.length;
      players[socket.id].score = data.score;
      players[socket.id].boosting = data.boosting || false;
      players[socket.id].radius = data.radius || 12; // Uppdatera radius från klienten
    }
  });

  // Hantera mat-kollisioner
  socket.on('eatFood', (foodId) => {
    const index = foodItems.findIndex(f => f.id === foodId);
    if (index !== -1) {
      foodItems.splice(index, 1);
      spawnFood(1);
      io.emit('foodEaten', { foodId, newFood: foodItems[foodItems.length - 1] });
    }
  });

  // Hantera spelar-död
  socket.on('playerDied', (data) => {
    const victim = players[data.victimId];
    const killer = players[data.killerId];
    
    if (!victim) return;
    
    console.log(`Spelare ${data.victimId} dog (träffad av ${data.killerId})`);
    
    // Skapa food från döda spelarens kropp
    if (victim.body && victim.body.length > 0) {
      const foodToSpawn = Math.min(victim.body.length, 20); // Max 20 food
      for (let i = 0; i < foodToSpawn; i++) {
        const randomSeg = victim.body[Math.floor(Math.random() * victim.body.length)];
        foodItems.push({
          id: Date.now() + Math.random(),
          x: randomSeg.x + rand(-50, 50),
          y: randomSeg.y + rand(-50, 50),
          radius: 6,
          color: victim.color // Samma färg som spelaren hade
        });
      }
    }
    
    // Ge killer poäng
    if (killer) {
      killer.score += Math.floor(victim.length / 10);
    }
    
    // Ta bort döda spelaren
    delete players[data.victimId];
    
    // Meddela alla
    io.emit('playerDied', {
      victimId: data.victimId,
      killerId: data.killerId,
      newFood: foodItems.slice(-20) // Skicka nya food items
    });
  });

  socket.on('disconnect', () => {
    console.log('Spelare frånkopplad:', socket.id);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

// Broadcast game state 20 gånger per sekund (optimerad för prestanda)
setInterval(() => {
  io.emit('state', { players });
}, 50);

server.listen(PORT, () => {
  console.log(`Servern körs på port ${PORT}`);
});