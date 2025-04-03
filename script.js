// DOM Elements
const multiplayerBtn = document.getElementById('multiplayerBtn');
const aiBtn = document.getElementById('aiBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const settingsBtn = document.getElementById('settingsBtn');
const multiplayerOptions = document.getElementById('multiplayerOptions');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const createRoomBtn = document.getElementById('createRoomBtn');

// Firebase initialization
import { database } from './firebaseConfig.js';

// Game state
let currentRoom = null;
let isHost = false;

// Navigation Functions
async function navigateToGame(mode) {
    if (mode === 'multiplayer') {
        // Show/hide multiplayer options
        multiplayerOptions.classList.toggle('hidden');
        multiplayerBtn.classList.toggle('hidden');
        return;
    }
    
    // Store game mode in sessionStorage
    sessionStorage.setItem('gameMode', mode);
    // Redirect to game page
    window.location.href = 'game.html';
}

// Multiplayer Functions
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

async function createRoom() {
    const roomCode = generateRoomCode();
    isHost = true;
    
    try {
        await database.ref(`rooms/${roomCode}`).set({
            players: {
                player1: {
                    id: Date.now().toString(),
                    name: 'Player 1',
                    color: 'red',
                    ready: false
                }
            },
            gameState: 'waiting',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        currentRoom = roomCode;
        sessionStorage.setItem('roomCode', roomCode);
        sessionStorage.setItem('playerId', 'player1');
        sessionStorage.setItem('isHost', 'true');
        sessionStorage.setItem('gameMode', 'multiplayer');
        
        window.location.href = 'game.html';
    } catch (error) {
        console.error('Error creating room:', error);
        alert('Failed to create room. Please try again.');
    }
}

async function joinRoom() {
    const roomCode = roomCodeInput.value.trim();
    if (!roomCode) return;

    try {
        const snapshot = await database.ref(`rooms/${roomCode}`).once('value');
        if (!snapshot.exists()) {
            alert('Room not found. Please check the code.');
            return;
        }

        const roomData = snapshot.val();
        const playerCount = Object.keys(roomData.players).length;
        
        if (playerCount >= 4) {
            alert('Room is full (max 4 players)');
            return;
        }

        const playerId = `player${playerCount + 1}`;
        const colors = ['red', 'blue', 'green', 'yellow'];
        
        await database.ref(`rooms/${roomCode}/players/${playerId}`).set({
            id: Date.now().toString(),
            name: playerId,
            color: colors[playerCount],
            ready: false
        });

        currentRoom = roomCode;
        sessionStorage.setItem('roomCode', roomCode);
        sessionStorage.setItem('playerId', playerId);
        sessionStorage.setItem('isHost', 'false');
        sessionStorage.setItem('gameMode', 'multiplayer');
        
        window.location.href = 'game.html';
    } catch (error) {
        console.error('Error joining room:', error);
        alert('Failed to join room. Please try again.');
    }
}

// Event Listeners
if (multiplayerBtn) {
    multiplayerBtn.addEventListener('click', () => navigateToGame('multiplayer'));
}

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', joinRoom);
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', createRoom);
}

if (aiBtn) {
    aiBtn.addEventListener('click', () => navigateToGame('ai'));
}

if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
        console.log('Leaderboard selected');
        // Will implement leaderboard view later
    });
}

if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        console.log('Settings selected');
        // Will implement settings view later
    });
}

// Initialize Firebase (will be implemented later)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Check if we're on the game page
if (window.location.pathname.includes('game.html')) {
    // Load the game module dynamically
    import('./ludoGame.js')
        .then(module => {
            const game = new module.default();
            game.initGame();
        })
        .catch(err => console.error('Error loading game module:', err));
}