window.addEventListener('load', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;

    // --- ASSETS / IMAGENS ---
    const images = {};
    const imageSources = {
        playerWalk: 'Walk.png',
        playerJump: 'Jump.png',
        playerAttack1: 'Attack 1.png', // Novo!
        // Adicionaremos mais animações conforme necessário
        background: 'country-platform-back.png',
        // --- PREENCHA COM OS NOMES DOS SEUS ARQUIVOS ---
        slimeSprite: 'slime.png', // Você precisará de um sprite para o slime
        fireballSprite: 'fireball.png' // E um para a bola de fogo azul
    };

    let imagesLoaded = 0;
    const numImages = Object.keys(imageSources).length;
    let gameReady = false;

    for (const key in imageSources) {
        images[key] = new Image();
        images[key].src = imageSources[key];
        images[key].onload = () => {
            imagesLoaded++;
            if (imagesLoaded === numImages) {
                gameReady = true;
                animate(0);
            }
        };
        // Lida com erro caso uma imagem não seja encontrada
        images[key].onerror = () => {
            console.error(`Erro ao carregar a imagem: ${imageSources[key]}`);
            imagesLoaded++;
            if (imagesLoaded === numImages) {
                gameReady = true;
                animate(0);
            }
        }
    }

    // --- CONTROLE DE TECLADO ---
    const input = {
        keys: {},
        init() {
            window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
            window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
        }
    };
    input.init();
    
    // --- CONSTANTES DO JOGO ---
    const GRAVITY = 0.5;

    // --- ESTRUTURA DE ENTIDADES ---

    class Player {
        constructor() {
            this.width = 80;
            this.height = 80;
            this.x = canvas.width / 2 - this.width / 2;
            this.y = canvas.height - this.height - 100;
            this.speed = 5;
            this.vy = 0; // Velocidade vertical
            this.jumpStrength = -15;
            this.onGround = false;

            // Sistema de Combate
            this.isAttacking = false;
            this.attackCooldown = 500; // 0.5 segundos
            this.lastAttackTime = 0;
            this.killCount = 0;

            // Animação
            this.frameWidth = 80; // Supondo que os frames de ataque também são 80x80
            this.frameHeight = 80;
            this.currentFrame = 0;
            this.frameTimer = 0;
            this.frameInterval = 100; // 10 fps
            this.state = 'idle'; // Estados: 'idle', 'walking', 'jumping', 'attacking'
            this.animations = {
                walk: { spriteSheet: images.playerWalk, frameCount: 8 },
                attack1: { spriteSheet: images.playerAttack1, frameCount: 5 },
                jump: { spriteSheet: images.playerJump, frameCount: 6 }
            };
            this.currentAnimation = this.animations.walk;
        }

        update(deltaTime, currentTime) {
            // Movimento Horizontal
            if (input.keys['a'] || input.keys['arrowleft']) {
                this.x -= this.speed;
            } else if (input.keys['d'] || input.keys['arrowright']) {
                this.x += this.speed;
            }

            // Pulo
            if ((input.keys['w'] || input.keys['arrowup'] || input.keys[' ']) && this.onGround) {
                this.vy = this.jumpStrength;
                this.onGround = false;
            }

            // Aplicar Gravidade
            this.vy += GRAVITY;
            this.y += this.vy;
            this.onGround = false; // Assume que está no ar até que a colisão prove o contrário

            // Ataque Normal (usando a tecla 'j')
            if (input.keys['j'] && !this.isAttacking && (currentTime - this.lastAttackTime > this.attackCooldown)) {
                this.isAttacking = true;
                this.lastAttackTime = currentTime;
                this.state = 'attacking';
                this.currentFrame = 0; // Reinicia a animação de ataque
                
                // Lógica da hitbox do ataque
                const hitboxX = this.x + this.width / 2;
                const hitboxY = this.y;
                checkAttackCollision(hitboxX, hitboxY, 100, this.height);
            }
            
            // Ataque Especial (usando a tecla 'v')
            if (input.keys['v'] && this.killCount >= 5) {
                this.killCount = 0; // Consome os pontos
                // Cria uma bola de fogo na posição do jogador
                projectiles.push(new BlueFireball(this.x + this.width, this.y + this.height / 2));
            }


            // Limites da tela (horizontal)
            if (this.x < 0) this.x = 0;
            if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;

            // Atualizar Animação
            this.updateAnimation(deltaTime);
        }
        
        updateAnimation(deltaTime) {
            // Define o estado atual
            if (this.isAttacking) {
                this.state = 'attacking';
                this.currentAnimation = this.animations.attack1;
            } else if (!this.onGround) {
                this.state = 'jumping';
                this.currentAnimation = this.animations.jump;
            } else {
                this.state = 'walking'; // Usando 'walk' como base
                this.currentAnimation = this.animations.walk;
            }

            // Atualiza o frame
            this.frameTimer += deltaTime;
            if (this.frameTimer > this.frameInterval) {
                this.frameTimer = 0;
                this.currentFrame++;
                if (this.currentFrame >= this.currentAnimation.frameCount) {
                    this.currentFrame = 0;
                    // Se a animação de ataque terminou, volta ao estado normal
                    if (this.isAttacking) {
                        this.isAttacking = false;
                    }
                }
            }
        }

        draw(context) {
            if (!this.currentAnimation.spriteSheet) return; // Não desenha se a imagem não carregou
            
            const sx = this.currentFrame * this.frameWidth;
            const sy = 0;

            context.drawImage(
                this.currentAnimation.spriteSheet,
                sx, sy, this.frameWidth, this.frameHeight,
                this.x, this.y, this.width, this.height
            );
        }
    }

    class Platform {
        constructor(x, y, width) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = 20;
        }

        draw(context) {
            context.fillStyle = '#6d4c41';
            context.fillRect(this.x, this.y, this.width, this.height);
        }
    }
    
    class Slime {
        constructor(x, y) {
            this.width = 50;
            this.height = 50;
            this.x = x;
            this.y = y;
            this.markedForDeletion = false;
        }

        draw(context) {
            // Provisório: usa um retângulo verde
            context.fillStyle = 'green';
            context.fillRect(this.x, this.y, this.width, this.height);
        }
    }
    
    class BlueFireball {
        constructor(x, y) {
            this.width = 40;
            this.height = 20;
            this.x = x;
            this.y = y;
            this.speed = 10;
            this.markedForDeletion = false;
        }

        update() {
            this.x += this.speed;
            if (this.x > canvas.width) this.markedForDeletion = true;
        }

        draw(context) {
            // Provisório: usa um retângulo azul
            context.fillStyle = 'cyan';
            context.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    // --- LÓGICA DO JOGO ---
    const player = new Player();
    let platforms = [];
    let slimes = [];
    let projectiles = [];
    let cameraY = 0;
    let lodoY = canvas.height + 100;
    let lodoSpeed = 0.05;
    let gameOver = false;

    // Função para gerar as plataformas iniciais
    function initPlatforms() {
        platforms.push(new Platform(canvas.width / 2 - 150, canvas.height - 50, 300));
        for (let i = 1; i < 20; i++) {
            const y = canvas.height - 50 - i * 120;
            const x = Math.random() * (canvas.width - 200);
            const width = Math.random() * 100 + 100;
            platforms.push(new Platform(x, y, width));
            
            // 30% de chance de gerar um slime em uma plataforma
            if (Math.random() < 0.3) {
                slimes.push(new Slime(x + width/2 - 25, y - 50));
            }
        }
    }
    initPlatforms();

    // --- FUNÇÕES DE COLISÃO ---
    function checkAABBCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }
    
    function checkAttackCollision(x, y, width, height) {
        const attackHitbox = { x, y, width, height };
        slimes.forEach(slime => {
            if (checkAABBCollision(attackHitbox, slime)) {
                slime.markedForDeletion = true;
                player.killCount++;
            }
        });
    }

    // --- LOOP DE ANIMAÇÃO ---
    let lastTime = 0;
    function animate(timestamp) {
        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0,0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = '50px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2);
            return;
        }
        
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Salva o estado do canvas e aplica a translação da câmera
        ctx.save();
        ctx.translate(0, -cameraY);

        update(deltaTime, timestamp);
        draw(ctx);
        
        // Restaura o estado do canvas
        ctx.restore();
        
        // Desenha elementos da UI (HUD) que não se movem com a câmera
        drawHUD(ctx);

        requestAnimationFrame(animate);
    }

    function update(deltaTime, timestamp) {
        player.update(deltaTime, timestamp);

        // Lógica da "Câmera" - Mantém o jogador na metade inferior da tela
        if (player.y < cameraY + canvas.height / 2) {
            cameraY = player.y - canvas.height / 2;
        }

        // Colisão do Jogador com Plataformas
        platforms.forEach(platform => {
            if (
                player.x < platform.x + platform.width &&
                player.x + player.width > platform.x &&
                player.y + player.height > platform.y &&
                player.y + player.height < platform.y + platform.height &&
                player.vy > 0 // Só colide se estiver caindo
            ) {
                player.onGround = true;
                player.vy = 0;
                player.y = platform.y - player.height;
            }
        });

        // Atualiza Projéteis e checa colisão com slimes
        projectiles.forEach(p => {
            p.update();
            slimes.forEach(slime => {
                if (checkAABBCollision(p, slime)) {
                    p.markedForDeletion = true;
                    slime.markedForDeletion = true;
                    // Ataque especial não conta para a próxima carga
                }
            });
        });

        // Atualiza o Lodo
        lodoY -= lodoSpeed * deltaTime;
        if (player.y > lodoY - cameraY) {
            gameOver = true;
        }

        // Remove entidades marcadas para exclusão
        slimes = slimes.filter(s => !s.markedForDeletion);
        projectiles = projectiles.filter(p => !p.markedForDeletion);
    }

    function draw(context) {
        // Desenha o fundo (fixo em relação à câmera)
        context.drawImage(images.background, 0, cameraY, canvas.width, canvas.height);

        platforms.forEach(platform => platform.draw(context));
        slimes.forEach(slime => slime.draw(context));
        projectiles.forEach(p => p.draw(context));
        player.draw(context);
        
        // Desenha o lodo
        context.fillStyle = 'darkgreen';
        context.fillRect(0, lodoY, canvas.width, canvas.height);
    }
    
    function drawHUD(context) {
        context.fillStyle = 'white';
        context.font = '24px Courier New';
        context.textAlign = 'left';
        context.fillText(`Inimigos Derrotados: ${player.killCount}`, 10, 30);
        
        // Barra de especial
        context.fillText('Especial (V):', 10, 70);
        context.fillStyle = '#555';
        context.fillRect(10, 80, 200, 20);
        if (player.killCount > 0) {
            context.fillStyle = 'cyan';
            const specialWidth = Math.min(player.killCount / 5, 1) * 200;
            context.fillRect(10, 80, specialWidth, 20);
        }
    }
});