// === CANVAS ===
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// === CONSTANTES DO JOGO ===
const CHAO_Y = canvas.height - 80; 
const GRAVIDADE = 1000;
const TAMANHO_BLOCO = 64; 

// === ESTADO DO JOGO ===
const GAME_STATE = {
    PLAYING: 0,
    LEVEL_WON: 1,
    GAME_OVER: 2 
};
let gameState = GAME_STATE.PLAYING;
const LEVEL_END_X = 3000; 

// === TECLAS ===
const keys = {};

// === IMAGENS ===
const imagens = {
    fundo: new Image(),
    meio: new Image(),
    slime: new Image(),
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

// === CÂMERA E PARALLAX ===
let fundoX = 0, meioX = 0;
let worldOffsetX = 0; 
const LAYER_SPEED = { fundo: 0.2, meio: 0.5 }; 

// === PLAYER ===
const player = {
    x: 100,
    y: 0,
    width: 64,
    height: 128,
    speed: 150,
    vx: 0,
    vy: 0,
    pulando: false,
    noChao: true,
    atacando: false,
    vida_maxima: 5,
    vida_atual: 5, 
    dano: false, 
    cooldownDano: 0, 
    COOLDOWN_DANO_SEC: 1.0,
    // NOVO VALOR: Aumentado de -550 para -700 para um pulo maior
    PULO_FORCA: -700 
};

// === SLIME CONFIGURAÇÃO DE ANIMAÇÃO ===
const slimeAnimationConfig = {
    idle: { row: 0, total: 1 }, 
    pulo: { row: 2, total: 7 }, 
    morrendo: { row: 3, total: 8 } 
};

const slimeAnimationSpeed = {
    idle: 0.1, 
    pulo: 1 / 15, 
    morrendo: 1 / 10 
};

// === SLIMES (LISTA) ===
const slimes = []; 
const SLIME_SHEET_COLS = 8;
const SLIME_SHEET_ROWS = 4;
let SLIME_FRAME_W = 40; 
let SLIME_FRAME_H = 32; 

// === GERACAO DE SLIMES ===
let ultimaPosicaoSlimeGerado = 0;
const DISTANCIA_ENTRE_SLIMES_MIN = 300;
const DISTANCIA_ENTRE_SLIMES_MAX = 800;

// === BLOCOS ===
const blocos = [];

// === GERACAO DE BLOCOS - NOVAS CONSTANTES PARA VARIAÇÃO ===
let ultimaPosicaoBlocoGerado = 0;
const DISTANCIA_ENTRE_PLATAFORMAS_MIN = 200;
const DISTANCIA_ENTRE_PLATAFORMAS_MAX = 400;

const ALTURA_MAXIMA_CHAO = 3 * TAMANHO_BLOCO; 
const ALTURA_MEDIA_CHAO = 2 * TAMANHO_BLOCO;

// === ANIMAÇÃO PLAYER ===
let estadoAtual = "idle";
let estadoAnterior = "idle";
let frameIndex = 0;
let frameElapsed = 0; 
const frameDelayConfig = { 
    idle: 1 / 8, 
    corrida: 1 / 10, 
    ataque: 1 / 12, 
    pulo: 1 / 10 
};
const frameConfig = {
    idle: { largura: 64, altura: 128, total: 1 },
    corrida: { largura: 64, altura: 128, total: 7 },
    ataque: { largura: 128, altura: 128, total: 5 },
    pulo: { largura: 64, altura: 128, total: 6 }
};

// === LOOP PRINCIPAL ===
let lastTime = 0;
function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // NOVO: Verifica se o jogo está no estado GAME_OVER para permitir o restart
    if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.LEVEL_WON) {
        update(dt);
    } else if (gameState === GAME_STATE.GAME_OVER) {
        if (keys["p"] || keys["P"]) {
            reiniciarJogo();
        }
    }
    
    draw(); 

    requestAnimationFrame(gameLoop);
}

// === UPDATE MASTER ===
function update(dt) {
    if (player.cooldownDano > 0) {
        player.cooldownDano -= dt;
    }

    updatePlayer(dt);
    updateCamera(dt);
    updateSlimes(dt);
    updatePlayerAnimation(dt);
}

