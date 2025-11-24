// Multiplayer client
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Load sounds
const accSound = new Audio('/sounds/acc.mp3');
accSound.volume = 0.3;

// Background music playlist
const bgMusic1 = new Audio('/sounds/HereIam.mp3');
bgMusic1.volume = 0.08;
bgMusic1.preload = 'auto';

const bgMusic2 = new Audio('/sounds/ThisisAsongmadebyAdam.mp3');
bgMusic2.volume = 0.08;
bgMusic2.loop = true; // Loop the second song
bgMusic2.preload = 'auto';

let isMusicMuted = false;

// When first song ends, play second song
bgMusic1.addEventListener('ended', () => {
  bgMusic2.play().catch(err => console.log('Second song play failed:', err));
});

// Name system
let playerName = '';
const nameOverlay = document.getElementById('name-overlay');
const nameInput = document.getElementById('name-input');
const playButton = document.getElementById('play-button');

playButton.addEventListener('click', startGame);
nameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    startGame();
  }
});

function startGame() {
  const name = nameInput.value.trim();
  if (name.length === 0) {
    alert('Please enter a name!');
    return;
  }
  if (name.length > 15) {
    alert('Name too long! Max 15 characters.');
    return;
  }
  
  playerName = name;
  nameOverlay.style.display = 'none';
  canvas.style.display = 'block';
  
  // Start background music immediately on user interaction (no delay)
  bgMusic1.play().then(() => {
    console.log('Background music started - HereIam.mp3');
  }).catch(err => {
    console.error('Background music play failed:', err);
    // Retry on next user interaction
    const retryPlay = () => {
      bgMusic1.play().then(() => {
        console.log('Background music started on retry');
      }).catch(e => console.error('Retry also failed:', e));
    };
    canvas.addEventListener('click', retryPlay, { once: true });
    canvas.addEventListener('mousemove', retryPlay, { once: true });
  });
  
  // Connect to server with name
  initializeGame();
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Click handler for mute button
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  // Calculate mute button position dynamically
  const isMobile = canvas.width < 768;
  const topPlayers = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
  const rowHeight = isMobile ? 25 : 30;
  const headerHeight = isMobile ? 15 : 20;
  const totalHeight = headerHeight + (topPlayers.length * rowHeight) + 15;
  
  const buttonX = isMobile ? 10 : 20;
  const buttonY = 30 + totalHeight + 10;
  const buttonSize = isMobile ? 35 : 30;
  
  if (clickX >= buttonX && clickX <= buttonX + buttonSize &&
      clickY >= buttonY && clickY <= buttonY + buttonSize) {
    isMusicMuted = !isMusicMuted;
    if (isMusicMuted) {
      bgMusic1.pause();
      bgMusic2.pause();
    } else {
      bgMusic2.play().catch(err => console.log('Music play failed:', err));
    }
  }
});

// Connect to server (after name is entered)
let socket = null;

function initializeGame() {
  socket = io();
  setupSocketListeners();
  startGameLoop();
}

function setupSocketListeners() {
  // Socket events
  socket.on('init', (data) => {
    myId = data.id;
    players = data.players;
    foodItems = data.food;
    world = data.world;
    console.log('Ansluten som:', myId);
    // Send name to server
    socket.emit('setName', playerName);
  });

  socket.on('playerJoined', (player) => {
    players[player.id] = player;
    console.log('Ny spelare:', player.id);
  });

  socket.on('playerLeft', (id) => {
    delete players[id];
    console.log('Spelare lämnade:', id);
  });

  socket.on('state', (data) => {
    // Uppdatera alla spelares positioner med interpolation
    Object.keys(data.players).forEach(id => {
      if (id === myId) return; // Skippa egen spelare
      
      if (players[id]) {
        // Spara target position för interpolation
        if (!players[id].targetX) {
          players[id].targetX = data.players[id].x;
          players[id].targetY = data.players[id].y;
        } else {
          players[id].targetX = data.players[id].x;
          players[id].targetY = data.players[id].y;
        }
        
        players[id].angle = data.players[id].angle;
        players[id].body = data.players[id].body;
        players[id].length = data.players[id].length;
        players[id].score = data.players[id].score;
        players[id].boosting = data.players[id].boosting;
        players[id].name = data.players[id].name;
        players[id].radius = data.players[id].radius;
      }
    });
  });

  socket.on('foodEaten', (data) => {
    foodItems = foodItems.filter(f => f.id !== data.foodId);
    if (data.newFood) {
      foodItems.push(data.newFood);
    }
  });

  socket.on('playerDied', (data) => {
    console.log('Spelare dog:', data.victimId);
    
    // Ta bort döda spelaren
    delete players[data.victimId];
    
    // Lägg till nya food items från kroppen
    if (data.newFood) {
      data.newFood.forEach(f => {
        if (!foodItems.find(existing => existing.id === f.id)) {
          foodItems.push(f);
        }
      });
    }
    
    // Om jag dog, visa meddelande och ladda om efter 3 sek
    if (data.victimId === myId) {
      alert('You died! Respawning in 3 seconds...');
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  });
}

function startGameLoop() {
  loop();
}

// Game state
let myId = null;
let players = {};
let foodItems = [];
let world = { width: 5000, height: 5000 };

const camera = { x: 0, y: 0, smoothing: 0.08 };

// Mouse input
let screenMouseX = canvas.width / 2;
let screenMouseY = canvas.height / 2;
window.addEventListener('mousemove', (e) => {
  screenMouseX = e.clientX;
  screenMouseY = e.clientY;
});

// Touch input for mobile
let isTouching = false;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isTouching = true;
  const touch = e.touches[0];
  screenMouseX = touch.clientX;
  screenMouseY = touch.clientY;
  
  // Start boost on touch
  if (!boosting && !boostCooldown) {
    boosting = true;
    boostEndTime = Date.now() + 3000;
    accSound.currentTime = 0;
    accSound.play().catch(err => console.log('Audio play failed:', err));
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  screenMouseX = touch.clientX;
  screenMouseY = touch.clientY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  isTouching = false;
}, { passive: false });

