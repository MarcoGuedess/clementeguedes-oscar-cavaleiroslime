<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jogo do Slime</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #1a1a2e;
      font-family: Arial, sans-serif;
    }
    canvas {
      border: 3px solid #16213e;
      box-shadow: 0 0 20px rgba(0,0,0,0.5);
      background: #87CEEB;
    }
    .controls {
      margin-top: 15px;
      color: #fff;
      text-align: center;
      background: rgba(0,0,0,0.7);
      padding: 15px;
      border-radius: 8px;
    }
    .controls h3 {
      margin: 0 0 10px 0;
      color: #4ecca3;
    }
    .controls p {
      margin: 5px 0;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <canvas id="gameCanvas" width="800" height="600"></canvas>
  <div class="controls">
    <h3>🎮 Controles</h3>
    <p>⬅️➡️ Setas ou A/D - Mover | ⬆️ ou W - Pular | Espaço - Atacar</p>
    <p>🎯 Ataque o slime 3 vezes para derrotá-lo!</p>
  </div>

  <script>
// === CANVAS ===
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// === TECLAS ===
const keys = {};

// === IMAGENS ===
const imagens = {
  fundo: new Image(),
  meio: new Image(),
  slime: new Image()
};
imagens.fundo.src = "ceu.png";
imagens.meio.src = "fundofloresta.png";
imagens.slime.src = "slime.png";

// === SPRITES DO PLAYER ===
const sprites = {
  idle: new Image(),
  corrida: new Image(),
  ataque: new Image(),
  pulo: new Image()
};
sprites.idle.src = "corrida.png";
sprites.corrida.src = "corrida.png";
sprites.ataque.src = "ataque.png";
sprites.pulo.src = "pulo.png";

// === PARALLAX ===
let fundoX = 0, meioX = 0;
const LAYER_SPEED = { fundo: 0.2, meio: 0.5 };

// === PLAYER ===
const player = {
  x: 100,
  y: 0,
  width: 64,
  height: 128,
  speed: 200,
  vx: 0,
  vy: 0,
  pulando: false,
  noChao: true,
  atacando: false,
  dano: false
};

// === SLIME - MELHORADO ===
const slime = {
  x: 500,
  y: 0,
  width: 60,
  height: 60,
  speed: 60,
  dir: 1,
  vida: 3,
  vidaMax: 3,
  ativo: true,
  estado: "patrulhando", // patrulhando, pulando, morrendo, morto
  // física do pulo
  vy: 0,
  gravidade: 800,
  forcaPulo: -350,
  tempoProximoPulo: 0,
  intervaloPulo: 2, // segundos entre pulos
  // animação
  frameIndex: 0,
  frameTick: 0,
  frameDelay: 8,
  sheetCols: 8,
  sheetRows: 4,
  frameW: 40,
  frameH: 32,
  // animação de morte
  framesMorte: 8,
  morteCompleta: false
};

// === ANIMAÇÃO PLAYER ===
let estadoAtual = "idle";
let estadoAnterior = "idle";
let frameIndex = 0, frameTick = 0;
const frameDelayConfig = {
  idle: 8,
  corrida: 6,
  ataque: 5,
  pulo: 6
};
const frameConfig = {
  idle: { largura: 64, altura: 128, total: 1 },
  corrida: { largura: 64, altura: 128, total: 7 },
  ataque: { largura: 128, altura: 128, total: 5 },
  pulo: { largura: 64, altura: 128, total: 6 }
};

// === LOOP PRINCIPAL ===
let lastTime = 0;
let tempoDecorrido = 0;

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  tempoDecorrido += dt;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

// === UPDATE ===
function update(dt) {
  player.vx = 0;

  // Ataque
  if ((keys[" "] || keys["Space"]) && !player.atacando && player.noChao) {
    player.atacando = true;
    estadoAtual = "ataque";
    frameIndex = 0;
    frameTick = 0;
  }

  // Movimento horizontal (não durante ataque)
  if (!player.atacando) {
    if (keys["ArrowRight"] || keys["d"]) {
      player.vx = player.speed;
      estadoAtual = "corrida";
    } else if (keys["ArrowLeft"] || keys["a"]) {
      player.vx = -player.speed;
      estadoAtual = "corrida";
    } else if (!player.pulando) {
      estadoAtual = "idle";
      frameIndex = 0;
      frameTick = 0;
    }

    // Pulo
    if ((keys["ArrowUp"] || keys["w"]) && player.noChao) {
      player.vy = -400;
      player.pulando = true;
      player.noChao = false;
      estadoAtual = "pulo";
      frameIndex = 0;
      frameTick = 0;
    }
  }

  // Gravidade e movimento do player
  player.vy += 1000 * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Colisão com chão
  const chaoY = canvas.height - 80;
  if (player.y + player.height >= chaoY) {
    player.y = chaoY - player.height;
    player.vy = 0;
    player.pulando = false;
    player.noChao = true;
    if (!player.atacando && player.vx === 0) estadoAtual = "idle";
  }

  // Limites da tela do player
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

  // === SLIME UPDATE - SISTEMA MELHORADO ===
  updateSlime(dt, chaoY);

  // === PARALLAX ===
  const hDir = Math.sign(player.vx);
  if (hDir !== 0) {
    fundoX -= hDir * LAYER_SPEED.fundo * player.speed * dt;
    meioX -= hDir * LAYER_SPEED.meio * player.speed * dt;
  }
  fundoX = loopValor(fundoX, imagens.fundo.width || 384);
  meioX = loopValor(meioX, imagens.meio.width || 160);

  // === FRAMES PLAYER ===
  if (estadoAtual !== estadoAnterior) {
    frameIndex = 0;
    frameTick = 0;
    estadoAnterior = estadoAtual;
  }

  if (estadoAtual !== "idle" || estadoAtual === "ataque") {
    frameTick++;
    if (frameTick >= frameDelayConfig[estadoAtual]) {
      frameTick = 0;
      frameIndex++;
      const totalFrames = frameConfig[estadoAtual].total;
      if (frameIndex >= totalFrames) {
        frameIndex = 0;
        if (estadoAtual === "ataque") {
          player.atacando = false;
          estadoAtual = player.vx !== 0 ? "corrida" : "idle";
        }
      }
    }
  }
}

// === SISTEMA DE ANIMAÇÃO DO SLIME ===
function updateSlime(dt, chaoY) {
  if (!slime.ativo) return;

  // Estado: MORTO - não faz nada
  if (slime.estado === "morto") return;

  // Estado: MORRENDO - só toca animação
  if (slime.estado === "morrendo") {
    slime.frameTick++;
    if (slime.frameTick >= slime.frameDelay) {
      slime.frameTick = 0;
      slime.frameIndex++;
      
      if (slime.frameIndex >= slime.framesMorte) {
        slime.estado = "morto";
        slime.ativo = false;
        return;
      }
    }
    return;
  }

  // Estado: PATRULHANDO ou PULANDO
  
  // Movimento horizontal
  slime.x += slime.dir * slime.speed * dt;
  
  // Inverte direção nos limites
  if (slime.x <= 400) slime.dir = 1;
  if (slime.x + slime.width >= 700) slime.dir = -1;

  // Sistema de pulo
  if (slime.estado === "patrulhando") {
    if (tempoDecorrido >= slime.tempoProximoPulo) {
      slime.estado = "pulando";
      slime.vy = slime.forcaPulo;
      slime.frameIndex = 0;
      slime.frameTick = 0;
      slime.tempoProximoPulo = tempoDecorrido + slime.intervaloPulo;
    }
  }

  // Física do pulo
  if (slime.estado === "pulando") {
    slime.vy += slime.gravidade * dt;
    slime.y += slime.vy * dt;

    // Voltou ao chão
    if (slime.y >= chaoY - slime.height) {
      slime.y = chaoY - slime.height;
      slime.vy = 0;
      slime.estado = "patrulhando";
      slime.frameIndex = 0;
      slime.frameTick = 0;
    }
  } else {
    // Garante que está no chão quando não pulando
    slime.y = chaoY - slime.height;
  }

  // Avança animação
  slime.frameTick++;
  if (slime.frameTick >= slime.frameDelay) {
    slime.frameTick = 0;
    slime.frameIndex = (slime.frameIndex + 1) % slime.sheetCols;
  }

  // Detecção de colisão com ataque do player
  if (player.atacando && slime.estado !== "morrendo") {
    const colide =
      player.x < slime.x + slime.width &&
      player.x + player.width > slime.x &&
      player.y < slime.y + slime.height &&
      player.y + player.height > slime.y;

    if (colide && !player.dano) {
      player.dano = true;
      slime.vida--;
      
      if (slime.vida <= 0) {
        slime.estado = "morrendo";
        slime.frameIndex = 0;
        slime.frameTick = 0;
      }
      
      setTimeout(() => (player.dano = false), 300);
    }
  }
}

// === DETERMINA LINHA DO SPRITE DO SLIME ===
function slimeStateRow() {
  if (slime.estado === "morrendo" || slime.estado === "morto") return 3;
  if (slime.estado === "pulando") return 2;
  if (slime.estado === "patrulhando") return 1;
  return 0; // idle (não usado no jogo atual)
}

// === DRAW ===
function drawLayer(img, offsetX, y, heightOverride) {
  if (!img || img.naturalWidth === 0) return;
  const imgW = img.width;
  const imgH = heightOverride || img.height;
  let startX = -(offsetX % imgW);
  if (startX > 0) startX -= imgW;

  for (let x = startX; x < canvas.width; x += imgW) {
    ctx.drawImage(img, x, y, imgW, imgH);
  }
}

function drawPlayer() {
  const sprite = sprites[estadoAtual];
  if (!sprite.complete || sprite.naturalWidth === 0) {
    ctx.fillStyle = "red";
    ctx.fillRect(player.x, player.y, player.width, player.height);
    return;
  }

  const config = frameConfig[estadoAtual];
  const sx = frameIndex * config.largura;
  ctx.drawImage(sprite, sx, 0, config.largura, config.altura, player.x, player.y, player.width, player.height);
}

function drawSlime() {
  if (!slime.ativo && slime.estado === "morto") return;

  ctx.save();

  if (!imagens.slime.complete || imagens.slime.naturalWidth === 0) {
    ctx.fillStyle = "purple";
    ctx.fillRect(slime.x, slime.y, slime.width, slime.height);
  } else {
    const row = slimeStateRow();
    const col = slime.frameIndex % slime.sheetCols;
    const sx = col * slime.frameW;
    const sy = row * slime.frameH;

    // Espelha sprite baseado na direção
    if (slime.dir === -1) {
      ctx.translate(slime.x + slime.width, slime.y);
      ctx.scale(-1, 1);
      ctx.drawImage(imagens.slime, sx, sy, slime.frameW, slime.frameH, 0, 0, slime.width, slime.height);
    } else {
      ctx.drawImage(imagens.slime, sx, sy, slime.frameW, slime.frameH, slime.x, slime.y, slime.width, slime.height);
    }
  }

  ctx.restore();

  // Barra de vida (só se não estiver morto)
  if (slime.estado !== "morrendo" && slime.estado !== "morto") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(slime.x - 2, slime.y - 12, slime.width + 4, 7);
    
    ctx.fillStyle = "red";
    ctx.fillRect(slime.x, slime.y - 10, slime.width, 5);
    
    ctx.fillStyle = "lime";
    const vidaPercent = Math.max(0, slime.vida) / slime.vidaMax;
    ctx.fillRect(slime.x, slime.y - 10, slime.width * vidaPercent, 5);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const chaoY = canvas.height - 80;

  // Fundo
  if (imagens.fundo.naturalWidth > 0) {
    drawLayer(imagens.fundo, fundoX, 0, chaoY);
  } else {
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, chaoY);
  }

  // Floresta
  if (imagens.meio.naturalWidth > 0) {
    drawLayer(imagens.meio, meioX, chaoY - 224, 224);
  } else {
    ctx.fillStyle = "#228B22";
    ctx.fillRect(0, chaoY - 224, canvas.width, 224);
  }

  // Chão
  ctx.fillStyle = "#2d5016";
  ctx.fillRect(0, chaoY, canvas.width, 80);

  drawPlayer();
  drawSlime();
}