// ---------------------------------------------
// ## PLAYER
// ---------------------------------------------

function updatePlayer(dt) {
    player.vx = 0;
    
    // Se o jogo acabou, o player não se move
    if (gameState !== GAME_STATE.PLAYING) return;

    // LÓGICA DE ATAQUE
    if ((keys[" "] || keys["Space"]) && !player.atacando && player.noChao) {
        player.atacando = true;
        estadoAtual = "ataque";
        frameIndex = 0;
        frameElapsed = 0;
    }

    // LÓGICA DE MOVIMENTO
    if (!player.atacando) {
        if (keys["ArrowRight"] || keys["d"]) {
            player.vx = player.speed;
            estadoAtual = "corrida";
        } else if (keys["ArrowLeft"] || keys["a"]) {
            player.vx = -player.speed;
            estadoAtual = "corrida";
        } else if (!player.pulando) {
            estadoAtual = "idle";
        }

        // Lógica de pulo
        if ((keys["ArrowUp"] || keys["w"]) && player.noChao) {
            player.vy = player.PULO_FORCA; 
            player.pulando = true;
            player.noChao = false;
            estadoAtual = "pulo";
            frameIndex = 0;
            frameElapsed = 0;
        }
    }

    // 1. Aplicar GRAVIDADE e calcular VETOR DE MOVIMENTO
    player.vy += GRAVIDADE * dt;

    // 2. Movimento Vertical (Y) - Colisão mais robusta
    const nextY = player.y + player.vy * dt;
    let colidiuComBloco = false;

    // [COLISÃO COM BLOCOS FLUTUANTES]
    for (const bloco of blocos) {
        if (
            player.x < bloco.x + bloco.width && 
            player.x + player.width > bloco.x 
        ) {
            if (player.y + player.height <= bloco.y && nextY + player.height > bloco.y) {
                player.y = bloco.y - player.height; 
                player.vy = 0;
                player.pulando = false;
                player.noChao = true;
                colidiuComBloco = true;
                break;
            }
        }
    }

    // [COLISÃO COM CHÃO - CHAO_Y (Blocos Verdes)]
    if (!colidiuComBloco && nextY + player.height >= CHAO_Y) {
        player.y = CHAO_Y - player.height; 
        player.vy = 0;
        player.pulando = false;
        player.noChao = true;
        colidiuComBloco = true;
    } 
    
    // Se não houve colisão, aplica o movimento Y
    if (!colidiuComBloco) {
        player.y = nextY;
        if (player.y + player.height < CHAO_Y) player.noChao = false;
    }

    // 3. Movimento Horizontal (X)
    player.x += player.vx * dt;

    // [VERIFICA FIM DA FASE]
    if (player.x >= LEVEL_END_X) {
        gameState = GAME_STATE.LEVEL_WON;
        player.vx = 0; 
        player.vy = 0;
        player.x = LEVEL_END_X;
    } 
    
    // [VERIFICA GAME OVER]
    if (player.vida_atual <= 0) {
        gameState = GAME_STATE.GAME_OVER;
        player.vx = 0; 
        player.vy = 0;
    }
}

function updatePlayerAnimation(dt) {
    if (estadoAtual !== estadoAnterior) {
        frameIndex = 0;
        frameElapsed = 0;
        estadoAnterior = estadoAtual;
    }

    frameElapsed += dt;

    const delay = frameDelayConfig[estadoAtual];
    const totalFrames = frameConfig[estadoAtual].total;

    if (frameElapsed >= delay) {
        frameElapsed -= delay;
        frameIndex++;
        
        if (frameIndex >= totalFrames) {
            frameIndex = 0;
            if (estadoAtual === "ataque") {
                player.atacando = false;
                estadoAtual = player.vx !== 0 ? "corrida" : "idle";
            }
        }
    }
}


// ---------------------------------------------
// ## SLIMES (GERENCIAMENTO DE MÚLTIPLOS)
// ---------------------------------------------

