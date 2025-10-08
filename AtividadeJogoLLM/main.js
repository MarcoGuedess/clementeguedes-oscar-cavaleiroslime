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
    function checkAABBCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

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

        spawn(x, y, vx, vy, life, color, size) {
            this.x = x; this.y = y;
            this.vx = vx; this.vy = vy;
            this.life = this.maxLife = life;
            this.color = color;
            this.size = size;
            this.active = true;
        }

        update(deltaTime) {
            if (!this.active) return;
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.2;
            this.life -= deltaTime;
            if (this.life <= 0) this.active = false;
        }

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
        constructor(poolSize = 150) {
            this.particles = [];
            for (let i = 0; i < poolSize; i++) {
                this.particles.push(new Particle());
            }
        }

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

        update(deltaTime) {
            this.particles.forEach(p => p.update(deltaTime));
        }

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

        shake(duration = 200, intensity = 5) {
            this.duration = duration;
            this.intensity = intensity;
        }

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

        apply(context) {
            context.translate(Math.floor(this.x), Math.floor(this.y));
        }
    }

    // ===================================
    // TRAIL RENDERER
    // ===================================
    class TrailRenderer {
        constructor(maxTrails = 10) {
            this.trails = [];
            this.maxTrails = maxTrails;
        }

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

        update(deltaTime) {
            for (let i = this.trails.length - 1; i >= 0; i--) {
                this.trails[i].alpha -= deltaTime / 150;
                if (this.trails[i].alpha <= 0) {
                    this.trails.splice(i, 1);
                }
            }
        }

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
        constructor(image, tileConfig) {
            this.image = image;
            this.tileMap = tileConfig;
        }

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
    // ===================================
    // PLAYER
    // ===================================
    class Player {
        constructor(x, y) {
            // Mantendo o recorte em 128x128 como você confirmou.
            this.frameWidth = 128;
            this.frameHeight = 128;

            this.width = 120;
            this.height = 120;

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

            this.animator = new AnimationController(this);
            this.setupAnimations();
        }

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
        }

        handleInput(input, deltaTime, game) {
            console.log('🎮 handleInput chamado | keys:', Array.from(input.keys));

            if (this.isAttacking) {
                this.vx = 0;
                return;
            }

            const now = performance.now();

            const moveLeft = input.keys.has('a') || input.keys.has('arrowleft');
            const moveRight = input.keys.has('d') || input.keys.has('arrowright');

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
                game.handlePlayerAttack(this);
            }
            if (input.keys.has('v') && this.killCount >= 5) {
                this.killCount = 0;
                game.createFireball(this);
            }
        }

        // ===== FUNÇÃO CORRIGIDA =====
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

        takeDamage(amount) {
            if (this.isInvincible || this.isDead) return;
            this.health -= amount;
            this.isInvincible = true;
            this.invincibilityTimer = 1500;
            if (this.health <= 0) {
                this.health = 0;
                this.die();
            }
        }

        die() {
            if (this.isDead) return;
            this.isDead = true;
            this.animator.play('dead', true);
        }

        heal(amount) {
            this.health = Math.min(this.maxHealth, this.health + amount);
        }

        applyBoost(duration) {
            this.heal(this.maxHealth);
            this.speedMultiplier = 1.5;
            this.attackMultiplier = 1.5;
            this.boostEndTime = performance.now() + duration;
        }

        onAnimationEnd(animationName) {
            console.log('🎬 Animação terminada:', animationName);
            if (animationName.includes('attack')) {
                this.isAttacking = false;
                console.log('✅ isAttacking resetado para false');
            }
            if (animationName === 'dead') {
                this.isDead = true;
            }
        }
    }

    // ===================================
    // SLIME
    // ===================================
    class Slime {
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
                }
            }

            if (this.isHopping || !this.onGround) {
                this.animator.update(deltaTime);
            }
        }

        draw(context) {
            context.save();
            context.translate(Math.floor(this.x), Math.floor(this.y));
            this.animator.draw(context);
            context.restore();
        }

        takeDamage(amount) {
            this.health -= amount;
            if (this.health <= 0) this.markedForDeletion = true;
        }
    }

    // ===================================
    // OUTRAS ENTIDADES
    // ===================================
    class Platform {
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.width = TILE_SIZE;
            this.height = TILE_SIZE;
            this.type = type;
        }

        draw(context, tileset) {
            tileset.draw(context, this.type, this.x, this.y, this.width, this.height);
        }
    }

    class Interactable {
        constructor(x, y, image) {
            this.image = image;
            this.width = TILE_SIZE;
            this.height = TILE_SIZE;
            this.x = x;
            this.y = y;
            this.markedForDeletion = false;
        }

        draw(context) {
            if (this.image?.complete && this.image.naturalHeight > 0) {
                context.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
        }
    }

    class Spike extends Interactable {
        constructor(x, y) { super(x, y, images.spikes); }
    }

    class Water extends Interactable {
        constructor(x, y) { super(x, y, images.water); }
    }

    class Apple extends Interactable {
        constructor(x, y) { super(x, y, images.apple); }
    }

    class Star extends Interactable {
        constructor(x, y) { super(x, y, images.star); }
    }

    class Flag {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.frameWidth = 64;
            this.frameHeight = 64;
            this.width = TILE_SIZE;
            this.height = TILE_SIZE;
            this.spriteRow = 0;

            this.animator = new AnimationController(this);
            this.animator.addAnimation('wave', images.flagSheet, 4, 5);
            this.animator.play('wave');
        }

        update(deltaTime) {
            this.animator.update(deltaTime);
        }

        draw(context) {
            context.save();
            context.translate(Math.floor(this.x), Math.floor(this.y));
            this.animator.draw(context);
            context.restore();
        }
    }

    class BlueFireball {
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

        update(deltaTime, game) {
            this.x += this.speed * this.direction;
            this.animator.update(deltaTime);

            if (this.x > game.cameraX + game.width || this.x < game.cameraX - 100) {
                this.markedForDeletion = true;
            }
        }

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
        '                3333                 *                     E                                              ',
        '                                  11111                 1111111                                           ',
        '       E        E               S S S S            A                        E                             ',
        '       1111111111111111         1111111         1111111                  1111111                          ',
        '                                                            E       E              E              F        ',
        '1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
    ];

    const level2Map = [
        '                                                                                                          ',
        '                                                                                                          ',
        '    P                                                                                                     ',
        '   111                                 E                                                                  ',
        '               A                    1111111                                                               ',
        '          E           S S S                                    E                                          ',
        '      1111111111      11111                                 1111111                                       ',
        '                                  111111                                    E                             ',
        '                                              E                          1111111                          ',
        '                      *                    1111111                                                        ',
        '   111111   1111111111111   11111111111111                                                                ',
        '                                                 E        E        E                  E          F        ',
        '1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
    ];

    const level3Map = [
        '                                                                                                          ',
        '  P                                                                                                       ',
        ' 111                                                                                                      ',
        '             111111                        E                                                              ',
        '        E                S S            1111111                 E                                         ',
        '      11111              11111                 *             1111111                                      ',
        '                                             11111                            E                           ',
        '                                                        A                  1111111                        ',
        '1111111   111111  1111111111       E                         1111111                          E           ',
        '                                1111111       E                                            1111111        ',
        '                                                       E                  E              E            F   ',
        '1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
    ];

    // ===================================
    // GAME CLASS
    // ===================================
    class Game {
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

            this.loadLevel(this.currentLevel);
        }

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
                        this.player = new Player(x, y);
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

            if (!this.player) this.player = new Player(100, 100);
            this.cameraX = 0;
        }

        update(deltaTime) {
            if (this.gameOver && !this.player.isDead) return;

            this.particles.update(deltaTime);
            this.screenShake.update(deltaTime);
            this.trailRenderer.update(deltaTime);

            this.player.update(this.input, deltaTime, this);

            if (this.player.boostEndTime > 0 && Math.random() < 0.4) {
                this.trailRenderer.addTrail(this.player);
            }

            this.slimes.forEach(s => {
                if (isOnScreen(s, this.cameraX, this.width)) {
                    s.update(deltaTime, this.player);
                }
            });

            if (this.player.isDead) return;

            this.interactables.forEach(i => i.update?.(deltaTime));
            this.projectiles.forEach(p => p.update(deltaTime, this));

            this.handleCollisions();
            this.updateCamera();

            this.slimes = this.slimes.filter(s => !s.markedForDeletion);
            this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
            this.interactables = this.interactables.filter(i => !i.markedForDeletion);

            if (this.player.y > this.height + 100) {
                this.player.die();
            }
        }

        handleCollisions() {
            const allEntities = [this.player, ...this.slimes];

            for (const entity of allEntities) {
                entity.onGround = false;

                for (const platform of this.platforms) {
                    if (checkAABBCollision(entity, platform)) {
                        if (entity.vy >= 0 && (entity.y + entity.height) <= platform.y + entity.vy + GRAVITY) {
                            entity.y = platform.y - entity.height;
                            entity.vy = 0;
                            entity.onGround = true;
                        }
                    }
                }
            }

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

        handlePlayerAttack(player) {
            const hitboxWidth = player.width * 0.8;
            const hitboxHeight = player.height * 0.8;
            const hitbox = {
                x: player.facingDirection > 0 ?
                    player.x + player.width / 2 :
                    player.x - hitboxWidth / 2,
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
            }
        }

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

        draw(context) {
            context.save();

            this.screenShake.apply(context);

            context.translate(-Math.floor(this.cameraX), 0);

            const bg = this.backgrounds[this.currentLevel] || this.backgrounds[0];
            if (bg?.complete && bg.naturalHeight > 0) {
                const bgX = this.cameraX * 0.3;
                const bgWidth = this.width;
                const numBackgrounds = Math.ceil(this.width / bgWidth) + 2;

                for (let i = -1; i < numBackgrounds; i++) {
                    context.drawImage(bg, bgX + i * bgWidth, 0, bgWidth, this.height);
                }
            }

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

    function animate(timestamp) {
        if (imagesLoaded < numImages) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#4ecdc4';
            ctx.font = '30px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(`Carregando Assets...`, canvas.width / 2, canvas.height / 2 - 20);

            const progress = (imagesLoaded / numImages) * 100;
            ctx.fillStyle = '#333';
            ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 + 20, 400, 30);
            ctx.fillStyle = '#4ecdc4';
            ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 + 20, 400 * (progress / 100), 30);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(canvas.width / 2 - 200, canvas.height / 2 + 20, 400, 30);

            ctx.fillStyle = '#fff';
            ctx.fillText(`${Math.floor(progress)}%`, canvas.width / 2, canvas.height / 2 + 42);

            requestAnimationFrame(animate);
            return;
        }

        if (!game) {
            game = new Game(canvas.width, canvas.height);
        }

        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        game.update(deltaTime || 0);
        game.draw(ctx);

        if (game.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 60px Courier New';
            ctx.textAlign = 'center';

            if (game.victory) {
                ctx.fillStyle = '#ffd700';
                ctx.fillText('🏆 VITÓRIA! 🏆', canvas.width / 2, canvas.height / 2 - 50);
                ctx.fillStyle = '#fff';
                ctx.font = '30px Courier New';
                ctx.fillText('Parabéns, você completou todos os níveis!', canvas.width / 2, canvas.height / 2 + 20);
            } else {
                ctx.fillStyle = '#e74c3c';
                ctx.fillText('💀 GAME OVER 💀', canvas.width / 2, canvas.height / 2 - 50);
                ctx.fillStyle = '#fff';
                ctx.font = '30px Courier New';
                ctx.fillText('Pressione F5 para jogar novamente', canvas.width / 2, canvas.height / 2 + 20);
            }

            ctx.font = '24px Courier New';
            ctx.fillText(`Kills Totais: ${game.player.killCount}`, canvas.width / 2, canvas.height / 2 + 70);
            ctx.fillText(`Nível Alcançado: ${game.currentLevel + 1}`, canvas.width / 2, canvas.height / 2 + 110);
        } else {
            requestAnimationFrame(animate);
        }
    }

    animate(0);
});