// === AUXILIAR ===
function loopValor(val, mod) {
  if (!mod) return val;
  return ((val % mod) + mod) % mod;
}

// === CONTROLES ===
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  e.preventDefault();
});
window.addEventListener("keyup", e => {
  keys[e.key] = false;
  e.preventDefault();
});

// === CARREGAMENTO ===
const todasImagens = [
  imagens.fundo, imagens.meio, imagens.slime,
  sprites.idle, sprites.corrida, sprites.ataque, sprites.pulo
];

let carregadas = 0;

todasImagens.forEach(img => {
  img.onload = () => {
    carregadas++;
    if (img === imagens.slime && imagens.slime.naturalWidth > 0) {
      slime.sheetCols = 8;
      slime.sheetRows = 4;
      slime.frameW = imagens.slime.naturalWidth / slime.sheetCols;
      slime.frameH = imagens.slime.naturalHeight / slime.sheetRows;
      slime.width = slime.frameW * 1.5;
      slime.height = slime.frameH * 1.5;
    }

    if (carregadas === todasImagens.length) iniciarJogo();
  };
  
  img.onerror = () => {
    carregadas++;
    if (carregadas === todasImagens.length) iniciarJogo();
  };
});

// Fallback
setTimeout(() => {
  if (carregadas < todasImagens.length) iniciarJogo();
}, 2000);

function iniciarJogo() {
  const chaoY = canvas.height - 80;
  player.y = chaoY - player.height;
  slime.y = chaoY - slime.height;
  slime.tempoProximoPulo = tempoDecorrido + slime.intervaloPulo;
  requestAnimationFrame(gameLoop);
}
  </script>
</body>
</html>