function updateSlimes(dt) {
    for (const s of slimes) { 
        if (!s.ativo && !s.morrendo) continue; 

        updateSingleSlimeBehavior(s, dt); 
        updateSingleSlimeAnimation(s, dt);

        // 1. Aplicar GRAVIDADE e calcular VETOR DE MOVIMENTO
        if (!s.morrendo) {
            s.vy += GRAVIDADE * dt;
        }

        const nextY = s.y + s.vy * dt;
        let colidiuComBloco = false;

        // [COLISÃO COM BLOCOS FLUTUANTES PARA SLIMES]
        for (const bloco of blocos) {
            if (
                s.x < bloco.x + bloco.width &&
                s.x + s.width > bloco.x 
            ) {
                if (s.y + s.height <= bloco.y && nextY + s.height > bloco.y) {
                    s.y = bloco.y - s.height;
                    s.vy = 0;
                    s.estado = "idle";
                    colidiuComBloco = true;
                    break;
                }
            }
        }
        
        // [COLISÃO COM CHÃO PARA SLIMES (CHAO_Y)]
        if (!s.morrendo && !colidiuComBloco && nextY + s.height >= CHAO_Y) {
            s.y = CHAO_Y - s.height;
            s.vy = 0;
            s.estado = "idle";
            colidiuComBloco = true;
        }

        // Aplica o movimento Y se não houve colisão
        if (!colidiuComBloco) {
            s.y = nextY;
        }


        // Lógica de colisão PLAYER vs SLIME (ataque do player no slime)
        if (player.atacando && frameIndex === 3 && !s.morrendo) {
            
            const colide =
                player.x < s.x + s.width &&
                player.x + frameConfig.ataque.largura > s.x && 
                player.y < s.y + s.height && 
                player.y + player.height > s.y; 

            if (colide) {
                s.vida--;
                
                if (s.vida <= 0) {
                    s.morrendo = true;
                    s.estado = "morrendo"; 
                    s.frameIndex = 0;  
                    s.frameTime = 0; 

                    // NOVO: Cura ao derrotar o Slime
                    if (player.vida_atual < player.vida_maxima) {
                        player.vida_atual += 1;
                    }
                }
            }
        }

        // Lógica de colisão SLIME vs PLAYER (dano no player)
        if (!s.morrendo && player.cooldownDano <= 0 && gameState === GAME_STATE.PLAYING) {
            
            const colideComPlayer =
                s.x < player.x + player.width &&
                s.x + s.width > player.x && 
                s.y < player.y + player.height && 
                s.y + s.height > player.y; 

            if (colideComPlayer) {
                player.vida_atual -= 1; // Slime causa 1 de dano
                player.cooldownDano = player.COOLDOWN_DANO_SEC; // Ativa o "i-frames"

                // Efeito de repulsão (knockback)
                player.vy = -300; 
                player.vx = (player.x > s.x) ? 150 : -150; 
            }
        }
    }

    // Remoção de slimes
    for (let i = slimes.length - 1; i >= 0; i--) {
        if ((slimes[i].x + worldOffsetX + slimes[i].width < -100) || (!slimes[i].ativo && slimes[i].morrendo)) {
            slimes.splice(i, 1);
        }
    }
}

function updateSingleSlimeBehavior(s, dt) {
    if (s.morrendo) return;

    s.jumpTimer += dt;
    if (s.jumpTimer >= s.jumpInterval && s.estado === "idle") { 
        s.jumpTimer = 0; 
        s.estado = "pulo";
        s._jumpElapsed = 0; 
        s.frameIndex = 0; 
        s.frameTime = 0; 
        s.vy = -s.jumpHeight * 20; 
    }
}

function updateSingleSlimeAnimation(s, dt) {
    if (!s.ativo) return; 

    if (s.estado !== "idle") {
        const config = slimeAnimationConfig[s.estado];
        const delay = slimeAnimationSpeed[s.estado];
        
        s.frameTime += dt;
        if (s.frameTime >= delay) { 
            s.frameTime -= delay;
            s.frameIndex++;

            if (s.frameIndex >= config.total) { 
                
                if (s.estado === "morrendo") {
                    s.frameIndex = config.total - 1; 
                    s.ativo = false;
                } else if (s.estado === "pulo") {
                    s.frameIndex = config.total - 1; 
                } else {
                    s.frameIndex = 0;
                }
            }
        }
    } else {
        s.frameIndex = 0;
        s.frameTime = 0; 
    }
}

