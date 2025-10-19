# ⚔️ Cavaleiro vs. Slime 🛡️

**Jogo de Plataforma 2D desenvolvido com HTML5 Canvas e JavaScript**

---

## 👨‍💻 Autores
- **Marco Antônio Clemente Ribeiro Guedes**
- **Miguel Oscar**

---

## 📜 Descrição do Projeto

**Cavaleiro vs. Slime** é um jogo de plataforma 2D de ação e aventura. O jogador assume o controle de um valente cavaleiro em uma missão para derrotar hordas de slimes saltitantes e superar obstáculos perigosos em múltiplos níveis.

Este projeto foi desenvolvido como parte da atividade prática **“Jogo 2D no Canvas com LLMs”** da disciplina de Desenvolvimento de Jogos Digitais.

📚 *Disciplina: Desenvolvimento de Jogos Digitais*  
👨🏻‍🏫 **Professor:** [Christien Lana Rachid](https://github.com/christienrachid)  
📍 *Centro Universitário Academia*  

---

## 🎮 Como Jogar

O objetivo é simples: sobreviva, derrote os inimigos e chegue até o final de cada fase, indicado por uma seta e o texto "Fim da Fase".

### Controles
| Ação | Teclas |
| :--- | :--- |
| **Movimentar** | `A` / `D` ou `←` / `→` |
| **Pular** | `W`, `↑` ou `Espaço` |
| **Atacar** | `J`, `S` ou `↓` |
| **Ataque Especial** | `V` (requer 5 abates) |
| **Iniciar / Reiniciar** | `Enter` ou `Clique do Mouse` |

---

## ✨ Funcionalidades Principais

- **Movimentação Fluida:** O cavaleiro pode andar, correr e pular.
- **Sistema de Combate:** Ataques corpo a corpo com combo e um ataque especial de projétil (`Fireball`).
- **Inimigos:** Enfrente slimes com comportamento de pulo em direção ao jogador.
- **Múltiplos Níveis:** O jogo conta com 3 fases com layouts e desafios diferentes.
- **Itens Colecionáveis:**
  - **🍎 Maçãs:** Recuperam a vida do jogador.
  - **⭐ Estrelas:** Concedem um *boost* temporário de velocidade e dano.
- **Perigos no Cenário:** Espinhos (`Spikes`) que causam dano ao contato.
- **HUD Completa:** Interface que exibe vida (HP), contagem de abates (`Kills`), nível atual e barra de especial.
- **Efeitos Visuais:**
  - Sistema de partículas para colisões, itens e ataques.
  - Efeito de *Screen Shake* (tremor de tela) ao receber dano.
  - Rastro de movimento (*Trail*) durante o *boost*.
- **Telas de Jogo:** Menu inicial, tela de Game Over e tela de Vitória.

---

## 🛠️ Tecnologias Utilizadas
- **HTML5 Canvas:** Para renderização gráfica do jogo.
- **JavaScript (ES6+):** Para toda a lógica de programação, física e mecânicas.
- **CSS3:** Para estilização da página e do canvas.

---
## 🚀 Como Executar
1. Clone este repositório:
   ```sh
   git clone <URL_DO_REPOSITORIO>
   ```
2. Abra o arquivo `index.html` em um navegador de internet moderno (Google Chrome, Firefox, etc.).
   - *Observação: Para uma melhor experiência e para evitar problemas com carregamento de assets, é recomendado executar o jogo a partir de um servidor local (como o Live Server do VS Code).*

---

## 📂 Estrutura de Arquivos
```
├── index.html          # Arquivo principal da página
├── style.css           # Folha de estilos
├── main.js             # Lógica central do jogo
├── README.md           # Este arquivo
└── /assets/            # Pasta com todos os recursos (sprites, sons, etc.)
```

---

> “Criar é aprender duas vezes.”  
> — *Joseph Joubert*  