// Boost system
let boosting = false;
let boostCooldown = false;
let boostEndTime = 0;
let cooldownEndTime = 0;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !boosting && !boostCooldown) {
    boosting = true;
    boostEndTime = Date.now() + 3000; // 3 sekunder boost
    // Play acceleration sound
    accSound.currentTime = 0;
    accSound.play().catch(err => console.log('Audio play failed:', err));
    e.preventDefault();
  }
});

// Uppdatera boost-status
function updateBoost() {
  const now = Date.now();
  
  if (boosting && now >= boostEndTime) {
    boosting = false;
    boostCooldown = true;
    cooldownEndTime = now + 8000; // 8 sekunder cooldown
    // Stop acceleration sound when boost ends
    accSound.pause();
    accSound.currentTime = 0;
  }
  
  if (boostCooldown && now >= cooldownEndTime) {
    boostCooldown = false;
  }
}

function getMyPlayer() {
  return players[myId];
}

function updateCamera() {
  const player = getMyPlayer();
  if (!player) return;

  const targetX = player.x - canvas.width / 2;
  const targetY = player.y - canvas.height / 2;
  camera.x += (targetX - camera.x) * camera.smoothing;
  camera.y += (targetY - camera.y) * camera.smoothing;

  const maxCamX = world.width - canvas.width;
  const maxCamY = world.height - canvas.height;
  
  if (world.width <= canvas.width) {
    camera.x = (world.width - canvas.width) / 2;
  } else {
    if (camera.x < 0) camera.x = 0;
    if (camera.x > maxCamX) camera.x = maxCamX;
  }
  
  if (world.height <= canvas.height) {
    camera.y = (world.height - canvas.height) / 2;
  } else {
    if (camera.y < 0) camera.y = 0;
    if (camera.y > maxCamY) camera.y = maxCamY;
  }
}

function updatePlayer() {
  const player = getMyPlayer();
  if (!player) return;

  const screenPlayerX = player.x - camera.x;
  const screenPlayerY = player.y - camera.y;
  const dx = screenMouseX - screenPlayerX;
  const dy = screenMouseY - screenPlayerY;

  player.targetAngle = Math.atan2(dy, dx);

  // Smooth rotation
  let diff = player.targetAngle - player.angle;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  player.angle += diff * 0.16;

  // Movement with boost
  updateBoost();
  player.boosting = boosting; // Synka lokalt boost-state med player object
  let speed = 2.25;
  if (boosting) {
    speed = 3.75; // Extra snabb under boost
  }
  player.x += Math.cos(player.angle) * speed;
  player.y += Math.sin(player.angle) * speed;

  // Wall collision
  const r = player.radius;
  if (player.x < r) player.x = r;
  if (player.x > world.width - r) player.x = world.width - r;
  if (player.y < r) player.y = r;
  if (player.y > world.height - r) player.y = world.height - r;

  // Trail update
  if (!player.body) player.body = [];
  
  if (player.body.length === 0) {
    player.body.push({ x: player.x, y: player.y });
  } else {
    const lastSeg = player.body[0];
    const dist = Math.hypot(player.x - lastSeg.x, player.y - lastSeg.y);
    const segmentSpacing = player.radius * 1.0;
    
    if (dist >= segmentSpacing) {
      player.body.unshift({ x: player.x, y: player.y });
    }
  }
  
  if (player.body.length > player.length) player.body.pop();

  // Send update to server
  socket.emit('update', {
    x: player.x,
    y: player.y,
    angle: player.angle,
    body: player.body,
    length: player.length,
    score: player.score || 0,
    boosting: boosting,
    radius: player.radius // Skicka radius till servern
  });
}