// ---------------------------------------------
// ## GERADORES DE MUNDO
// ---------------------------------------------

function gerarBlocos(cameraXDoPlayerNoMundo) {
    const limeteGeracao = cameraXDoPlayerNoMundo + canvas.width + TAMANHO_BLOCO * 2; 

    while (ultimaPosicaoBlocoGerado < limeteGeracao) {
        const espaco = Math.random() * (DISTANCIA_ENTRE_PLATAFORMAS_MAX - DISTANCIA_ENTRE_PLATAFORMAS_MIN) + DISTANCIA_ENTRE_PLATAFORMAS_MIN;
        ultimaPosicaoBlocoGerado += espaco;
        
        const tipoBloco = Math.random(); 
        
        let bloco = null;

        if (tipoBloco < 0.4) {
            // TIPO 1: Plataforma Pequena/Chão Elevado (40%)
            bloco = {
                x: ultimaPosicaoBlocoGerado,
                y: CHAO_Y - TAMANHO_BLOCO, 
                width: TAMANHO_BLOCO,
                height: TAMANHO_BLOCO
            };
        } else if (tipoBloco < 0.7) {
            // TIPO 2: Plataforma Média/Larga (30%)
            const alturaMedia = CHAO_Y - ALTURA_MEDIA_CHAO; // 2 blocos de altura
            bloco = {
                x: ultimaPosicaoBlocoGerado,
                y: alturaMedia,
                width: TAMANHO_BLOCO * 3, // 3 blocos de largura
                height: TAMANHO_BLOCO
            };
        } else {
            // TIPO 3: Plataforma Alta (Pulo de Precisão) (30%)
            const alturaMaxima = CHAO_Y - ALTURA_MAXIMA_CHAO; // 3 blocos de altura
            bloco = {
                x: ultimaPosicaoBlocoGerado,
                y: alturaMaxima,
                width: TAMANHO_BLOCO * 2, // 2 blocos de largura
                height: TAMANHO_BLOCO
            };
        }

        if (bloco) {
            blocos.push(bloco);
        }
    }

    for (let i = blocos.length - 1; i >= 0; i--) {
        if (blocos[i].x + worldOffsetX + blocos[i].width < -100) { 
            blocos.splice(i, 1);
        }
    }
}

function gerarSlimes(cameraXDoPlayerNoMundo) {
    const limeteGeracao = cameraXDoPlayerNoMundo + canvas.width + 400; 

    while (ultimaPosicaoSlimeGerado < limeteGeracao) {
        const espaco = Math.random() * (DISTANCIA_ENTRE_SLIMES_MAX - DISTANCIA_ENTRE_SLIMES_MIN) + DISTANCIA_ENTRE_SLIMES_MIN;
        ultimaPosicaoSlimeGerado += espaco;
        
        let spawnY = CHAO_Y - TAMANHO_BLOCO; 
        let spawnX = ultimaPosicaoSlimeGerado;

        if (Math.random() < 0.5 && blocos.length > 0) {
            const blocosCandidatos = blocos.filter(b => 
                b.x > cameraXDoPlayerNoMundo && 
                b.x < ultimaPosicaoSlimeGerado &&
                b.y < CHAO_Y - TAMANHO_BLOCO * 1.5 
            );

            if (blocosCandidatos.length > 0) {
                const blocoAleatorio = blocosCandidatos[Math.floor(Math.random() * blocosCandidatos.length)];
                spawnX = blocoAleatorio.x + blocoAleatorio.width / 2 - TAMANHO_BLOCO / 2; 
                spawnY = blocoAleatorio.y - TAMANHO_BLOCO; 
            }
        }
        
        slimes.push({
            x: spawnX,
            y: spawnY,
            width: TAMANHO_BLOCO,
            height: TAMANHO_BLOCO,
            vida: 3, ativo: true, morrendo: false, estado: "idle",
            jumpTimer: 0, 
            jumpInterval: 2.5 + Math.random() * 1.5, 
            _jumpElapsed: 0, 
            jumpDuration: 0.6, 
            jumpHeight: 20, 
            vy: 0, 
            frameIndex: 0, frameTime: 0,
            sheetCols: SLIME_SHEET_COLS, sheetRows: SLIME_SHEET_ROWS, 
            frameW: SLIME_FRAME_W, frameH: SLIME_FRAME_H
        });
    }
}

