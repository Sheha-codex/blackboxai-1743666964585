import AudioManager from './audioManager.js';

class LudoGame {
    constructor() {
        this.audio = new AudioManager();
        this.players = [
            { color: 'red', name: 'Player 1', pieces: [], isAI: false },
            { color: 'blue', name: 'Player 2', pieces: [], isAI: true },
            { color: 'green', name: 'Player 3', pieces: [], isAI: true },
            { color: 'yellow', name: 'Player 4', pieces: [], isAI: true }
        ];
        this.currentPlayerIndex = 0;
        this.diceValue = 1;
        this.gameState = 'waiting'; // waiting, rolling, moving
        this.boardSize = 15; // 15x15 grid
        this.cellSize = 0; // Will be calculated
    }

    async initGame() {
        this.setupEventListeners();
        this.renderBoard();
        
        const gameMode = sessionStorage.getItem('gameMode') || 'ai';
        if (gameMode === 'multiplayer') {
            await this.initMultiplayer();
        } else {
            this.initializePieces();
        }
        
        this.updatePlayerDisplay();
    }

    async initMultiplayer() {
        this.roomCode = sessionStorage.getItem('roomCode');
        this.playerId = sessionStorage.getItem('playerId');
        this.isHost = sessionStorage.getItem('isHost') === 'true';
        this.playerName = `Player ${this.playerId.replace('player', '')}`;
        
        if (!this.roomCode || !this.playerId) {
            console.error('Missing multiplayer session data');
            return;
        }

        // Initialize Firebase references
        this.roomRef = database.ref(`rooms/${this.roomCode}`);
        this.playersRef = this.roomRef.child('players');
        this.gameStateRef = this.roomRef.child('gameState');
        this.piecesRef = this.roomRef.child('pieces');
        this.chatRef = this.roomRef.child('chat');

        // Setup real-time listeners
        this.playersRef.on('value', (snapshot) => {
            const playersData = snapshot.val() || {};
            this.syncPlayers(playersData);
            this.checkAllPlayersReady(playersData);
        });

        this.gameStateRef.on('value', (snapshot) => {
            const gameState = snapshot.val();
            if (gameState) this.syncGameState(gameState);
        });

        this.piecesRef.on('value', (snapshot) => {
            const piecesData = snapshot.val() || {};
            this.syncPieces(piecesData);
        });

        // Setup chat listener
        this.chatRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            this.displayChatMessage(message);
        });

        // Show ready button for multiplayer
        document.getElementById('readyBtn')?.classList.remove('hidden');
        
        // Initialize local player data (not ready yet)
        await this.playersRef.child(this.playerId).update({
            ready: false
        });
    }

    async setPlayerReady() {
        const isReady = true;
        await this.playersRef.child(this.playerId).update({
            ready: isReady
        });
        document.getElementById('readyBtn').innerHTML = 
            `<i class="fas fa-check mr-2"></i> ${isReady ? 'Waiting...' : 'Ready'}`;
    }

    checkAllPlayersReady(playersData) {
        const players = Object.values(playersData);
        const allReady = players.length > 1 && players.every(p => p.ready);
        
        if (allReady && this.isHost) {
            // Start the game
            this.initializePieces();
            document.getElementById('readyBtn').classList.add('hidden');
            document.getElementById('rollDiceBtn').classList.remove('hidden');
            
            // Update game state
            this.updateGameState({
                started: true,
                currentPlayerId: 0
            });
        }
    }

    syncPlayers(playersData) {
        this.players = Object.values(playersData).map(player => ({
            ...player,
            isAI: false, // In multiplayer, all players are human
            pieces: [] // Will be populated during initialization
        }));
        this.updatePlayerDisplay();
    }

    syncGameState(gameState) {
        if (gameState.started) {
            // Show/hide appropriate buttons when game starts
            document.getElementById('readyBtn')?.classList.add('hidden');
            document.getElementById('rollDiceBtn')?.classList.remove('hidden');
        }
        
        if (gameState.currentPlayerId && gameState.currentPlayerId !== this.currentPlayerIndex) {
            this.currentPlayerIndex = gameState.currentPlayerId;
            this.updatePlayerDisplay();
        }
        
        if (gameState.diceValue && gameState.diceValue !== this.diceValue) {
            this.diceValue = gameState.diceValue;
            document.getElementById('diceValue').textContent = this.diceValue;
        }
    }

    syncPieces(piecesData) {
        this.players.forEach(player => {
            player.pieces.forEach(piece => {
                if (piecesData[piece.id]) {
                    piece.position = piecesData[piece.id].position;
                    piece.isHome = piecesData[piece.id].isHome;
                    piece.pathIndex = piecesData[piece.id].pathIndex;
                }
            });
        });
        this.renderAllPieces();
    }

    renderAllPieces() {
        this.players.forEach((_, index) => {
            this.renderPieces(index);
        });
    }

    setupEventListeners() {
        document.getElementById('backToMenu')?.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        document.getElementById('rollDiceBtn')?.addEventListener('click', () => {
            if (this.gameState === 'waiting' && !this.players[this.currentPlayerIndex].isAI) {
                this.rollDice();
            }
        });

        // Sound toggle button functionality
        const soundToggleBtn = document.getElementById('soundToggleBtn');
        if (soundToggleBtn) {
            soundToggleBtn.addEventListener('click', () => {
                const isEnabled = this.audio.toggle();
                const icon = soundToggleBtn.querySelector('i');
                const text = soundToggleBtn.querySelector('span') || document.createElement('span');
                
                icon.className = isEnabled ? 'fas fa-volume-up mr-2' : 'fas fa-volume-mute mr-2';
                text.textContent = `Sound: ${isEnabled ? 'On' : 'Off'}`;
                
                if (!soundToggleBtn.contains(text)) {
                    soundToggleBtn.appendChild(text);
                }
            });
        }

        // Display game mode
        const gameMode = sessionStorage.getItem('gameMode') || 'ai';
        document.getElementById('gameModeDisplay').textContent = 
            gameMode === 'multiplayer' ? 'Multiplayer Game' : 'VS AI Game';
    }

    renderBoard() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';
        this.cellSize = board.offsetWidth / this.boardSize;

        // Create SVG board
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `0 0 ${this.boardSize} ${this.boardSize}`);

        // Draw board cells
        for (let y = 0; y < this.boardSize; y++) {
            for (let x = 0; x < this.boardSize; x++) {
                const cell = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                cell.setAttribute('x', x);
                cell.setAttribute('y', y);
                cell.setAttribute('width', 1);
                cell.setAttribute('height', 1);
                cell.setAttribute('fill', this.getCellColor(x, y));
                svg.appendChild(cell);
            }
        }

        // Add home bases
        this.players.forEach((player, index) => {
            const home = this.createHomeBase(index);
            svg.appendChild(home);
        });

        // Add safe zone indicators
        const boardPath = this.getBoardPath();
        boardPath.safeZones.forEach(zone => {
            const safeZone = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            safeZone.setAttribute('cx', zone.x + 0.5);
            safeZone.setAttribute('cy', zone.y + 0.5);
            safeZone.setAttribute('r', '0.3');
            safeZone.setAttribute('fill', 'gold');
            safeZone.setAttribute('opacity', '0.7');
            svg.appendChild(safeZone);
        });

        board.appendChild(svg);
    }

    getCellColor(x, y) {
        // Classic Ludo board coloring
        if ((x === 6 || x === 8) && (y === 6 || y === 8)) {
            return '#f0f0f0'; // Center white squares
        }
        if ((x === 6 || x === 8) && y >= 0 && y <= 14) {
            return y % 2 === 0 ? '#f8fafc' : '#e2e8f0'; // Vertical paths
        }
        if ((y === 6 || y === 8) && x >= 0 && x <= 14) {
            return x % 2 === 0 ? '#f8fafc' : '#e2e8f0'; // Horizontal paths
        }
        return '#f0f0f0'; // Default color
    }

    createHomeBase(playerIndex) {
        const basePositions = [
            { x: 1, y: 1 },   // Red (top-left)
            { x: 11, y: 1 },  // Blue (top-right)
            { x: 1, y: 11 },  // Green (bottom-left)
            { x: 11, y: 11 }  // Yellow (bottom-right)
        ];
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const pos = basePositions[playerIndex];

        // Create home base with proper coloring
        const home = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        home.setAttribute('x', pos.x);
        home.setAttribute('y', pos.y);
        home.setAttribute('width', 3);
        home.setAttribute('height', 3);
        home.setAttribute('fill', colors[playerIndex]);
        home.setAttribute('opacity', '0.2');
        home.setAttribute('rx', '0.3');
        home.setAttribute('ry', '0.3');
        home.setAttribute('stroke', colors[playerIndex]);
        home.setAttribute('stroke-width', '0.1');
        return home;
    }

    getBoardPath() {
        // Classic Ludo board path coordinates
        const pathSize = 52; // Total cells in main path
        const commonPath = [];
        
        // Generate common path coordinates
        for (let i = 0; i < pathSize; i++) {
            let x, y;
            if (i < 13) { // Top path
                x = 6 + i;
                y = 1;
            } else if (i < 26) { // Right path
                x = 13;
                y = 1 + (i - 13);
            } else if (i < 39) { // Bottom path
                x = 13 - (i - 26);
                y = 13;
            } else { // Left path
                x = 1;
                y = 13 - (i - 39);
            }
            commonPath.push({x, y});
        }

        return {
            commonPath,
            safeZones: [
                {x:6,y:1}, {x:1,y:6}, {x:6,y:9}, {x:9,y:6} // Star positions
            ],
            homeStretches: {
                red: Array.from({length: 5}, (_, i) => ({x: 6 + i, y: 0})),
                blue: Array.from({length: 5}, (_, i) => ({x: 14, y: 6 + i})),
                green: Array.from({length: 5}, (_, i) => ({x: 6 + i, y: 14})),
                yellow: Array.from({length: 5}, (_, i) => ({x: 0, y: 6 + i}))
            }
        };
    }

    initializePieces() {
        this.players.forEach((player, playerIndex) => {
            player.pieces = [];
            for (let i = 0; i < 4; i++) {
                player.pieces.push({
                    id: `${player.color}-${i}`,
                    position: this.getStartingPosition(playerIndex, i),
                    isHome: true,
                    pathIndex: 0
                });
            }
            this.renderPieces(playerIndex);
        });
    }

    getStartingPosition(playerIndex, pieceIndex) {
        const basePositions = [
            { x: 2, y: 2 },   // Red pieces
            { x: 12, y: 2 },  // Blue pieces
            { x: 2, y: 12 },  // Green pieces
            { x: 12, y: 12 }  // Yellow pieces
        ];
        const offsets = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 }
        ];
        const pos = basePositions[playerIndex];
        const offset = offsets[pieceIndex];
        return {
            x: pos.x + offset.x,
            y: pos.y + offset.y
        };
    }

    renderPieces(playerIndex) {
        const player = this.players[playerIndex];
        const svg = document.querySelector('#gameBoard svg');
        
        player.pieces.forEach(piece => {
            let pieceElement = document.getElementById(piece.id);
            if (!pieceElement) {
                pieceElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                pieceElement.setAttribute('id', piece.id);
                pieceElement.setAttribute('r', '0.4');
                pieceElement.setAttribute('stroke', '#ffffff');
                pieceElement.setAttribute('stroke-width', '0.1');
                svg.appendChild(pieceElement);
            }
            pieceElement.setAttribute('cx', piece.position.x + 0.5);
            pieceElement.setAttribute('cy', piece.position.y + 0.5);
            pieceElement.setAttribute('fill', this.getPlayerColor(playerIndex));
        });
    }

    getPlayerColor(playerIndex) {
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        return colors[playerIndex];
    }

    rollDice() {
        if (this.gameState !== 'waiting') return;

        this.gameState = 'rolling';
        const dice = document.getElementById('diceContainer');
        const diceValue = document.getElementById('diceValue');

        // Add rolling animation
        dice.classList.add('dice-rolling');
        diceValue.textContent = '...';

        // Simulate dice roll
        let rolls = 0;
        const maxRolls = 10;
        const rollInterval = setInterval(() => {
            this.diceValue = Math.floor(Math.random() * 6) + 1;
            rolls++;

            if (rolls >= maxRolls) {
                clearInterval(rollInterval);
                dice.classList.remove('dice-rolling');
                diceValue.textContent = this.diceValue;
                this.handleDiceResult();
            }
        }, 100);
    }

    handleDiceResult() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        console.log(`${currentPlayer.name} rolled ${this.diceValue}`);

        if (currentPlayer.isAI) {
            // Simple AI logic
            setTimeout(() => {
                this.makeAIMove();
            }, 1000);
        } else {
            this.gameState = 'moving';
            // TODO: Implement player piece selection
        }
    }

    makeAIMove() {
        const player = this.players[this.currentPlayerIndex];
        const movablePieces = player.pieces.filter(piece => 
            !piece.isHome || this.diceValue === 6
        );

        if (movablePieces.length > 0) {
            // Simple AI: pick first movable piece
            const pieceToMove = movablePieces[0];
            this.movePiece(pieceToMove);
        } else {
            this.endTurn();
        }
    }

    movePiece(piece) {
        const player = this.players[this.currentPlayerIndex];
        const boardPath = this.getBoardPath();
        
        if (piece.isHome && this.diceValue === 6) {
            // Move piece out of home
            piece.isHome = false;
            piece.pathIndex = 0;
            piece.position = boardPath.commonPath[this.getPlayerStartIndex(this.currentPlayerIndex)];
        } else if (!piece.isHome) {
            // Move along the path
            piece.pathIndex += this.diceValue;
            
            if (piece.pathIndex < boardPath.commonPath.length) {
                // Still on common path
                piece.position = boardPath.commonPath[piece.pathIndex];
            } else {
                const homeStretchIndex = piece.pathIndex - boardPath.commonPath.length;
                const homeStretch = boardPath.homeStretches[player.color];
                
                if (homeStretchIndex < homeStretch.length) {
                    // Moving into home stretch
                    piece.position = homeStretch[homeStretchIndex];
                } else {
                    // Piece has reached home
                    piece.isHome = true;
                    piece.pathIndex = 0;
                    piece.position = this.getStartingPosition(this.currentPlayerIndex, 0);
                }
            }
            
            // Check for captures
            this.checkForCapture(piece);
        }

        this.renderPieces(this.currentPlayerIndex);
        this.updatePieces();
        this.endTurn();
    }

    getPlayerStartIndex(playerIndex) {
        // Starting positions on common path for each player
        return [0, 13, 26, 39][playerIndex];
    }

    checkForCapture(piece) {
        const currentPlayer = this.players[this.currentPlayerIndex];
        const boardPath = this.getBoardPath();
        
        // Skip safe zones
        if (boardPath.safeZones.some(zone => 
            zone.x === piece.position.x && zone.y === piece.position.y)) {
            return;
        }

        // Check other players' pieces
        this.players.forEach((player, playerIndex) => {
            if (playerIndex === this.currentPlayerIndex) return;
            
            player.pieces.forEach(otherPiece => {
                if (!otherPiece.isHome && 
                    otherPiece.position.x === piece.position.x && 
                    otherPiece.position.y === piece.position.y) {
                    // Capture opponent's piece
                    otherPiece.isHome = true;
                    otherPiece.pathIndex = 0;
                    otherPiece.position = this.getStartingPosition(playerIndex, 0);
                    this.renderPieces(playerIndex);
                    this.audio.play('capture');
                }
            });
        });
    }

    async endTurn() {
        // Check for win condition
        const currentPlayer = this.players[this.currentPlayerIndex];
        const allPiecesHome = currentPlayer.pieces.every(piece => piece.isHome);
        
        if (allPiecesHome) {
            this.showWinMessage(currentPlayer);
            return;
        }

        this.gameState = 'waiting';
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        // Update game state in Firebase
        if (this.isHost) {
            await this.updateGameState({
                currentPlayerId: this.currentPlayerIndex
            });
        }

        this.updatePlayerDisplay();

        if (this.players[this.currentPlayerIndex].isAI) {
            setTimeout(() => this.rollDice(), 1000);
        }
    }

    async updateGameState(newState) {
        if (this.gameStateRef) {
            await this.gameStateRef.update(newState);
        }
    }

    async updatePieces() {
        // Push all pieces data to Firebase
        if (this.piecesRef) {
            const piecesData = {};
            this.players.forEach(player => {
                player.pieces.forEach(piece => {
                    piecesData[piece.id] = {
                        position: piece.position,
                        isHome: piece.isHome,
                        pathIndex: piece.pathIndex
                    };
                });
            });
            await this.piecesRef.update(piecesData);
        }
    }

    showWinMessage(winner) {
        const board = document.getElementById('gameBoard');
        const winDiv = document.createElement('div');
        winDiv.className = 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10';
        winDiv.innerHTML = `
            <div class="bg-white p-8 rounded-lg text-center">
                <h2 class="text-3xl font-bold mb-4">${winner.name} Wins!</h2>
                <p class="text-xl mb-6">Congratulations!</p>
                <button id="newGameBtn" class="btn-primary px-6 py-2">
                    New Game
                </button>
            </div>
        `;
        board.appendChild(winDiv);
        
        document.getElementById('newGameBtn').addEventListener('click', () => {
            window.location.reload();
        });
    }

    updatePlayerDisplay() {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;

        playersList.querySelectorAll('.player-item').forEach(el => el.remove());

        this.players.forEach((player, index) => {
            const playerEl = document.createElement('div');
            playerEl.className = `flex items-center player-item ${index === this.currentPlayerIndex ? 'font-bold' : 'opacity-50'}`;
            
            const pieceEl = document.createElement('div');
            pieceEl.className = `piece mr-3 ${this.getPlayerColorClass(index)}`;
            
            const nameEl = document.createElement('span');
            nameEl.textContent = player.name + (index === this.currentPlayerIndex ? ' (Current)' : '');

            playerEl.appendChild(pieceEl);
            playerEl.appendChild(nameEl);
            playersList.appendChild(playerEl);
        });
    }

    getPlayerColorClass(playerIndex) {
        const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
        return colors[playerIndex];
    }
}

export default LudoGame;