function checkFoodCollisions() {
  const player = getMyPlayer();
  if (!player) return;

  for (let i = foodItems.length - 1; i >= 0; i--) {
    const f = foodItems[i];
    const dx = f.x - player.x;
    const dy = f.y - player.y;
    const distSq = dx * dx + dy * dy;
    const radSum = f.radius + player.radius;
    
    if (distSq <= radSum * radSum) {
      foodItems.splice(i, 1);
      player.length += 2;
      player.score = (player.score || 0) + 1;
      
      // ↓↓↓ HÄR KAN DU ÄNDRA BREDDEN ↓↓↓
      // Öka radius oftare för snabbare tillväxt
      if (player.length % 8 === 0) {  // Var 8:e mat (tidigare 15)
        player.radius += 1.2; // Öka med 1.2 pixlar (tidigare 0.5)
      }
      // ↑↑↑ ÄNDRA SIFFRORNA OVAN ↑↑↑
      
      socket.emit('eatFood', f.id);
    }
  }
}

function checkPlayerCollisions() {
  const myPlayer = getMyPlayer();
  if (!myPlayer) return;

  // Kolla kollision med andra spelares kroppar
  Object.keys(players).forEach(id => {
    if (id === myId) return; // Skippa egen spelare
    
    const otherPlayer = players[id];
    if (!otherPlayer) return;
    
    // Check collision with other player's head first
    let dx = myPlayer.x - otherPlayer.x;
    let dy = myPlayer.y - otherPlayer.y;
    let distSq = dx * dx + dy * dy;
    // Use full radius for head collision, more forgiving
    let collisionDist = myPlayer.radius + otherPlayer.radius * 0.85;
    
    if (distSq <= collisionDist * collisionDist) {
      socket.emit('playerDied', { 
        killerId: otherPlayer.id,
        victimId: myId 
      });
      return;
    }
    
    // Kolla mitt huvud mot deras kropp-segment
    if (otherPlayer.body && otherPlayer.body.length > 0) {
      for (let i = 0; i < otherPlayer.body.length; i++) {
        const seg = otherPlayer.body[i];
        const dx = myPlayer.x - seg.x;
        const dy = myPlayer.y - seg.y;
        const distSq = dx * dx + dy * dy;
        
        // Use actual radius for body collision - larger snakes = bigger hitbox
        // Scale based on the other player's actual radius
        const collisionDist = myPlayer.radius * 0.95 + otherPlayer.radius * 0.95;
        
        if (distSq <= collisionDist * collisionDist) {
          // Död! Skicka till server
          socket.emit('playerDied', { 
            killerId: otherPlayer.id,
            victimId: myId 
          });
          return;
        }
      }
    }
  });
}

function drawGrid() {
  const spacing = 200;
  const startX = Math.floor(camera.x / spacing) * spacing;
  const startY = Math.floor(camera.y / spacing) * spacing;
  
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  
  for (let x = startX; x < camera.x + canvas.width + spacing; x += spacing) {
    if (x < 0 || x > world.width) continue;
    ctx.beginPath();
    ctx.moveTo(x - camera.x, Math.max(0, -camera.y));
    ctx.lineTo(x - camera.x, Math.min(canvas.height, world.height - camera.y));
    ctx.stroke();
  }
  
  for (let y = startY; y < camera.y + canvas.height + spacing; y += spacing) {
    if (y < 0 || y > world.height) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, -camera.x), y - camera.y);
    ctx.lineTo(Math.min(canvas.width, world.width - camera.x), y - camera.y);
    ctx.stroke();
  }
}

function drawWorldBounds() {
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.rect(-camera.x, -camera.y, world.width, world.height);
  ctx.stroke();
}

