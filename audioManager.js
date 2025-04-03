class AudioManager {
    constructor() {
        this.sounds = {
            diceRoll: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-game-dice-roll-1994.mp3'),
            pieceMove: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-coin-216.mp3'),
            capture: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3'),
            win: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3')
        };
        this.enabled = true;
    }

    play(soundName) {
        if (!this.enabled) return;
        
        try {
            const sound = this.sounds[soundName];
            sound.currentTime = 0;
            sound.play();
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

export default AudioManager;