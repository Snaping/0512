const Game = {
    isPlaying: false,
    isPaused: false,
    gameTime: 0,
    lastTime: 0,
    animationId: null,
    gameEnding: false,
    gameIntervalId: null,

    settings: {
        difficulty: 'normal',
        skin: 'default'
    },

    difficulties: {
        easy: {
            name: '简单',
            noteSpeed: 3,
            perfectWindow: 80,
            goodWindow: 150,
            comboMultiplier: 1.0,
            noteFrequency: 1200,
            maxNotes: 60
        },
        normal: {
            name: '普通',
            noteSpeed: 5,
            perfectWindow: 60,
            goodWindow: 120,
            comboMultiplier: 1.0,
            noteFrequency: 900,
            maxNotes: 80
        },
        hard: {
            name: '困难',
            noteSpeed: 7,
            perfectWindow: 45,
            goodWindow: 90,
            comboMultiplier: 1.2,
            noteFrequency: 700,
            maxNotes: 100
        },
        expert: {
            name: '专家',
            noteSpeed: 9,
            perfectWindow: 30,
            goodWindow: 60,
            comboMultiplier: 1.5,
            noteFrequency: 500,
            maxNotes: 120
        }
    },

    stats: {
        score: 0,
        combo: 0,
        maxCombo: 0,
        perfectCount: 0,
        goodCount: 0,
        missCount: 0,
        totalNotes: 0
    },

    notes: [],
    notesGenerated: 0,
    lastNoteTime: 0,

    audioContext: null,

    keys: {
        'd': 0,
        'f': 1,
        'j': 2,
        'k': 3
    },

    tracks: [],
    judgementLine: null,
    effectsLayer: null,
    judgementDisplay: null,

    init() {
        this.initAudio();
        this.cacheDOM();
        this.bindEvents();
        this.applySkin();
        this.updateDifficultyDisplay();
    },

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    },

    playSound(frequency, duration = 0.1, type = 'sine') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    },

    playHitSound(judgement) {
        if (judgement === 'perfect') {
            this.playSound(880, 0.1, 'sine');
        } else if (judgement === 'good') {
            this.playSound(660, 0.1, 'sine');
        } else {
            this.playSound(220, 0.2, 'triangle');
        }
    },

    cacheDOM() {
        this.tracks = document.querySelectorAll('.track');
        this.judgementLine = document.getElementById('judgementLine');
        this.effectsLayer = document.getElementById('effectsLayer');
        this.judgementDisplay = document.getElementById('judgementDisplay');
    },

    bindEvents() {
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('difficultyBtn').addEventListener('click', () => this.showScreen('difficulty-screen'));
        document.getElementById('skinBtn').addEventListener('click', () => this.showScreen('skin-screen'));
        document.getElementById('helpBtn').addEventListener('click', () => this.showScreen('help-screen'));
        
        document.getElementById('backFromDifficulty').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('backFromSkin').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('backFromHelp').addEventListener('click', () => this.showScreen('menu'));
        
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseGame());
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('quitBtn').addEventListener('click', () => this.quitGame());
        
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.quitGame());

        document.querySelectorAll('.difficulty-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = e.target.dataset.difficulty;
                this.setDifficulty(difficulty);
            });
        });

        document.querySelectorAll('.skin-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const skin = e.currentTarget.dataset.skin;
                this.setSkin(skin);
            });
        });

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    },

    setDifficulty(difficulty) {
        this.settings.difficulty = difficulty;
        
        document.querySelectorAll('.difficulty-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.difficulty === difficulty);
        });

        const settings = this.difficulties[difficulty];
        document.getElementById('difficultyInfo').innerHTML = `
            <h3>${settings.name}难度</h3>
            <p>音符速度: ${difficulty === 'easy' ? '慢' : difficulty === 'normal' ? '中等' : difficulty === 'hard' ? '快' : '极速'}</p>
            <p>判定窗口: ${difficulty === 'easy' ? '宽松' : difficulty === 'normal' ? '标准' : difficulty === 'hard' ? '严格' : '非常严格'}</p>
            <p>连击加成: ${settings.comboMultiplier}x</p>
        `;

        this.updateDifficultyDisplay();
    },

    updateDifficultyDisplay() {
        document.getElementById('currentDifficulty').textContent = 
            this.difficulties[this.settings.difficulty].name;
    },

    setSkin(skin) {
        this.settings.skin = skin;
        
        document.querySelectorAll('.skin-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.skin === skin);
        });

        this.applySkin();
    },

    applySkin() {
        document.body.className = `skin-${this.settings.skin}`;
    },

    startGame() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.resetStats();
        this.notes = [];
        this.notesGenerated = 0;
        this.lastNoteTime = 0;
        this.gameTime = 0;
        this.lastTime = Date.now();
        this.gameEnding = false;
        
        this.clearNotes();
        
        this.isPlaying = true;
        this.isPaused = false;
        
        this.showScreen('game-screen');
        
        if (this.gameIntervalId) {
            clearInterval(this.gameIntervalId);
        }
        
        this.gameIntervalId = setInterval(() => {
            this.gameLoop();
        }, 16);
    },

    resetStats() {
        this.stats = {
            score: 0,
            combo: 0,
            maxCombo: 0,
            perfectCount: 0,
            goodCount: 0,
            missCount: 0,
            totalNotes: 0
        };
        this.updateHUD();
    },

    clearNotes() {
        this.tracks.forEach(track => {
            track.querySelectorAll('.note').forEach(note => note.remove());
        });
        this.effectsLayer.innerHTML = '';
        this.judgementDisplay.textContent = '';
    },

    pauseGame() {
        if (!this.isPlaying) return;
        this.isPaused = true;
        this.showScreen('pause-screen');
    },

    resumeGame() {
        this.isPaused = false;
        this.lastTime = Date.now();
        this.showScreen('game-screen');
    },

    restartGame() {
        this.startGame();
    },

    quitGame() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this.gameIntervalId) {
            clearInterval(this.gameIntervalId);
            this.gameIntervalId = null;
        }
        this.showScreen('menu');
    },

    gameLoop() {
        if (!this.isPlaying || this.isPaused) return;

        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        this.gameTime += deltaTime;

        this.generateNotes();
        this.updateNotes(deltaTime);
        this.checkMissedNotes();

        const difficulty = this.difficulties[this.settings.difficulty];
        
        const activeNotes = this.notes.filter(note => !note.hit && !note.missed);
        
        const maxGameTime = 60000;
        const shouldEndGame = (!this.gameEnding && 
            this.notesGenerated >= difficulty.maxNotes && 
            activeNotes.length === 0) || 
            this.gameTime > maxGameTime;
        
        if (shouldEndGame) {
            this.gameEnding = true;
            this.isPlaying = false;
            
            if (this.gameIntervalId) {
                clearInterval(this.gameIntervalId);
                this.gameIntervalId = null;
            }
            
            this.endGame();
        }
    },

    generateNotes() {
        const difficulty = this.difficulties[this.settings.difficulty];
        
        if (this.notesGenerated >= difficulty.maxNotes) return;
        
        if (this.gameTime - this.lastNoteTime >= difficulty.noteFrequency) {
            const trackIndex = Math.floor(Math.random() * 4);
            const track = this.tracks[trackIndex];
            
            const note = document.createElement('div');
            note.className = 'note';
            note.style.top = '-25px';
            
            track.appendChild(note);
            
            const targetTime = this.calculateTargetTime();
            
            this.notes.push({
                element: note,
                trackIndex: trackIndex,
                position: -25,
                hit: false,
                missed: false,
                targetTime: targetTime
            });
            
            this.notesGenerated++;
            this.lastNoteTime = this.gameTime;
            this.stats.totalNotes++;
        }
    },

    calculateTargetTime() {
        const difficulty = this.difficulties[this.settings.difficulty];
        const gameAreaHeight = document.querySelector('.game-area').offsetHeight;
        const judgementLineTop = gameAreaHeight - 90;
        
        const timeToReachJudgement = (judgementLineTop + 25) / difficulty.noteSpeed * 16.67;
        
        return this.gameTime + timeToReachJudgement;
    },

    updateNotes(deltaTime) {
        const difficulty = this.difficulties[this.settings.difficulty];
        const distance = difficulty.noteSpeed * (deltaTime / 16.67);

        this.notes.forEach(note => {
            if (!note.hit && !note.missed) {
                note.position += distance;
                note.element.style.top = note.position + 'px';
            }
        });
    },

    checkMissedNotes() {
        const difficulty = this.difficulties[this.settings.difficulty];
        
        this.notes = this.notes.filter(note => {
            if (note.hit) {
                return true;
            }
            
            const timeDiff = this.gameTime - note.targetTime;
            
            if (!note.missed && timeDiff > difficulty.goodWindow) {
                note.missed = true;
                this.handleMiss(note);
            }
            
            if (timeDiff > 2000) {
                note.element.remove();
                return false;
            }
            
            return true;
        });
    },

    handleKeyDown(e) {
        if (!this.isPlaying || this.isPaused) return;
        
        const key = e.key.toLowerCase();
        
        if (this.keys[key] === undefined) return;
        
        const trackIndex = this.keys[key];
        
        const keyHints = document.querySelectorAll('.key-hint');
        keyHints[trackIndex].classList.add('active');
        
        this.hitNote(trackIndex);
    },

    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        
        if (this.keys[key] === undefined) return;
        
        const trackIndex = this.keys[key];
        const keyHints = document.querySelectorAll('.key-hint');
        keyHints[trackIndex].classList.remove('active');
    },

    hitNote(trackIndex) {
        const difficulty = this.difficulties[this.settings.difficulty];
        
        const trackNotes = this.notes.filter(note => 
            !note.hit && !note.missed && note.trackIndex === trackIndex
        );
        
        if (trackNotes.length === 0) return;
        
        let closestNote = null;
        let closestTimeDiff = Infinity;
        
        trackNotes.forEach(note => {
            const timeDiff = Math.abs(this.gameTime - note.targetTime);
            if (timeDiff < closestTimeDiff) {
                closestTimeDiff = timeDiff;
                closestNote = note;
            }
        });

        if (closestNote && closestTimeDiff <= difficulty.goodWindow) {
            if (closestTimeDiff <= difficulty.perfectWindow) {
                this.handleHit(closestNote, 'perfect');
            } else {
                this.handleHit(closestNote, 'good');
            }
        }
    },

    handleHit(note, judgement) {
        note.hit = true;
        note.element.classList.add('hit');
        
        this.stats.combo++;
        if (this.stats.combo > this.stats.maxCombo) {
            this.stats.maxCombo = this.stats.combo;
        }

        const difficulty = this.difficulties[this.settings.difficulty];
        let baseScore = judgement === 'perfect' ? 100 : 50;
        let comboBonus = Math.floor(this.stats.combo / 10) * 10;
        let finalScore = Math.floor((baseScore + comboBonus) * difficulty.comboMultiplier);
        
        this.stats.score += finalScore;
        
        if (judgement === 'perfect') {
            this.stats.perfectCount++;
        } else {
            this.stats.goodCount++;
        }

        this.showJudgement(judgement);
        this.showEffect(note.trackIndex);
        this.playHitSound(judgement);
        this.updateHUD();
        
        setTimeout(() => {
            note.element.remove();
            this.notes = this.notes.filter(n => n !== note);
        }, 200);
    },

    handleMiss(note) {
        this.stats.combo = 0;
        this.stats.missCount++;
        
        this.showJudgement('miss');
        this.playHitSound('miss');
        this.updateHUD();
    },

    showJudgement(judgement) {
        this.judgementDisplay.textContent = judgement;
        this.judgementDisplay.className = `judgement-display ${judgement}`;
        
        this.judgementDisplay.style.animation = 'none';
        this.judgementDisplay.offsetHeight;
        this.judgementDisplay.style.animation = 'judgementPop 0.5s ease-out forwards';
    },

    showEffect(trackIndex) {
        const effect = document.createElement('div');
        effect.className = 'effect';
        effect.style.left = (trackIndex * 100 + 50) + 'px';
        
        this.effectsLayer.appendChild(effect);
        
        setTimeout(() => {
            effect.remove();
        }, 400);
    },

    updateHUD() {
        document.getElementById('score').textContent = this.stats.score.toLocaleString();
        document.getElementById('combo').textContent = this.stats.combo;
        
        const total = this.stats.perfectCount + this.stats.goodCount + this.stats.missCount;
        let accuracy = 100;
        
        if (total > 0) {
            const accuracyPoints = (this.stats.perfectCount * 100) + (this.stats.goodCount * 50);
            accuracy = (accuracyPoints / (total * 100)) * 100;
        }
        
        document.getElementById('accuracy').textContent = accuracy.toFixed(1) + '%';
    },

    endGame() {
        this.isPlaying = false;
        this.isPaused = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.showResults();
    },

    showResults() {
        document.getElementById('finalScore').textContent = this.stats.score.toLocaleString();
        document.getElementById('maxCombo').textContent = this.stats.maxCombo;
        
        const total = this.stats.perfectCount + this.stats.goodCount + this.stats.missCount;
        let accuracy = 100;
        
        if (total > 0) {
            const accuracyPoints = (this.stats.perfectCount * 100) + (this.stats.goodCount * 50);
            accuracy = (accuracyPoints / (total * 100)) * 100;
        }
        
        document.getElementById('finalAccuracy').textContent = accuracy.toFixed(1) + '%';
        document.getElementById('perfectCount').textContent = this.stats.perfectCount;
        document.getElementById('goodCount').textContent = this.stats.goodCount;
        document.getElementById('missCount').textContent = this.stats.missCount;

        const grade = this.calculateGrade(accuracy);
        document.getElementById('gradeDisplay').textContent = grade;
        document.getElementById('gradeDisplay').className = `grade-display ${grade}`;

        this.showScreen('result-screen');
    },

    calculateGrade(accuracy) {
        if (accuracy >= 95) return 'S';
        if (accuracy >= 90) return 'A';
        if (accuracy >= 80) return 'B';
        if (accuracy >= 70) return 'C';
        return 'D';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Game.init();
    
    document.querySelector('.difficulty-option[data-difficulty="normal"]').classList.add('selected');
    document.querySelector('.skin-option[data-skin="default"]').classList.add('selected');
});