// ---------------------------------------------
// ## CÂMERA / PARALLAX
// ---------------------------------------------

function updateCamera(dt) {
    const playerDisplacement = player.vx * dt; 

    if (playerDisplacement !== 0) {
        worldOffsetX -= playerDisplacement;
        
        fundoX += playerDisplacement * LAYER_SPEED.fundo; 
        meioX += playerDisplacement * LAYER_SPEED.meio;
    }

    fundoX = loopValor(fundoX, imagens.fundo.width);
    meioX = loopValor(meioX, imagens.meio.width);

    gerarBlocos(player.x);
    gerarSlimes(player.x);
}

// ---------------------------------------------
// ## DRAW
// ---------------------------------------------

function drawLayer(img, offsetX, y, heightOverride) {
    if (!img.complete || img.naturalWidth === 0) return;
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
        ctx.fillRect(player.x + worldOffsetX, player.y, player.width, player.height);
        return;
    }

    let alfa = 1.0;
    if (player.cooldownDano > 0) {
        alfa = (Math.floor(player.cooldownDano * 10) % 2 === 0) ? 0.3 : 1.0;
    }
    
    ctx.globalAlpha = alfa;

    const config = frameConfig[estadoAtual];
    const sx = frameIndex * config.largura;
    ctx.drawImage(sprite, sx, 0, config.largura, config.altura, player.x + worldOffsetX, player.y, player.width, player.height);
    
    ctx.globalAlpha = 1.0; 
}

function drawBlocos() {
    for (const bloco of blocos) {
        const blocoScreenX = bloco.x + worldOffsetX;
        
        if (blocoScreenX + bloco.width > 0 && blocoScreenX < canvas.width) {
            
            if (bloco.y < CHAO_Y - bloco.height) {
                ctx.fillStyle = "#A0522D"; 
            } else {
                ctx.fillStyle = "#38761D"; 
            }
            
            ctx.fillRect(blocoScreenX, bloco.y, bloco.width, bloco.height);

            ctx.strokeStyle = "#444444";
            ctx.lineWidth = 2;
            ctx.strokeRect(blocoScreenX, bloco.y, bloco.width, bloco.height);
        }
    }
}

function drawSlimes() {
    for (const s of slimes) {
        if (!s.ativo && !s.morrendo) continue;

        const slimeY = s.y; 
        const slimeScreenX = s.x + worldOffsetX;

        if (slimeScreenX + s.width > 0 && slimeScreenX < canvas.width) {
            if (!imagens.slime.complete || imagens.slime.naturalWidth === 0) {
                ctx.fillStyle = "purple";
                ctx.fillRect(slimeScreenX, slimeY, s.width, s.height);
            } else {
                const row = slimeAnimationConfig[s.estado].row; 
                const col = s.frameIndex; 
                const sx = col * s.frameW;
                const sy = row * s.frameH;

                ctx.drawImage(imagens.slime, sx, sy, s.frameW, s.frameH, slimeScreenX, slimeY, s.width, s.height);
            }

            if (!s.morrendo) {
                ctx.fillStyle = "red";
                ctx.fillRect(slimeScreenX, slimeY - 10, s.width, 5); 
                ctx.fillStyle = "lime";
                const vidaWidth = (s.width * Math.max(0, s.vida)) / 3;
                ctx.fillRect(slimeScreenX, slimeY - 10, vidaWidth, 5); 
            }
        }
    }
}

