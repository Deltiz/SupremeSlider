# SupremeSlider 🐍

Multiplayer slither.io-style snake game med Node.js, Socket.io och Canvas.

## 🚀 Snabbstart med Docker

### Alternativ 1: Från GitHub Container Registry
```bash
# Dra senaste imagen
docker pull ghcr.io/deltiz/supremeslider:latest

# Starta spelet
docker run -d -p 8080:8080 --name supremeslider ghcr.io/deltiz/supremeslider:latest

# Öppna ngrok-tunnel för multiplayer
ngrok http 8080
```

### Alternativ 2: Bygg själv
```bash
# Klona repot
git clone https://github.com/Deltiz/SupremeSlider.git
cd SupremeSlider

# Bygg och starta med Docker Compose
docker-compose up --build -d

# Starta ngrok för extern access
ngrok http 8080
```

## 🛠️ Utveckling utan Docker

```bash
npm install
npm start

# I separat terminal (för extern multiplayer-access)
ngrok http 8080
```

Öppna sedan `http://localhost:8080` i webbläsaren.

## 🎮 Spelkontroller

- **Desktop**: Mus för riktning, SPACE för boost
- **Mobil**: Touch för riktning, tap för boost  
- **Mute**: Klicka på högtalare-ikonen vid leaderboard

## 📦 Funktioner

- ✅ Realtids multiplayer med Socket.io
- ✅ Smooth interpolation för flytande rörelse
- ✅ Mobil-anpassad UI (responsiv design)
- ✅ Bakgrundsmusik + boost-ljudeffekter
- ✅ Leaderboard med topp 10
- ✅ Boost-system (3s duration, 8s cooldown)
- ✅ Förbättrad collision detection
- ✅ Safe spawn-system (undviker andra spelare)
- ✅ Docker-stöd för enkel deployment

## 🏗️ Tech Stack

- **Backend**: Node.js 24-alpine, Express 5.1.0, Socket.io 4.8.1
- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Deployment**: Docker + docker-compose, ngrok (Hobby plan)
- **Audio**: Web Audio API med playlist-system

## 📝 Ngrok Setup (för extern multiplayer-access)

```bash
# Installera ngrok
# Linux: snap install ngrok / brew install ngrok
# Mac: brew install ngrok
# Eller från: https://ngrok.com/download

# Skapa gratis konto på ngrok.com och få din authtoken

# Konfigurera authtoken
ngrok config add-authtoken DIN_TOKEN

# Starta tunnel
ngrok http 8080
```

Din spel-URL blir då t.ex: `https://abc-xyz-123.ngrok-free.app`

Dela denna URL med vänner för multiplayer!

## 🎯 Spelmeknik

- **World**: 5000x5000 pixels
- **Initial food**: 200 items
- **Growth**: +1.2 radius var 8:e mat
- **Speed**: 2.25 normal, 3.75 boost
- **Server tick rate**: 20Hz (optimerat för prestanda)
- **Interpolation**: 0.3 lerp factor för smooth movement

## 📁 Projektstruktur

```
SupremeSlider/
├── .github/
│   └── workflows/
│       └── docker-build.yml  # GitHub Actions för Docker build
├── src/
│   ├── server/
│   │   └── server.js         # Express + Socket.IO server
│   └── client/
│       └── index.js          # Klient-spellogik
├── public/
│   ├── index.html            # HTML entry point
│   └── sounds/               # Audio-filer
│       ├── HereIam.mp3
│       ├── ThisisAsongmadebyAdam.mp3
│       └── acc.mp3
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## 🐳 Docker Info

När du pushar till master-branchen kommer GitHub Actions automatiskt:
1. Bygga en ny Docker-image
2. Pusha den till GitHub Container Registry (ghcr.io)
3. Tagga den som `latest` + commit-SHA

Vem som helst kan sedan dra och köra spelet:
```bash
docker pull ghcr.io/deltiz/supremeslider:latest
docker run -d -p 8080:8080 ghcr.io/deltiz/supremeslider:latest
ngrok http 8080  # För multiplayer-access
```

### Klient (src/client/index.js)
- Hastighet: 1.7 (konstant för nu)
- Start radius: 12
- Start längd: 20 segment
- Tillväxt per mat: +4 längd

## Nästa steg
- [ ] Server-authoritative rörelse
- [ ] Spelare-kollisioner (större äter mindre)
- [ ] Boost-mekanism (space = snabbare)
- [ ] Bättre interpolation för andra spelare
- [ ] Leaderboard
- [ ] Namn på spelare