function drawFood() {
  const time = Date.now() / 1000;
  
  for (const f of foodItems) {
    const screenX = f.x - camera.x;
    const screenY = f.y - camera.y;
    
    if (screenX < -f.radius || screenY < -f.radius || 
        screenX > canvas.width + f.radius || screenY > canvas.height + f.radius) continue;
    
    // Pulsating effect
    const pulse = Math.sin(time * 3 + f.x * 0.01) * 0.3 + 1; // 0.7 - 1.3
    const currentRadius = f.radius * pulse;
    
    // Glow effect (slither.io style)
    ctx.shadowBlur = 15 * pulse;
    ctx.shadowColor = f.color;
    
    ctx.beginPath();
    ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;
  }
}

function drawPlayer(player, isMe) {
  if (!player || !player.body) return;
  
  const bodyRadius = player.radius;
  
  // Draw body
  for (let i = player.body.length - 1; i > 0; i--) {
    const seg = player.body[i];
    const screenX = seg.x - camera.x;
    const screenY = seg.y - camera.y;
    
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, bodyRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Draw head
  const headX = player.x - camera.x;
  const headY = player.y - camera.y;
  
  // Boost glow effect
  if (player.boosting) {
    ctx.shadowBlur = 25;
    ctx.shadowColor = player.color;
  }
  
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(headX, headY, bodyRadius * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  ctx.shadowBlur = 0;
  
  // Eyes
  const eyeDistance = bodyRadius * 0.5;
  const eyeRadius = bodyRadius * 0.25;
  const pupilRadius = eyeRadius * 0.5;
  
  const eyeOffsetX = Math.cos(player.angle + Math.PI / 2) * eyeDistance;
  const eyeOffsetY = Math.sin(player.angle + Math.PI / 2) * eyeDistance;
  const eyeForward = bodyRadius * 0.3;
  const forwardX = Math.cos(player.angle) * eyeForward;
  const forwardY = Math.sin(player.angle) * eyeForward;
  
  // Left eye
  const leftEyeX = headX + forwardX - eyeOffsetX;
  const leftEyeY = headY + forwardY - eyeOffsetY;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(leftEyeX, leftEyeY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Right eye
  const rightEyeX = headX + forwardX + eyeOffsetX;
  const rightEyeY = headY + forwardY + eyeOffsetY;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(rightEyeX, rightEyeY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw name above player
  if (player.name) {
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    // Measure text for background
    const textMetrics = ctx.measureText(player.name);
    const textWidth = textMetrics.width;
    const textHeight = 20;
    const padding = 4;
    const nameY = headY - bodyRadius - 15;
    
    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(
      headX - textWidth/2 - padding, 
      nameY - textHeight - padding, 
      textWidth + padding * 2, 
      textHeight + padding * 2
    );
    
    // Draw name text
    ctx.fillStyle = isMe ? '#00FF00' : '#FFFFFF';
    ctx.fillText(player.name, headX, nameY);
  }
}

function drawLeaderboard() {
  // Sortera spelare efter score
  const sortedPlayers = Object.values(players)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10); // Top 10

  if (sortedPlayers.length === 0) return;

  // Responsive sizing
  const isMobile = canvas.width < 768;
  const width = isMobile ? Math.min(200, canvas.width - 20) : 220;
  const headerHeight = isMobile ? 30 : 35;
  const rowHeight = isMobile ? 22 : 25;
  const totalHeight = headerHeight + (sortedPlayers.length * rowHeight) + 10;
  const startX = isMobile ? 10 : 20;
  
  // Bakgrund
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(startX, 20, width, totalHeight);
  
  // Header
  ctx.fillStyle = '#FFD700';
  ctx.font = isMobile ? 'bold 14px Arial' : 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('LEADERBOARD', width/2 + startX, isMobile ? 40 : 45);
  
  // Spelare
  ctx.textAlign = 'left';
  ctx.font = isMobile ? '12px Arial' : '14px Arial';
  
  sortedPlayers.forEach((player, index) => {
    const y = (isMobile ? 40 : 45) + headerHeight + (index * rowHeight);
    const x = startX + 10;
    
    // Färg baserat på position
    if (index === 0) ctx.fillStyle = '#FFD700'; // Guld
    else if (index === 1) ctx.fillStyle = '#C0C0C0'; // Silver
    else if (index === 2) ctx.fillStyle = '#CD7F32'; // Brons
    else ctx.fillStyle = '#FFFFFF';
    
    // Markera egen spelare
    if (player.id === myId) {
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(startX + 5, y - 16, width - 10, 22);
      ctx.fillStyle = '#000000';
    }
    
    // Rank och score
    const rankText = `${index + 1}.`;
    const nameText = player.name || 'Unknown';
    const scoreText = `${player.score || 0}`;
    
    ctx.fillText(rankText, x, y);
    
    // Namn (trunkera om för långt)
    ctx.font = isMobile ? 'bold 11px Arial' : 'bold 14px Arial';
    const maxNameWidth = isMobile ? 80 : 100;
    let displayName = nameText;
    if (ctx.measureText(displayName).width > maxNameWidth) {
      while (ctx.measureText(displayName + '...').width > maxNameWidth && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '...';
    }
    ctx.fillText(displayName, x + 30, y);
    
    // Score
    ctx.font = isMobile ? '11px Arial' : '14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(scoreText, x + (isMobile ? 125 : 145), y);
    ctx.textAlign = 'left';
    
    // Cirkel med spelarens färg
    ctx.fillStyle = player.color;
    ctx.beginPath();
    const circleX = isMobile ? x + 145 : x + 175;
    ctx.arc(circleX, y - 5, isMobile ? 6 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  
  // Mute button under leaderboard
  const buttonX = isMobile ? 10 : 20;
  const buttonY = 30 + totalHeight + 10;
  const buttonSize = isMobile ? 35 : 30;
  
  ctx.fillStyle = isMusicMuted ? 'rgba(255, 50, 50, 0.8)' : 'rgba(100, 255, 100, 0.8)';
  ctx.fillRect(buttonX, buttonY, buttonSize, buttonSize);
  
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(buttonX, buttonY, buttonSize, buttonSize);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = isMobile ? '20px Arial' : '18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isMusicMuted ? '🔇' : '🔊', buttonX + buttonSize/2, buttonY + buttonSize/2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawBoostIndicator() {
  const player = getMyPlayer();
  if (!player) return;
  
  const isMobile = canvas.width < 768;
  const x = canvas.width / 2;
  const y = isMobile ? canvas.height - 60 : canvas.height - 40;
  const barWidth = isMobile ? Math.min(150, canvas.width - 40) : 200;
  const barHeight = isMobile ? 25 : 20;
  
  // Bakgrund
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
  
  if (boosting) {
    // Aktiv boost - visa återstående tid
    const remaining = Math.max(0, boostEndTime - Date.now()) / 3000;
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(x - barWidth/2, y, barWidth * remaining, barHeight);
    ctx.fillStyle = '#FFFFFF';
    const isMobile = canvas.width < 768;
    ctx.font = isMobile ? '14px Arial' : '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BOOST!', x, y + (isMobile ? 16 : 14));
  } else if (boostCooldown) {
    // Cooldown - visa återstående tid
    const remaining = Math.max(0, cooldownEndTime - Date.now()) / 8000;
    ctx.fillStyle = '#FF4040';
    ctx.fillRect(x - barWidth/2, y, barWidth * (1 - remaining), barHeight);
    ctx.fillStyle = '#FFFFFF';
    const isMobile = canvas.width < 768;
    ctx.font = isMobile ? '14px Arial' : '12px Arial';
    ctx.textAlign = 'center';
    const secondsLeft = Math.ceil((cooldownEndTime - Date.now()) / 1000);
    ctx.fillText(`Cooldown: ${secondsLeft}s`, x, y + (isMobile ? 16 : 14));
  } else {
    // Redo för boost
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
    ctx.fillStyle = '#FFFFFF';
    const isMobile = canvas.width < 768;
    ctx.font = isMobile ? '11px Arial' : '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(isMobile ? 'TAP to boost' : 'Press SPACE to boost', x, y + (isMobile ? 16 : 14));
  }
  
  // Ram
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - barWidth/2, y, barWidth, barHeight);
}

function interpolateOtherPlayers() {
  // Smooth movement för andra spelare
  Object.keys(players).forEach(id => {
    if (id !== myId && players[id] && players[id].targetX !== undefined) {
      const player = players[id];
      const lerp = 0.3; // Interpolation hastighet
      
      player.x += (player.targetX - player.x) * lerp;
      player.y += (player.targetY - player.y) * lerp;
    }
  });
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (myId && players[myId]) {
    updateCamera();
    updatePlayer();
    checkFoodCollisions();
    checkPlayerCollisions();
  }
  
  // Interpolera andra spelares positioner för smooth rörelse
  interpolateOtherPlayers();
  
  drawGrid();
  drawWorldBounds();
  drawFood();
  
  // Draw other players
  Object.keys(players).forEach(id => {
    if (id !== myId) {
      drawPlayer(players[id], false);
    }
  });
  
  // Draw my player on top
  if (myId && players[myId]) {
    drawPlayer(players[myId], true);
  }
  
  drawLeaderboard();
  drawBoostIndicator();
  requestAnimationFrame(loop);
}

loop();