function drawHUD() {
    const BARRA_X = 20;
    const BARRA_Y = 20;
    const BARRA_W = 150;
    const BARRA_H = 20;
    const VIDA_MAX = player.vida_maxima;
    const VIDA_ATUAL = player.vida_atual;
    
    ctx.fillStyle = "#555555";
    ctx.fillRect(BARRA_X, BARRA_Y, BARRA_W, BARRA_H);
    
    const vidaPreenchida = (VIDA_ATUAL / VIDA_MAX) * BARRA_W;
    ctx.fillStyle = "red";
    ctx.fillRect(BARRA_X, BARRA_Y, vidaPreenchida, BARRA_H);
    
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(BARRA_X, BARRA_Y, BARRA_W, BARRA_H);

    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`HP: ${VIDA_ATUAL} / ${VIDA_MAX}`, BARRA_X + 5, BARRA_Y + 15);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawLayer(imagens.fundo, fundoX, 0, CHAO_Y);
    drawLayer(imagens.meio, meioX, CHAO_Y - 224, 224);
    
    const fimScreenX = LEVEL_END_X + worldOffsetX;
    if (fimScreenX < canvas.width && fimScreenX > 0) {
        ctx.strokeStyle = "gold";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(fimScreenX, 0);
        ctx.lineTo(fimScreenX, canvas.height);
        ctx.stroke();
        
        ctx.fillStyle = "gold";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("FIM DA FASE", fimScreenX, 30);
    }
    
    ctx.fillStyle = "green"; 
    ctx.fillRect(0, CHAO_Y, canvas.width, 80);

    drawBlocos(); 
    drawPlayer();
    drawSlimes(); 
    
    drawHUD();
    
    if (gameState === GAME_STATE.LEVEL_WON) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = "center";
        ctx.font = "48px Arial";
        ctx.fillStyle = "white";
        ctx.fillText("FASE CONCLUÍDA!", canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.font = "24px Arial";
        ctx.fillStyle = "yellow";
        ctx.fillText("Parabéns, você alcançou o fim!", canvas.width / 2, canvas.height / 2 + 30);
    }

    if (gameState === GAME_STATE.GAME_OVER) {
        ctx.fillStyle = "rgba(100, 0, 0, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = "center";
        ctx.font = "60px Impact";
        ctx.fillStyle = "red";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.font = "20px Arial";
        ctx.fillStyle = "white";
        ctx.fillText("Pressione 'P' para Reiniciar", canvas.width / 2, canvas.height / 2 + 30);
    }
}

// === AUXILIAR ===
function loopValor(val, mod) { 
    if (mod <= 0) return 0;
    return ((val % mod) + mod) % mod; 
}

// ---------------------------------------------
// ## FUNÇÃO DE REINICIAR O JOGO
// ---------------------------------------------
function reiniciarJogo() {
    // Reseta o estado do jogo
    gameState = GAME_STATE.PLAYING;
    
    // Reseta as variáveis do player
    player.x = 100;
    player.y = CHAO_Y - player.height;
    player.vx = 0;
    player.vy = 0;
    player.vida_atual = player.vida_maxima; // Restaura a vida
    
    // Reseta o mundo e a câmera
    worldOffsetX = (canvas.width / 2) - player.x - (player.width / 2);
    fundoX = 0;
    meioX = 0;
    
    // Limpa e regenera os blocos e slimes
    blocos.length = 0;
    slimes.length = 0;
    ultimaPosicaoBlocoGerado = player.x;
    ultimaPosicaoSlimeGerado = player.x; 

    gerarBlocos(player.x);
    gerarSlimes(player.x);
    
    console.log("Jogo Reiniciado!");
}


// === CONTROLES ===
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// === CARREGAMENTO ===
const todasImagens = [imagens.fundo, imagens.meio, imagens.slime, sprites.idle, sprites.corrida, sprites.ataque, sprites.pulo];

let carregadas = 0;
function imagemCarregada() {
    carregadas++;
    if (carregadas === todasImagens.length) {
        iniciarJogo();
    }
}

function iniciarJogo() {
    // Inicialização do mundo e player (chamado no início e no restart)
    player.y = CHAO_Y - player.height;

    worldOffsetX = (canvas.width / 2) - player.x - (player.width / 2);

    if (imagens.slime.naturalWidth > 0) {
        SLIME_FRAME_W = Math.floor(imagens.slime.naturalWidth / SLIME_SHEET_COLS); 
        SLIME_FRAME_H = Math.floor(imagens.slime.naturalHeight / SLIME_SHEET_ROWS);
    }

    ultimaPosicaoBlocoGerado = player.x; 
    gerarBlocos(player.x);
    gerarSlimes(player.x); 

    requestAnimationFrame(gameLoop);
}

todasImagens.forEach(img => {
    img.onload = imagemCarregada;

    if (img.complete && img.naturalWidth > 0) {
        imagemCarregada();
    }
});