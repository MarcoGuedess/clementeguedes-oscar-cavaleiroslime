window.addEventListener('load', function () {
    // ===================================
    // CONFIGURAÇÃO INICIAL
    // ===================================
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1280;
    canvas.height = 720;

    // ===================================
    // CONSTANTES
    // ===================================
    const GRAVITY = 0.7;
    const WALK_TO_RUN_TIME = 1000;
    const WALK_AFTER_STOP_TIME = 500;
    const TILE_SIZE = 64;

    // ===================================
    // CARREGAMENTO DE ASSETS
    // ===================================
    const imageSources = {
        playerWalk: 'Walk.png',
        playerRun: 'Run.png',
        playerJump: 'Jump.png',
        playerHurt: 'Hurt.png',
        playerDead: 'Dead.png',
        playerAttack1: 'Attack 1.png',
        playerAttack2: 'Attack 2.png',
        playerAttack3: 'Attack 3.png',
        playerRunAttack: 'Run+Attack.png',
        fireballSheet: 'fireball-spritesheet.png',
        spikes: '68.png',
        water: '63.png',
        apple: '85.png',
        star: '84.png',
        slimeSheet: 'slime_monster_spritesheet.png',
        flagSheet: 'flags.png',
        world1Tileset: 'A_World_01.png',
        world2Tileset: 'A_World_02.png',
        world3Tileset: 'A_World_03.png',
        world4Tileset: 'A_World_04.png',
        background1: 'country-platform-back.png',
        background2: 'country-platform-forest.png',
    };



    const audioSources = {
        swordAttack: 'sword sound.wav',
        slimeJump: 'slime_jump.wav',
        ambience1: 'amb_bird_1.flac',
        ambience2: 'amb_bird_2.flac',
    };



    let images = {};
    let imagesLoaded = 0;
    const numImages = Object.keys(imageSources).length;
    for (const key in imageSources) {
        images[key] = new Image();
        images[key].src = imageSources[key];
        images[key].onload = () => imagesLoaded++;
        images[key].onerror = () => {
            console.error(`ERRO AO CARREGAR: ${imageSources[key]}`);
            imagesLoaded++;


        }
    }

    // ===================================
    // UTILITÁRIOS
    // ===================================
    /**
     * Verifica a colisão entre dois retângulos (Axis-Aligned Bounding Box).
     * @param {object} rect1 - O primeiro retângulo {x, y, width, height}.
     * @param {object} rect2 - O segundo retângulo {x, y, width, height}.
     * @returns {boolean} - Retorna true se houver colisão, caso contrário, false.
     */
    function checkAABBCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    /**
     * Verifica se uma entidade está dentro da área visível da câmera, com uma margem.
     * @param {object} entity - A entidade a ser verificada {x, width}.
     * @param {number} cameraX - A posição X da câmera.
     * @param {number} screenWidth - A largura da tela.
     * @param {number} [margin=200] - Uma margem extra para carregar entidades um pouco fora da tela.
     * @returns {boolean} - Retorna true se a entidade estiver na tela, caso contrário, false.
     */
    function isOnScreen(entity, cameraX, screenWidth, margin = 200) {
        return (
            entity.x + entity.width > cameraX - margin &&
            entity.x < cameraX + screenWidth + margin
        );
    }

    // ===================================
    // SISTEMA DE PARTÍCULAS
    // ===================================
    class Particle {
        constructor() {
            this.x = 0; this.y = 0;
            this.vx = 0; this.vy = 0;
            this.life = 1;
            this.maxLife = 1;
            this.color = '#fff';
            this.size = 2;
            this.active = false;
        }

        /**
         * Ativa e configura uma partícula com novas propriedades.
         * @param {number} x - Posição inicial X.
         * @param {number} y - Posição inicial Y.
         * @param {number} vx - Velocidade inicial no eixo X.
         * @param {number} vy - Velocidade inicial no eixo Y.
         * @param {number} life - Duração da partícula em milissegundos.
         * @param {string} color - Cor da partícula.
         * @param {number} size - Tamanho da partícula.
         */
        spawn(x, y, vx, vy, life, color, size) {
            this.x = x; this.y = y;
            this.vx = vx; this.vy = vy;
            this.life = this.maxLife = life;
            this.color = color;
            this.size = size;
            this.active = true;
        }

        /**
         * Atualiza a posição e o tempo de vida da partícula.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         */
        update(deltaTime) {
            if (!this.active) return;
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.2;
            this.life -= deltaTime;
            if (this.life <= 0) this.active = false;
        }

        /**
         * Desenha a partícula no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            if (!this.active) return;
            const alpha = this.life / this.maxLife;
            context.globalAlpha = alpha;
            context.fillStyle = this.color;
            context.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size);
            context.globalAlpha = 1;
        }
    }

    class ParticleSystem {
        /**
         * Cria um sistema de partículas com um pool de objetos reutilizáveis.
         * @param {number} [poolSize=150] - O número máximo de partículas que podem existir ao mesmo tempo.
         */
        constructor(poolSize = 150) {
            this.particles = [];
            for (let i = 0; i < poolSize; i++) {
                this.particles.push(new Particle());
            }
        }

        /**
         * Emite um número de partículas a partir de uma posição.
         * @param {number} x - Posição X da emissão.
         * @param {number} y - Posição Y da emissão.
         * @param {number} count - Número de partículas a serem emitidas.
         * @param {object} [config={}] - Configurações para as partículas (cor, tamanho, vida, etc.).
         */
        emit(x, y, count, config = {}) {
            const {
                color = '#ff6b6b',
                size = 3,
                life = 500,
                speedRange = 3
            } = config;

            for (let i = 0; i < count; i++) {
                const particle = this.particles.find(p => !p.active);
                if (!particle) break;

                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * speedRange + 1;
                particle.spawn(
                    x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed - 2,
                    life, color, size
                );
            }
        }

        /**
         * Atualiza todas as partículas ativas no sistema.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         */
        update(deltaTime) {
            this.particles.forEach(p => p.update(deltaTime));
        }

        /**
         * Desenha todas as partículas ativas no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            this.particles.forEach(p => p.draw(context));
        }
    }

    // ===================================
    // SCREEN SHAKE
    // ===================================
    class ScreenShake {
        constructor() {
            this.duration = 0;
            this.intensity = 0;
            this.x = 0;
            this.y = 0;
        }

        /**
         * Inicia um efeito de tremor de tela.
         * @param {number} [duration=200] - A duração do tremor em milissegundos.
         * @param {number} [intensity=5] - A intensidade (deslocamento máximo) do tremor.
         */
        shake(duration = 200, intensity = 5) {
            this.duration = duration;
            this.intensity = intensity;
        }

        /**
         * Atualiza a duração e a intensidade do tremor a cada frame.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         */
        update(deltaTime) {
            if (this.duration <= 0) {
                this.x = 0;
                this.y = 0;
                return;
            }

            this.duration -= deltaTime;
            const progress = this.duration / 200;
            const currentIntensity = this.intensity * progress;

            this.x = (Math.random() - 0.5) * currentIntensity * 2;
            this.y = (Math.random() - 0.5) * currentIntensity * 2;
        }

        /**
         * Aplica o deslocamento do tremor ao contexto do canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        apply(context) {
            context.translate(Math.floor(this.x), Math.floor(this.y));
        }
    }

    // ===================================
    // TRAIL RENDERER
    // ===================================
    class TrailRenderer {
        /**
         * Cria um renderizador de rastro para efeitos de movimento.
         * @param {number} [maxTrails=10] - O número máximo de segmentos de rastro.
         */
        constructor(maxTrails = 10) {
            this.trails = [];
            this.maxTrails = maxTrails;
        }

        /**
         * Adiciona um novo segmento de rastro na posição atual de uma entidade.
         * @param {object} entity - A entidade que está deixando o rastro.
         */
        addTrail(entity) {
            this.trails.push({
                x: entity.x,
                y: entity.y,
                width: entity.width,
                height: entity.height,
                alpha: 1,
                facingDirection: entity.facingDirection
            });

            if (this.trails.length > this.maxTrails) {
                this.trails.shift();
            }
        }

        /**
         * Atualiza a opacidade e remove os segmentos de rastro antigos.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         */
        update(deltaTime) {
            for (let i = this.trails.length - 1; i >= 0; i--) {
                this.trails[i].alpha -= deltaTime / 150;
                if (this.trails[i].alpha <= 0) {
                    this.trails.splice(i, 1);
                }
            }
        }

        /**
         * Desenha todos os segmentos de rastro no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            this.trails.forEach(trail => {
                context.globalAlpha = trail.alpha * 0.3;
                context.fillStyle = '#4ecdc4';
                context.fillRect(
                    Math.floor(trail.x),
                    Math.floor(trail.y),
                    trail.width,
                    trail.height
                );
            });
            context.globalAlpha = 1;
        }
    }

    // ===================================
    // INPUT HANDLER
    // ===================================
    class InputHandler {
        /**
         * Gerencia as entradas do teclado, mantendo um registro das teclas pressionadas.
         */
        constructor() {
            this.keys = new Set();
            console.log('🎹 InputHandler criado!');

            document.addEventListener('keydown', (e) => {
                const key = e.key.toLowerCase();
                this.keys.add(key);
                console.log('⬇️ Tecla:', key, '| Total:', this.keys.size);
            });

            document.addEventListener('keyup', (e) => {
                const key = e.key.toLowerCase();
                this.keys.delete(key);
                console.log('⬆️ Soltou:', key);
            });

            console.log('✅ Listeners registrados!');
        }
    }

    // ===================================
    // AUDIO MANAGER (NOVA CLASSE)
    // ===================================
    class AudioManager {
        constructor() {
            this.sounds = {};
        }

        /**
         * Carrega um arquivo de áudio e o associa a um nome.
         * @param {string} name - O nome para identificar o som.
         * @param {string} src - O caminho para o arquivo de áudio.
         */
        load(name, src) {
            this.sounds[name] = new Audio(src);
        }

        /**
         * Toca um som carregado.
         * @param {string} name - O nome do som a ser tocado.
         * @param {number} [volume=1.0] - O volume do som (0.0 a 1.0).
         */
        play(name, volume = 1.0) {
            const sound = this.sounds[name];
            if (sound) {
                sound.currentTime = 0; // Reinicia o som para que possa ser tocado em rápida sucessão
                sound.volume = volume;
                sound.play();
            }
        }

        /**
         * Toca um som carregado em loop.
         * @param {string} name - O nome do som a ser tocado.
         * @param {number} [volume=1.0] - O volume do som (0.0 a 1.0).
         */
        loop(name, volume = 1.0) {
            const sound = this.sounds[name];
            if (sound) {
                sound.loop = true;
                sound.volume = volume;
                sound.play();
            }
        }
    }

    // Instancia o gerenciador de áudio depois da definição da classe
    const audioManager = new AudioManager();
    for (const key in audioSources) {
        audioManager.load(key, audioSources[key]);
    }

    // ===================================
    // ANIMATION CONTROLLER
    // ===================================
    class AnimationController {
        constructor(entity) {
            this.entity = entity;
            this.animations = {};
            this.currentAnimation = null;
            this.currentFrame = 0;
            this.frameTimer = 0;
        }

        /**
         * Adiciona uma nova animação ao controlador.
         * @param {string} name - O nome da animação.
         * @param {HTMLImageElement} spriteSheet - A imagem da folha de sprites.
         * @param {number} frameCount - O número de frames na animação.
         * @param {number} frameRate - A taxa de quadros por segundo (FPS).
         * @param {boolean} [loop=true] - Se a animação deve repetir.
         */
        addAnimation(name, spriteSheet, frameCount, frameRate, loop = true) {
            this.animations[name] = {
                name,
                spriteSheet,
                frameCount,
                frameRate,
                loop,
                frameInterval: 1000 / frameRate
            };
        }

        /**
         * Inicia a reprodução de uma animação específica.
         * @param {string} name - O nome da animação a ser reproduzida.
         * @param {boolean} [force=false] - Se deve forçar o reinício da animação mesmo que já esteja tocando.
         */
        play(name, force = false) {
            if (this.currentAnimation?.name === name && !force) return;
            const newAnimation = this.animations[name];
            if (!newAnimation) {
                console.error(`Animação "${name}" não encontrada.`);
                return;
            }
            this.currentAnimation = newAnimation;
            this.currentFrame = 0;
            this.frameTimer = 0;
        }

        /**
         * Atualiza o frame atual da animação com base no tempo decorrido.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         */
        update(deltaTime) {
            if (!this.currentAnimation) return;

            this.frameTimer += deltaTime;

            if (this.frameTimer > this.currentAnimation.frameInterval) {
                this.frameTimer %= this.currentAnimation.frameInterval;

                const isLastFrame = this.currentFrame >= this.currentAnimation.frameCount - 1;

                if (!isLastFrame) {
                    this.currentFrame++;
                } else if (this.currentAnimation.loop) {
                    this.currentFrame = 0;
                } else {
                    // Chama onAnimationEnd apenas uma vez, sem alterar o frame.
                    // O estado do player vai mudar, e a updateAnimationState vai escolher a próxima animação.
                    this.entity.onAnimationEnd?.(this.currentAnimation.name);
                }
            }
        }

        /**
         * Desenha o frame atual da animação no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            if (!this.currentAnimation?.spriteSheet?.complete || this.currentAnimation.spriteSheet.naturalHeight === 0) return;
            const frameWidth = this.entity.frameWidth;
            const frameHeight = this.entity.frameHeight;
            const frame = Math.floor(this.currentFrame);
            const sx = frame * frameWidth;
            const sy = this.entity.spriteRow !== undefined ? this.entity.spriteRow * frameHeight : 0;
            context.imageSmoothingEnabled = false;
            context.drawImage(this.currentAnimation.spriteSheet, sx, sy, frameWidth, frameHeight, 0, 0, this.entity.width, this.entity.height);
            context.imageSmoothingEnabled = true;
        }
    }
    // ===================================
    // TILESET
    // ===================================
    class Tileset {
        /**
         * Gerencia uma folha de sprites de tiles (cenário).
         * @param {HTMLImageElement} image - A imagem do tileset.
         * @param {object} tileConfig - Um objeto que mapeia tipos de tile para suas coordenadas [sx, sy, sw, sh] na imagem.
         */
        constructor(image, tileConfig) {
            this.image = image;
            this.tileMap = tileConfig;
        }

        /**
         * Desenha um tile específico no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         * @param {string} tileType - O tipo de tile a ser desenhado (ex: '1', '2').
         * @param {number} dx - Posição X de destino no canvas.
         * @param {number} dy - Posição Y de destino no canvas.
         * @param {number} dWidth - Largura de destino no canvas.
         * @param {number} dHeight - Altura de destino no canvas.
         */
        draw(context, tileType, dx, dy, dWidth, dHeight) {
            if (!this.image?.complete || this.image.naturalHeight === 0) {
                context.fillStyle = '#8d6e63';
                context.fillRect(dx, dy, dWidth, dHeight);
                return;
            }

            const tile = this.tileMap[tileType];
            if (!tile) return;

            const [sx, sy, sw, sh] = tile;
            context.drawImage(this.image, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
        }
    }


    // ===================================
    // PLAYER
    // ===================================
    class Player {
        /**
         * Representa o personagem do jogador.
         * @param {number} x - Posição inicial X.
         * @param {number} y - Posição inicial Y.
         * @param {Game} game - A instância principal do jogo.
         */
        constructor(x, y, game) { // 1. Adicionar 'game' ao construtor
            // Mantendo o recorte em 128x128 como você confirmou.
            this.frameWidth = 128;
            this.frameHeight = 128;

            this.width = 120;
            this.height = 120;
            this.game = game; // 2. Armazenar a referência do jogo

            this.x = x;
            this.y = y;
            this.speed = 4;
            this.runSpeed = 7;
            this.vx = 0;
            this.vy = 0;
            this.jumpStrength = -18;
            this.onGround = false;
            this.isMoving = false;
            this.isRunning = false;
            this.timeKeyDown = 0;
            this.walkStopTime = 0;
            this.isAttacking = false;
            this.attackCooldown = 500;
            this.lastAttackTime = -1000;
            this.killCount = 0;
            this.maxHealth = 100;
            this.health = this.maxHealth;
            this.isInvincible = false;
            this.invincibilityTimer = 0;
            this.isDead = false;
            this.speedMultiplier = 1;
            this.attackMultiplier = 1;
            this.boostEndTime = 0;
            this.facingDirection = 1;
            this.attackEndTime = 0; // fallback timestamp (ms) to force end attack if animation misses onAnimationEnd

            this.animator = new AnimationController(this);
            this.setupAnimations();
        }

        /**
         * Configura e adiciona todas as animações do jogador ao AnimationController.
         */
        setupAnimations() {
            this.animator.addAnimation('walk', images.playerWalk, 8, 10);
            this.animator.addAnimation('run', images.playerRun, 8, 15);
            this.animator.addAnimation('jump', images.playerJump, 6, 10, false);
            this.animator.addAnimation('hurt', images.playerHurt, 2, 10, false);
            this.animator.addAnimation('dead', images.playerDead, 6, 8, false);
            this.animator.addAnimation('attack1', images.playerAttack1, 5, 15, false);
            this.animator.addAnimation('attack2', images.playerAttack2, 4, 15, false);
            this.animator.addAnimation('attack3', images.playerAttack3, 4, 15, false);
            this.animator.addAnimation('runAttack', images.playerRunAttack, 6, 15, false);
        }

        /**
         * Método principal de atualização do jogador, chamado a cada frame.
         * @param {InputHandler} input - O gerenciador de entradas.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         * @param {Game} game - A instância principal do jogo.
         */
        update(input, deltaTime, game) {
            // Usa timestamp real para lógica de tempo/ cooldowns
            const now = performance.now();

            this.handleInput(input, deltaTime, game);

            // Aplica movimento horizontal
            this.x += this.vx * this.speedMultiplier;

            // Aplica gravidade e movimento vertical
            this.vy += GRAVITY;
            this.y += this.vy;

            // Atualiza invencibilidade com deltaTime correto
            if (this.isInvincible) {
                this.invincibilityTimer -= deltaTime;
                if (this.invincibilityTimer <= 0) {
                    this.isInvincible = false;
                    this.invincibilityTimer = 0;
                }
            }

            // Atualiza boost
            if (this.boostEndTime > 0 && performance.now() > this.boostEndTime) {
                this.speedMultiplier = 1;
                this.attackMultiplier = 1;
                this.boostEndTime = 0;
            }

            // Atualiza animação (usa now para decisões baseadas em tempo absoluto)
            this.updateAnimationState(now);
            this.animator.update(deltaTime);

            // Safety fallback: se a animação de ataque não disparou onAnimationEnd, liberamos o estado
            if (this.isAttacking && this.attackEndTime > 0 && performance.now() > this.attackEndTime) {
                console.warn('⚠️ attackEndTime atingido — resetando isAttacking automaticamente');
                this.isAttacking = false;
                this.attackEndTime = 0;
            }
        }

        /**
         * Processa as entradas do teclado para controlar o movimento e as ações do jogador.
         * @param {InputHandler} input - O gerenciador de entradas.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         * @param {Game} game - A instância principal do jogo.
         */
        handleInput(input, deltaTime, game) {
            console.log('🎮 handleInput chamado | keys:', Array.from(input.keys));

            const now = performance.now();

            // Detecta entradas de movimento imediatamente para decidir comportamento durante runAttack
            const moveLeft = input.keys.has('a') || input.keys.has('arrowleft');
            const moveRight = input.keys.has('d') || input.keys.has('arrowright');

            // Se estiver a atacar, permita movimento apenas se for o ataque em corrida (runAttack)
            // e se a tecla de movimento correspondente estiver pressionada. Caso contrário bloqueia.
            if (this.isAttacking) {
                const animName = this.animator.currentAnimation?.name;
                if (animName === 'runAttack') {
                    // Mantém a velocidade de corrida apenas se o jogador ainda estiver pressionando a tecla de movimento
                    if (moveRight) {
                        this.facingDirection = 1;
                        this.vx = this.runSpeed;
                    } else if (moveLeft) {
                        this.facingDirection = -1;
                        this.vx = -this.runSpeed;
                    } else {
                        // Se não houver tecla de movimento, não avançar automaticamente durante runAttack
                        this.vx = 0;
                    }
                    return;
                }

                // Caso contrário, bloqueia o movimento enquanto ataca.
                this.vx = 0;
                return;
            }

            if (moveLeft) {
                this.facingDirection = -1;
            } else if (moveRight) {
                this.facingDirection = 1;
            }

            if (moveLeft || moveRight) {
                if (!this.isMoving) {
                    this.isMoving = true;
                    this.timeKeyDown = now;
                }

                this.isRunning = (now - this.timeKeyDown > WALK_TO_RUN_TIME);
                this.vx = this.isRunning ? this.runSpeed : this.speed;

                if (moveLeft) this.vx = -this.vx;
            } else {
                if (this.isMoving) {
                    this.isMoving = false;
                    this.isRunning = false;
                    this.walkStopTime = now;
                }
                this.vx = 0;
            }

            if ((input.keys.has('w') || input.keys.has('arrowup') || input.keys.has(' ')) && this.onGround) {
                this.onGround = false;
                this.vy = this.jumpStrength;
            }


            const attackPressed = input.keys.has('j') || input.keys.has('s') || input.keys.has('arrowdown');
            const timeSinceLastAttack = now - this.lastAttackTime;
            const canAttack = !this.isAttacking && (timeSinceLastAttack > this.attackCooldown);

            console.log('🗡️ Verificando ataque:', {
                attackPressed,
                isAttacking: this.isAttacking,
                timeSinceLastAttack,
                cooldown: this.attackCooldown,
                canAttack,
                now,
                lastAttackTime: this.lastAttackTime
            });

            if (attackPressed && canAttack) {  // ⬅️ USE canAttack AQUI!
                console.log('✨ ATAQUE INICIADO!');
                this.isAttacking = true;
                this.lastAttackTime = now;
                this.vx = 0;
                // fallback para garantir que o ataque termine (se onAnimationEnd não for chamado por algum motivo)
                this.attackEndTime = now + 1000; // 1s padrão
                game.handlePlayerAttack(this);
            }
            if (input.keys.has('v') && this.killCount >= 5) {
                this.killCount = 0;
                game.createFireball(this);
            }
        }

        /**
         * Determina qual animação deve ser reproduzida com base no estado atual do jogador.
         * A lógica segue uma ordem de prioridade (ex: atacar tem prioridade sobre andar).
         * @param {number} currentTime - O timestamp atual (performance.now()).
         */
        updateAnimationState(currentTime) {
            // Prioridade 1: Atacando
            if (this.isAttacking) {
                // Se já não estiver a tocar uma animação de ataque, inicia uma
                if (!this.animator.currentAnimation?.name.includes('attack')) {
                    if (this.isRunning) {
                        this.animator.play('runAttack', true);
                    } else {
                        const attacks = ['attack1', 'attack2', 'attack3'];
                        this.animator.play(attacks[Math.floor(Math.random() * attacks.length)], true);
                    }
                }
                return; // Sai da função para não sobrepor com outras animações
            }

            // Prioridade 2: Tomando Dano
            if (this.isInvincible) {
                this.animator.play('hurt');
                return;
            }

            // Prioridade 3: No Ar
            if (!this.onGround) {
                this.animator.play('jump');
                return;
            }

            // Se chegou aqui, está no chão e não está a atacar nem a tomar dano
            // Prioridade 4: Correndo
            if (this.isRunning) {
                this.animator.play('run');
                return;
            }

            // Prioridade 5: Andando (ou desacelerando)
            if (this.isMoving || (currentTime - this.walkStopTime < WALK_AFTER_STOP_TIME)) {
                this.animator.play('walk');
                return;
            }

            // Estado Padrão: Parado (mostra a animação de andar no primeiro frame)
            this.animator.play('walk');
        }

        /**
         * Desenha o jogador no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            if (this.isInvincible && Math.floor(this.invincibilityTimer / 100) % 2 === 0) return;

            context.save();
            context.translate(Math.floor(this.x), Math.floor(this.y));

            if (this.facingDirection === -1) {
                context.scale(-1, 1);
                context.translate(-this.width, 0);
            }

            this.animator.draw(context);
            context.restore();
        }

        /**
         * Aplica dano ao jogador e ativa o estado de invencibilidade temporária.
         * @param {number} amount - A quantidade de dano a ser recebida.
         */
        takeDamage(amount) {
            if (this.isInvincible || this.isDead) return;

            // Cancela ataque atual se estiver atacando
            if (this.isAttacking) {
                this.isAttacking = false;
                this.attackEndTime = 0;
                // Força animação de hurt (cancela a animação de ataque)
                this.animator.play('hurt', true);
                console.log('❗ Ataque cancelado por dano');
            }

            this.health -= amount;
            this.isInvincible = true;
            this.invincibilityTimer = 1500;

            // Garante que o jogador não fique preso com vx travado
            this.vx = 0;

            if (this.health <= 0) {
                this.health = 0;
                this.die();
            }
        }

        /**
         * Inicia a sequência de morte do jogador.
         */
        die() {
            if (this.isDead) return;
            this.isDead = true;
            this.animator.play('dead', true);
        }

        /**
         * Cura o jogador, restaurando uma quantidade de vida.
         * @param {number} amount - A quantidade de vida a ser restaurada.
         */
        heal(amount) {
            this.health = Math.min(this.maxHealth, this.health + amount);
        }

        /**
         * Aplica um boost temporário ao jogador (velocidade e ataque aumentados).
         * @param {number} duration - A duração do boost em milissegundos.
         */
        applyBoost(duration) {
            this.heal(this.maxHealth);
            this.speedMultiplier = 1.5;
            this.attackMultiplier = 1.5;
            this.boostEndTime = performance.now() + duration;
        }

        /**
         * Função de callback que é chamada quando uma animação não-repetitiva termina.
         * @param {string} animationName - O nome da animação que terminou.
         */
        onAnimationEnd(animationName) {
            console.log('🎬 Animação terminada:', animationName);
            // Se uma animação de ataque terminou, reseta o estado de ataque.
            if (animationName.includes('attack')) {
                if (this.isAttacking) {
                    this.isAttacking = false;
                    console.log('✅ isAttacking resetado para false');
                } else {
                    console.log('ℹ️ onAnimationEnd(attack) chamado, mas isAttacking já é false');
                }
            }
            // Se a animação de morte terminou, informa ao jogo que é "Game Over".
            if (animationName === 'dead') {
                this.isDead = true;
                this.game.gameOver = true; // <-- AQUI ESTÁ A CORREÇÃO PRINCIPAL!
            }
        }
    }

    // ===================================
    // SLIME
    // ===================================
    class Slime {
        /**
         * Representa um inimigo do tipo Slime.
         * @param {number} x - Posição inicial X.
         * @param {number} y - Posição inicial Y.
         */
        constructor(x, y) {
            this.frameWidth = 25;
            this.frameHeight = 32;
            this.width = 50;
            this.height = 64;
            this.x = x;
            this.y = y; // AJUSTE: não flutuar
            this.speed = 2;
            this.vx = 0;
            this.vy = 0;
            this.onGround = true;
            this.markedForDeletion = false;
            this.health = 100;
            this.spriteRow = 1.50;
            this.hopTimer = 0;
            this.hopInterval = Math.random() * 1000 + 1000;
            this.isHopping = false;

            this.animator = new AnimationController(this);
            this.animator.addAnimation('idle', images.slimeSheet, 1, 1);
            this.animator.addAnimation('hop', images.slimeSheet, 3, 6);
            this.animator.play('idle');
        }

        /**
         * Atualiza a lógica do Slime, incluindo movimento (pulo) e gravidade.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         * @param {Player} player - A instância do jogador, para direcionar o pulo.
         */
        update(deltaTime, player) {
            this.y += this.vy;
            this.x += this.vx;
            this.vy += GRAVITY;

            if (this.onGround) {
                if (this.isHopping) {
                    this.isHopping = false;
                    this.animator.play('idle');
                }

                this.vx = 0;
                this.hopTimer += deltaTime;

                if (this.hopTimer > this.hopInterval) {
                    this.isHopping = true;
                    this.vy = -10;
                    this.vx = (player.x > this.x ? this.speed : -this.speed);
                    this.hopTimer = 0;
                    this.hopInterval = Math.random() * 1000 + 1000;
                    this.animator.play('hop', true);

                    // ADICIONE ESTA LINHA PARA O SOM DO PULO
                    audioManager.play('slimeJump', 0.5); // 0.5 é o volume (50%)
                }
            }

            if (this.isHopping || !this.onGround) {
                this.animator.update(deltaTime);
            }
        }

        /**
         * Desenha o Slime no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            context.save();
            context.translate(Math.floor(this.x), Math.floor(this.y));
            this.animator.draw(context);
            context.restore();
        }

        /**
         * Aplica dano ao Slime. Se a vida chegar a zero, ele é marcado para remoção.
         * @param {number} amount - A quantidade de dano a ser recebida.
         */
        takeDamage(amount) {
            this.health -= amount;
            if (this.health <= 0) this.markedForDeletion = true;
        }
    }

    // ===================================
    // OUTRAS ENTIDADES
    // ===================================
    class Platform {
        /**
         * Representa uma plataforma sólida do cenário.
         * @param {number} x - Posição X.
         * @param {number} y - Posição Y.
         * @param {string} type - O tipo de tile, usado para desenhar a aparência correta.
         */
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.width = TILE_SIZE;
            this.height = TILE_SIZE;
            this.type = type;
        }

        /**
         * Desenha a plataforma usando um tileset.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         * @param {Tileset} tileset - O tileset do nível atual.
         */
        draw(context, tileset) {
            tileset.draw(context, this.type, this.x, this.y, this.width, this.height);
        }
    }

    /**
     * Classe base para todos os itens e objetos interativos do jogo.
     * @param {number} x - Posição X.
     * @param {number} y - Posição Y.
     * @param {HTMLImageElement} image - A imagem que representa o objeto.
     */
    class Interactable {
        constructor(x, y, image) {
            this.image = image;
            this.width = TILE_SIZE;
            this.height = TILE_SIZE;
            this.x = x;
            this.y = y;
            this.markedForDeletion = false;
        }

        /**
         * Desenha o objeto interativo no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            if (this.image?.complete && this.image.naturalHeight > 0) {
                context.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
        }
    }

    /** Representa um espinho que causa dano ao jogador. */
    class Spike extends Interactable {
        constructor(x, y) { super(x, y, images.spikes); }
    }

    /** Representa a água, que pode ser um obstáculo. */
    class Water extends Interactable {
        constructor(x, y) { super(x, y, images.water); }
    }

    /** Representa uma maçã que cura o jogador. */
    class Apple extends Interactable {
        constructor(x, y) { super(x, y, images.apple); }
    }

    /** Representa uma estrela que concede um boost ao jogador. */
    class Star extends Interactable {
        constructor(x, y) { super(x, y, images.star); }
    }

    /**
     * Representa o ponto final da fase.
     */
    class Flag {
        /**
         * @param {number} x - Posição X.
         * @param {number} y - Posição Y.
         */
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = TILE_SIZE;
            this.height = TILE_SIZE;
            this.animationTimer = 0; // Timer para animar a seta
        }

        /**
         * Atualiza o timer da animação.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         */
        update(deltaTime) {
            // Faz a seta pulsar para cima e para baixo
            this.animationTimer += deltaTime;
        }

        /**
         * Desenha o indicador de "Fim da Fase" com uma seta e texto.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            const centerX = this.x + this.width / 2;
            // Posição Y da seta, com uma pequena animação de pulso
            const arrowY = this.y - 60 + Math.sin(this.animationTimer / 200) * 5;

            // Desenha o texto "Fim da Fase"
            context.fillStyle = 'white';
            context.font = 'bold 24px Courier New';
            context.textAlign = 'center';
            context.fillText('Fim da Fase', centerX, arrowY - 30);

            // Desenha a seta apontando para baixo
            context.fillStyle = '#ffd700'; // Cor dourada
            context.beginPath();
            context.moveTo(centerX - 20, arrowY);
            context.lineTo(centerX + 20, arrowY);
            context.lineTo(centerX, arrowY + 20);
            context.closePath();
            context.fill();

            // Resetar o alinhamento para não afetar outros desenhos
            context.textAlign = 'left';
        }
    }

    /**
     * Representa o projétil de bola de fogo disparado pelo jogador.
     */
    class BlueFireball {
        /**
         * @param {number} x - Posição inicial X.
         * @param {number} y - Posição inicial Y.
         * @param {number} direction - A direção do movimento (-1 para esquerda, 1 para direita).
         */
        constructor(x, y, direction) {
            this.frameWidth = 80;
            this.frameHeight = 80;
            this.width = 64;
            this.height = 64;
            this.x = x;
            this.y = y;
            this.speed = 12;
            this.direction = direction;
            this.markedForDeletion = false;

            this.animator = new AnimationController(this);
            this.animator.addAnimation('fly', images.fireballSheet, 6, 12);
            this.animator.play('fly');
        }

        /**
         * Atualiza a posição da bola de fogo e a marca para remoção se sair da tela.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         * @param {Game} game - A instância principal do jogo.
         */
        update(deltaTime, game) {
            this.x += this.speed * this.direction;
            this.animator.update(deltaTime);

            if (this.x > game.cameraX + game.width || this.x < game.cameraX - 100) {
                this.markedForDeletion = true;
            }
        }

        /**
         * Desenha a bola de fogo no canvas.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            context.save();
            context.translate(Math.floor(this.x), Math.floor(this.y));

            if (this.direction === -1) {
                context.scale(-1, 1);
                context.translate(-this.width, 0);
            }

            this.animator.draw(context);
            context.restore();
        }
    }

    // ===================================
    // MAPAS DOS NÍVEIS (COM MAIS INIMIGOS)
    // ===================================
    const level1Map = [
        '                                                                                                          ',
        '                                                                                                          ',
        '                                                                                                          ',
        '    P                                                                                                     ',
        '   111      A                                                                                             ',
        '                3333                 *                     E                                    F          ',
        '                                  11111                 1111111                                 1111          ',
        '       E        E                  S S S            A                        E                             ',
        '       1111  111111111    111     1111111         1111111                  1111111                  111        ',
        '               E                       E                      E       E              E                     ',
        '11111111111111111111111111     111111111111111111111111111111111111111111111111111111111111WWW11111111',
    ];

    const level2Map = [
        '                                                                                                          ',
        '                                                                                                          ',
        '                                                                                                          ',
        '    P                                                                                                     ',
        '   111      A                                                                                             ',
        '                3333                 *                     E                                              ',
        '                                  11111                 1111111                                           ',
        '       E        E                           A                        E                             ',
        '       1111  1111111111                  1111111                  1111111                          ',
        '                     E            SSSS               E            E       E         E     E              F        ',
        '11111111111111111111111111111111111111111111     1111111111111111111111111111111111111   1111111111111111111111',
    ];
    const level3Map = [
        '                                                                                                          ',
        '                                                                                                          ',
        '                                        F       E                   E       E      E     E                     ',
        '    P                                1111111111111111111111  1111111111111111111111111111111111                 ',
        '   111      A                                                                                 1111            ',
        '                3333                 *                     E                                        11      ',
        '                                  11111                 1111111                                 11          ',
        '       E        E               S S S S            A                        E                             ',
        '       1111111111111111         1111111         1111111                  1111111                  111        ',
        '                                                            E       E              E                      ',
        '1111111WWWWWWWWWWWWWWWWW111111111111111111111111111111111111111111111111111111111111111111111111111111111',
    ];

    // ===================================
    // GAME CLASS
    // ===================================
    class Game {
        /**
         * A classe principal que gerencia todo o estado do jogo, entidades e o loop principal.
         * @param {number} width - A largura do canvas.
         * @param {number} height - A altura do canvas.
         */
        constructor(width, height) {
            this.width = width;
            this.height = height;
            this.input = new InputHandler();

            this.particles = new ParticleSystem(150);
            this.screenShake = new ScreenShake();
            this.trailRenderer = new TrailRenderer(10);

            this.currentLevel = 0;
            this.levels = [level1Map, level2Map, level3Map];

            this.tilesets = {
                0: new Tileset(images.world1Tileset, {
                    '1': [0, 0, 128, 128],
                    '2': [128, 0, 128, 128],
                    '3': [0, 128, 128, 96]
                }),
                1: new Tileset(images.world3Tileset, {
                    '1': [0, 0, 128, 128],
                    '2': [128, 0, 128, 128],
                    '3': [0, 128, 128, 96]
                }),
                2: new Tileset(images.world4Tileset, {
                    '1': [0, 0, 128, 128],
                    '2': [128, 0, 128, 128],
                    '3': [0, 128, 128, 96]
                }),
            };

            this.backgrounds = {
                0: images.background1,
                1: images.background2,
                2: images.background1
            };

            this.cameraX = 0;
            this.gameOver = false;
            this.victory = false;
            this.gameState = 'MENU'; // Estados possíveis: 'MENU', 'PLAYING', 'GAME_OVER', 'VICTORY'

            //this.loadLevel(this.currentLevel);
        }

        /**
         * Reseta o jogo para o estado inicial, recarregando o primeiro nível.
         */
        resetGame() {
            this.gameOver = false;
            this.victory = false;
            this.currentLevel = 0; // Reinicia no primeiro nível
            this.loadLevel(this.currentLevel);
            this.gameState = 'PLAYING';
            this.startAmbience(); // Reinicia a música ambiente se necessário
            console.log("Jogo Reiniciado!");
        }

        /**
         * Carrega um nível específico, criando todas as entidades (plataformas, inimigos, etc.) a partir do mapa.
         * @param {number} levelIndex - O índice do nível a ser carregado.
         */
        loadLevel(levelIndex) {
            if (levelIndex >= this.levels.length) {
                this.victory = true;
                this.gameOver = true;

                console.log("Você Venceu!");
                return;
            }

            this.currentLevel = levelIndex;
            const levelMap = this.levels[this.currentLevel];

            this.platforms = [];
            this.slimes = [];
            this.interactables = [];
            this.projectiles = [];

            levelMap.forEach((row, rowIndex) => {
                for (let colIndex = 0; colIndex < row.length; colIndex++) {
                    const x = colIndex * TILE_SIZE;
                    const y = rowIndex * TILE_SIZE;
                    const tile = row[colIndex];

                    if (tile.match(/[1-5]/)) {
                        this.platforms.push(new Platform(x, y, tile));
                    }
                    else if (tile === 'P') {
                        this.player = new Player(x, y, this); // Passa a referência do jogo
                    }
                    else if (tile === 'E') {
                        this.slimes.push(new Slime(x, y));
                    }
                    else if (tile === 'S') {
                        this.interactables.push(new Spike(x, y));
                    }
                    else if (tile === 'W') {
                        this.interactables.push(new Water(x, y));
                    }
                    else if (tile === 'A') {
                        this.interactables.push(new Apple(x, y));
                    }
                    else if (tile === '*') {
                        this.interactables.push(new Star(x, y));
                    }
                    else if (tile === 'F') {
                        this.interactables.push(new Flag(x, y));
                    }
                }
            });

            if (!this.player) this.player = new Player(100, 100, this); // Passa a referência do jogo
            this.cameraX = 0;
        }

        /**
         * Desenha a tela do menu inicial.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        drawMenu(context) {
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(0, 0, this.width, this.height);
            context.fillStyle = '#FFF';
            context.font = 'bold 60px Courier New';
            context.textAlign = 'center';
            context.fillText('Cavaleiro vs Slime', this.width / 2, this.height / 2 - 50);
            context.font = '30px Courier New';
            context.fillText('Clique ou Pressione Enter para Iniciar', this.width / 2, this.height / 2 + 50);
        }

        /**
         * Desenha a tela final (Game Over ou Vitória).
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        drawEndScreen(context) {
            context.fillStyle = 'rgba(0, 0, 0, 0.8)';
            context.fillRect(0, 0, this.width, this.height);
            context.font = 'bold 60px Courier New';
            context.textAlign = 'center';

            if (this.victory) {
                context.fillStyle = '#ffd700';
                context.fillText('🏆 VITÓRIA! 🏆', this.width / 2, this.height / 2 - 100);
                context.fillStyle = '#fff';
                context.font = '30px Courier New';
                context.fillText('Parabéns, você completou todos os níveis!', this.width / 2, this.height / 2 - 30);
            } else {
                context.fillStyle = '#e74c3c';
                context.fillText('💀 GAME OVER 💀', this.width / 2, this.height / 2 - 100);
            }

            context.fillStyle = '#fff';
            context.font = '24px Courier New';
            context.textAlign = 'center';
            context.fillText(`Kills Totais: ${this.player.killCount}`, this.width / 2, this.height / 2 + 20);
            context.fillText(`Nível Alcançado: ${this.currentLevel + 1}`, this.width / 2, this.height / 2 + 60);

            context.font = '30px Courier New';
            context.fillText('Clique ou Pressione Enter para Reiniciar', this.width / 2, this.height / 2 + 120);
        }



        /**
         * O loop de atualização principal do jogo, chamado a cada frame.
         * @param {number} deltaTime - O tempo decorrido desde o último frame.
         */
        update(deltaTime) {
            this.particles.update(deltaTime);
            this.screenShake.update(deltaTime);
            this.trailRenderer.update(deltaTime);

            this.player.update(this.input, deltaTime, this);

            // Se o jogador estiver morto, não precisamos atualizar inimigos, colisões, etc.
            // Mas a atualização do jogador (acima) e a verificação de queda (abaixo) ainda precisam rodar.
            if (this.player.isDead) {
                // Verifica se o jogador caiu para fora do mapa mesmo depois de morto
                if (this.player.y > this.height + 100) this.gameOver = true;
                return;
            }

            if (this.player.boostEndTime > 0 && Math.random() < 0.4) {
                this.trailRenderer.addTrail(this.player);
            }
            this.slimes.forEach(s => {
                if (isOnScreen(s, this.cameraX, this.width)) {
                    s.update(deltaTime, this.player);
                }
            });

            this.interactables.forEach(i => i.update?.(deltaTime));
            this.projectiles.forEach(p => p.update(deltaTime, this));

            this.handleCollisions();
            this.updateCamera();

            this.slimes = this.slimes.filter(s => !s.markedForDeletion);
            this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
            this.interactables = this.interactables.filter(i => !i.markedForDeletion);

            if (this.player.y > this.height + 100) {
                this.player.die();
                this.gameOver = true; // Define gameOver imediatamente na queda
            }
        }

        /**
         * Gerencia todas as verificações de colisão entre as entidades do jogo.
         */
        handleCollisions() {
            const allEntities = [this.player, ...this.slimes];

            for (const entity of allEntities) {
                entity.onGround = false;

                for (const platform of this.platforms) {
                    if (checkAABBCollision(entity, platform)) {
                        // Colisão com a parte de cima da plataforma
                        if (entity.vy >= 0 && (entity.y + entity.height) <= platform.y + entity.vy + GRAVITY) {
                            entity.y = platform.y - entity.height;
                            entity.vy = 0;
                            entity.onGround = true;
                        }
                    }
                }
            }

            // Colisão entre jogador e slimes
            this.slimes.forEach(slime => {
                if (checkAABBCollision(this.player, slime)) {
                    this.player.takeDamage(10);
                    this.screenShake.shake(200, 4);
                    this.particles.emit(
                        this.player.x + this.player.width / 2,
                        this.player.y + this.player.height / 2,
                        8,
                        { color: '#ff4757', speedRange: 4 }
                    );
                }
            });

            // Colisão entre jogador e itens/obstáculos interativos
            this.interactables.forEach(item => {
                if (checkAABBCollision(this.player, item)) {
                    if (item instanceof Flag) {
                        this.particles.emit(
                            item.x + item.width / 2,
                            item.y + item.height / 2,
                            20,
                            { color: '#ffd700', speedRange: 5, life: 800 }
                        );
                        this.loadLevel(this.currentLevel + 1);
                    }
                    if (item instanceof Spike) {
                        this.player.takeDamage(50);
                        this.screenShake.shake(300, 6);
                    }
                    if (item instanceof Apple) {
                        item.markedForDeletion = true;
                        this.player.heal(50);
                        this.particles.emit(
                            item.x + item.width / 2,
                            item.y + item.height / 2,
                            10,
                            { color: '#2ecc71', speedRange: 3 }
                        );
                    }
                    if (item instanceof Star) {
                        item.markedForDeletion = true;
                        this.player.applyBoost(10000);
                        this.particles.emit(
                            item.x + item.width / 2,
                            item.y + item.height / 2,
                            15,
                            { color: '#4ecdc4', speedRange: 5, life: 1000 }
                        );
                    }
                }
            });

            // Colisão entre projéteis e slimes
            this.projectiles.forEach(p => {
                this.slimes.forEach(s => {
                    if (checkAABBCollision(p, s)) {
                        p.markedForDeletion = true;
                        s.takeDamage(100);

                        this.particles.emit(
                            s.x + s.width / 2,
                            s.y + s.height / 2,
                            12,
                            { color: '#9b59b6', speedRange: 4 }
                        );

                        if (s.markedForDeletion) {
                            this.player.killCount++;
                        }
                    }
                });
            });
        }

        /**
         * Lida com a lógica de ataque do jogador, verificando colisões com inimigos.
         * @param {Player} player - A instância do jogador que está atacando.
         */
        handlePlayerAttack(player) {
            const hitboxWidth = player.width * 0.8;
            const hitboxHeight = player.height * 0.8;
            const hitbox = {
                x: player.facingDirection > 0 ? player.x + player.width / 2 : player.x - hitboxWidth / 2,
                y: player.y + player.height * 0.1,
                width: hitboxWidth,
                height: hitboxHeight
            };

            let hitSomething = false;

            this.slimes.forEach(slime => {
                if (checkAABBCollision(hitbox, slime)) {
                    slime.takeDamage(50 * player.attackMultiplier);
                    hitSomething = true;

                    this.particles.emit(
                        slime.x + slime.width / 2,
                        slime.y + slime.height / 2,
                        10,
                        { color: '#e74c3c', speedRange: 4 }
                    );




                    if (slime.markedForDeletion) {
                        player.killCount++;
                        this.particles.emit(
                            slime.x + slime.width / 2,
                            slime.y + slime.height / 2,
                            20,
                            { color: '#9b59b6', speedRange: 5, life: 800 }
                        );
                    }
                }
            });

            if (hitSomething) {
                this.screenShake.shake(150, 3);
                // ADICIONE ESTA LINHA PARA O SOM DO ATAQUE
                audioManager.play('swordAttack');
            }
        }

        /**
         * Inicia a reprodução de sons de ambiente em sequência.
         */
        startAmbience() {
            const ambienceSounds = ['ambience1', 'ambience2'];
            let currentAmbience = 0;

            const playNext = () => {
                const soundName = ambienceSounds[currentAmbience];
                const sound = audioManager.sounds[soundName];

                if (sound) {
                    sound.volume = 0.3; // Volume baixo para não incomodar
                    sound.play();
                    sound.onended = () => {
                        // Toca o próximo som da lista quando o atual terminar
                        currentAmbience = (currentAmbience + 1) % ambienceSounds.length;
                        playNext();
                    };
                }
            };
            playNext();
        }

        /**
         * Cria e adiciona uma nova instância de BlueFireball ao jogo.
         * @param {Player} player - O jogador que está disparando.
         */
        createFireball(player) {
            const fireballX = player.facingDirection > 0 ?
                player.x + player.width :
                player.x - 64;
            const fireballY = player.y + player.height / 2 - 32;

            this.projectiles.push(new BlueFireball(fireballX, fireballY, player.facingDirection));

            this.particles.emit(
                fireballX + 32,
                fireballY + 32,
                15,
                { color: '#00d2ff', speedRange: 3, life: 600 }
            );
        }

        /**
         * Atualiza a posição da câmera para seguir o jogador, com uma "zona morta" no centro.
         */
        updateCamera() {
            const deadZone = this.width / 3;

            if (this.player.x > this.cameraX + this.width - deadZone) {
                this.cameraX = this.player.x - (this.width - deadZone);
            }
            else if (this.player.x < this.cameraX + deadZone) {
                this.cameraX = this.player.x - deadZone;
            }

            if (this.cameraX < 0) this.cameraX = 0;

            const maxCameraX = this.levels[this.currentLevel][0].length * TILE_SIZE - this.width;
            if (this.cameraX > maxCameraX) this.cameraX = maxCameraX;
        }

        /**
         * O loop de desenho principal do jogo, chamado a cada frame para renderizar tudo na tela.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        draw(context) {
            context.save();

            this.screenShake.apply(context);

            context.translate(-Math.floor(this.cameraX), 0);

            const bg = this.backgrounds[this.currentLevel] || this.backgrounds[0];

            // ===== SUBSTITUA O CÓDIGO DE DESENHO DO FUNDO POR ESTE =====
            if (bg?.complete && bg.naturalHeight > 0) {
                const bgPatternWidth = bg.width; // Largura da imagem de fundo
                // Calcula a posição X inicial para o desenho, aplicando parallax e fazendo o wrap com modulo
                const bgStartX = (this.cameraX * 0.3) % bgPatternWidth;

                // Desenha a imagem de fundo repetidamente para cobrir a tela
                // Começa desenhando um pouco antes da posição calculada para cobrir a borda esquerda
                for (let x = -bgStartX - bgPatternWidth; x < this.width + this.cameraX; x += bgPatternWidth) {
                     // Desenha a imagem inteira, esticando-a para a altura da tela
                     context.drawImage(bg, Math.floor(x), 0, bgPatternWidth, this.height);
                }
            }
            // ============================================================

            const tileset = this.tilesets[this.currentLevel];
            this.platforms.forEach(p => {
                if (isOnScreen(p, this.cameraX, this.width)) {
                    p.draw(context, tileset);
                }
            });

            this.interactables.forEach(i => {
                if (isOnScreen(i, this.cameraX, this.width)) {
                    i.draw(context);
                }
            });

            this.trailRenderer.draw(context);

            this.player.draw(context);

            this.slimes.forEach(s => {
                if (isOnScreen(s, this.cameraX, this.width)) {
                    s.draw(context);
                }
            });

            this.projectiles.forEach(p => p.draw(context));

            this.particles.draw(context);

            context.restore();

            this.drawHUD(context);
        }

        /**
         * Desenha a Interface do Usuário (HUD), como vida, kills, etc.
         * @param {CanvasRenderingContext2D} context - O contexto 2D do canvas.
         */
        drawHUD(context) {
            context.fillStyle = 'rgba(0, 0, 0, 0.5)';
            context.fillRect(10, 10, 300, 150);

            context.fillStyle = '#333';
            context.fillRect(20, 20, 280, 30);

            const healthPercent = this.player.health / this.player.maxHealth;
            const healthColor = healthPercent > 0.6 ? '#2ecc71' :
                healthPercent > 0.3 ? '#f39c12' : '#e74c3c';
            context.fillStyle = healthColor;
            context.fillRect(20, 20, 280 * healthPercent, 30);

            context.strokeStyle = '#fff';
            context.lineWidth = 2;
            context.strokeRect(20, 20, 280, 30);

            context.fillStyle = '#fff';
            context.font = 'bold 18px Courier New';
            context.textAlign = 'left';
            context.fillText(`HP: ${Math.ceil(this.player.health)}/${this.player.maxHealth}`, 25, 42);

            context.fillText(`Kills: ${this.player.killCount}`, 20, 75);

            context.fillText(`Nível: ${this.currentLevel + 1}/${this.levels.length}`, 20, 100);

            context.fillText('Especial (V):', 20, 125);
            context.fillStyle = '#222';
            context.fillRect(20, 135, 280, 20);

            if (this.player.killCount > 0) {
                const specialPercent = Math.min(this.player.killCount / 5, 1);
                context.fillStyle = '#00d2ff';
                context.fillRect(20, 135, 280 * specialPercent, 20);
            }

            context.strokeStyle = '#fff';
            context.strokeRect(20, 135, 280, 20);

            if (this.player.boostEndTime > 0) {
                const timeLeft = ((this.player.boostEndTime - performance.now()) / 1000).toFixed(1);
                if (timeLeft > 0) {
                    context.fillStyle = '#4ecdc4';
                    context.font = 'bold 40px Courier New';
                    context.textAlign = 'center';
                    context.fillText(`⚡ BOOST: ${timeLeft}s ⚡`, this.width / 2, 60);
                }
            }
        }
    }

    // ===================================
    // INICIALIZAÇÃO E LOOP
    // ===================================
    let game;
    let lastTime = 0;

    /**
     * A função principal do loop do jogo, que é chamada repetidamente pelo requestAnimationFrame.
     * @param {number} timestamp - O tempo atual fornecido pelo navegador.
     */
    function animate(timestamp) {
        // ---- Tela de Carregamento ----
        if (imagesLoaded < numImages) {
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#4ecdc4'; ctx.font = '30px Courier New'; ctx.textAlign = 'center';
            ctx.fillText(`Carregando Assets...`, canvas.width / 2, canvas.height / 2 - 20);
            const progress = (imagesLoaded / numImages) * 100;
            ctx.fillStyle = '#333'; ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 + 20, 400, 30);
            ctx.fillStyle = '#4ecdc4'; ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 + 20, 400 * (progress / 100), 30);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(canvas.width / 2 - 200, canvas.height / 2 + 20, 400, 30);
            ctx.fillStyle = '#fff'; ctx.fillText(`${Math.floor(progress)}%`, canvas.width / 2, canvas.height / 2 + 42);
            requestAnimationFrame(animate);
            return;
        }

        // ---- Cria o Jogo (só na primeira vez) ----
        if (!game) {
            game = new Game(canvas.width, canvas.height);
            // Não inicia a música ambiente aqui, só quando o jogo começa
        }

        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        ctx.fillStyle = '#000'; // Limpa a tela
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ---- Lógica Principal baseada no Estado ----
        switch (game.gameState) {
            case 'MENU':
                game.drawMenu(ctx); // Desenha o menu
                break;

            case 'PLAYING':
                game.update(deltaTime || 0); // Atualiza a lógica do jogo
                game.draw(ctx);          // Desenha o jogo
                // Verifica se o jogo terminou nesta frame
                if (game.gameOver || game.victory) {
                    game.gameState = game.victory ? 'VICTORY' : 'GAME_OVER';
                }
                break;

            case 'GAME_OVER':
            case 'VICTORY':
                game.draw(ctx); // Continua a desenhar o último estado do jogo por baixo
                game.drawEndScreen(ctx); // Desenha o ecrã final por cima
                break;
        }

        // Continua a animação, a não ser que o jogo tenha realmente terminado (opcional)
        requestAnimationFrame(animate);
    }

    // ===== ADICIONE ESTE OUVINTE DE EVENTOS =====
    /**
     * Lida com interações do usuário (clique ou Enter) para iniciar ou reiniciar o jogo.
     */
    function handleInteraction() {
        if (!game) return; // Se o jogo ainda não foi criado, ignora

        if (game.gameState === 'MENU') {
            game.resetGame(); // Começa o jogo a partir do menu
        } else if (game.gameState === 'GAME_OVER' || game.gameState === 'VICTORY') {
            game.resetGame(); // Reinicia o jogo a partir do ecrã final
        }
    }
    canvas.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleInteraction();
        }
    });
    // ============================================

    // Inicia o loop
    animate(0);
});