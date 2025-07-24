class SudokuPro {
    constructor() {
        this.gameState = {
            gameId: null,
            difficulty: 'medium',
            board: [],
            solution: [],
            originalBoard: [],
            notes: [],
            selectedCell: null,
            gameStartTime: null,
            timerInterval: null,
            isGameComplete: false,
            hintsUsed: 0,
            maxHints: 5,
            movesHistory: [],
            redoStack: [],
            isNoteMode: false,
            autoCheck: true
        };
        
        this.settings = {
            theme: 'light',
            animations: true,
            autoCheck: true,
            sound: true
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.applyTheme();
    }
    
    initializeElements() {
        // Welcome screen elements
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.gameInterface = document.getElementById('gameInterface');
        this.continueBtn = document.getElementById('continueBtn');
        
        // Game interface elements
        this.boardElement = document.getElementById('sudokuBoard');
        this.timerElement = document.getElementById('timer');
        this.statusMessage = document.getElementById('statusMessage');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        // Header elements
        this.gameModeTitle = document.getElementById('gameModeTitle');
        this.difficultyBadge = document.getElementById('difficultyBadge');
        this.backBtn = document.getElementById('backBtn');
        this.statsBtn = document.getElementById('statsBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        
        // Control elements
        this.difficultySelect = document.getElementById('difficulty');
        this.newGameBtn = document.getElementById('newGameBtn');
        this.undoBtn = document.getElementById('undoBtn');
        this.redoBtn = document.getElementById('redoBtn');
        this.hintBtn = document.getElementById('hintBtn');
        this.hintCount = document.getElementById('hintCount');
        this.checkBtn = document.getElementById('checkBtn');
        
        // Number pad elements
        this.numberBtns = document.querySelectorAll('.number-btn');
        this.noteBtn = document.getElementById('noteBtn');
        
        // Modal elements
        this.instructionsModal = document.getElementById('instructionsModal');
        this.winModal = document.getElementById('winModal');
        this.statsModal = document.getElementById('statsModal');
        this.settingsModal = document.getElementById('settingsModal');
        this.errorModal = document.getElementById('errorModal');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Modal buttons
        this.startGameBtn = document.getElementById('startGameBtn');
        this.playAgainBtn = document.getElementById('playAgainBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.closeStatsBtn = document.getElementById('closeStatsBtn');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        this.closeErrorBtn = document.getElementById('closeErrorBtn');
        
        // Win modal elements
        this.finalTime = document.getElementById('finalTime');
        this.finalHints = document.getElementById('finalHints');
        this.finalDifficulty = document.getElementById('finalDifficulty');
        
        // Stats modal elements
        this.totalGames = document.getElementById('totalGames');
        this.completedGames = document.getElementById('completedGames');
        this.totalTime = document.getElementById('totalTime');
        this.totalHints = document.getElementById('totalHints');
        this.bestTimesList = document.getElementById('bestTimesList');
        
        // Settings elements
        this.themeSelect = document.getElementById('themeSelect');
        this.animationToggle = document.getElementById('animationToggle');
        this.autoCheckToggle = document.getElementById('autoCheckToggle');
        this.soundToggle = document.getElementById('soundToggle');
        
        // Error modal elements
        this.errorMessage = document.getElementById('errorMessage');
    }
    
    bindEvents() {
        // Welcome screen events
        this.continueBtn.addEventListener('click', () => this.startGame());
        
        // Game interface events
        this.backBtn.addEventListener('click', () => this.showWelcomeScreen());
        this.statsBtn.addEventListener('click', () => this.showStats());
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        
        // Control events
        this.difficultySelect.addEventListener('change', (e) => {
            this.gameState.difficulty = e.target.value;
            this.showInstructions();
        });
        this.newGameBtn.addEventListener('click', () => this.showInstructions());
        this.undoBtn.addEventListener('click', () => this.undoMove());
        this.redoBtn.addEventListener('click', () => this.redoMove());
        this.hintBtn.addEventListener('click', () => this.getHint());
        this.checkBtn.addEventListener('click', () => this.checkSolution());
        
        // Number pad events
        this.numberBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const number = parseInt(btn.dataset.number);
                this.makeMove(number);
            });
        });
        this.noteBtn.addEventListener('click', () => this.toggleNoteMode());
        
        // Modal events
        this.startGameBtn.addEventListener('click', () => {
            this.hideModal(this.instructionsModal);
            this.startNewGame();
        });
        this.playAgainBtn.addEventListener('click', () => {
            this.hideModal(this.winModal);
            this.showInstructions();
        });
        this.shareBtn.addEventListener('click', () => this.shareResult());
        this.closeStatsBtn.addEventListener('click', () => this.hideModal(this.statsModal));
        this.closeSettingsBtn.addEventListener('click', () => this.hideModal(this.settingsModal));
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.closeErrorBtn.addEventListener('click', () => this.hideModal(this.errorModal));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Click outside modal to close
        [this.instructionsModal, this.winModal, this.statsModal, this.settingsModal, this.errorModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal);
                }
            });
        });
    }
    
    startGame() {
        this.hideWelcomeScreen();
        this.showGameInterface();
        this.showInstructions();
    }
    
    showWelcomeScreen() {
        this.welcomeScreen.style.display = 'flex';
        this.gameInterface.style.display = 'none';
        this.resetGameState();
    }
    
    hideWelcomeScreen() {
        this.welcomeScreen.style.display = 'none';
        this.gameInterface.style.display = 'flex';
    }
    
    showGameInterface() {
        this.gameInterface.style.display = 'flex';
        this.updateGameModeTitle();
    }
    
    updateGameModeTitle() {
        this.gameModeTitle.textContent = 'Sudoku Pro';
    }
    
    showInstructions() {
        this.showModal(this.instructionsModal);
    }
    
    async startNewGame() {
        try {
            this.showLoading(true);
            this.resetGameState();
            
            const response = await fetch('/api/new-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    difficulty: this.gameState.difficulty
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState.gameId = data.game_id;
                this.gameState.board = data.puzzle;
                this.gameState.solution = data.solution;
                this.gameState.originalBoard = data.puzzle.map(row => [...row]);
                this.gameState.notes = Array(9).fill().map(() => Array(9).fill().map(() => []));
                
                this.renderBoard();
                this.startTimer();
                this.updateProgress();
                this.updateUndoRedoButtons();
                this.showStatus('New game started! Click on cells to play.', 'success');
            } else {
                throw new Error(data.error || 'Failed to generate puzzle');
            }
        } catch (error) {
            console.error('Error starting new game:', error);
            this.showError('Failed to start new game. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
    
    renderBoard() {
        this.boardElement.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                const cell = document.createElement('button');
                cell.className = 'cell';
                cell.dataset.row = i;
                cell.dataset.col = j;
                
                const value = this.gameState.board[i][j];
                if (value !== 0) {
                    cell.textContent = value;
                    if (this.gameState.originalBoard[i][j] !== 0) {
                        cell.classList.add('original');
                    } else {
                        cell.classList.add('filled');
                    }
                } else if (this.gameState.notes[i][j].length > 0) {
                    this.renderNotes(cell, this.gameState.notes[i][j]);
                }
                
                cell.addEventListener('click', () => this.selectCell(i, j));
                this.boardElement.appendChild(cell);
            }
        }
    }
    
    renderNotes(cell, notes) {
        const notesContainer = document.createElement('div');
        notesContainer.className = 'notes';
        
        for (let num = 1; num <= 9; num++) {
            const note = document.createElement('div');
            note.className = 'note';
            if (notes.includes(num)) {
                note.textContent = num;
            }
            notesContainer.appendChild(note);
        }
        
        cell.appendChild(notesContainer);
    }
    
    selectCell(row, col) {
        if (this.gameState.originalBoard[row][col] !== 0) {
            return; // Can't select original cells
        }
        
        // Remove previous selection
        if (this.gameState.selectedCell) {
            this.gameState.selectedCell.classList.remove('selected');
        }
        
        // Select new cell
        this.gameState.selectedCell = this.boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        this.gameState.selectedCell.classList.add('selected');
        this.gameState.selectedCell.focus();
        
        this.updateNumberPad();
    }
    
    updateNumberPad() {
        if (!this.gameState.selectedCell) return;
        
        const row = parseInt(this.gameState.selectedCell.dataset.row);
        const col = parseInt(this.gameState.selectedCell.dataset.col);
        const value = this.gameState.board[row][col];
        
        this.numberBtns.forEach(btn => {
            const number = parseInt(btn.dataset.number);
            btn.classList.remove('active');
            
            if (number === value) {
                btn.classList.add('active');
            }
        });
        
        this.noteBtn.classList.toggle('active', this.gameState.isNoteMode);
    }
    
    async makeMove(value) {
        if (!this.gameState.selectedCell || this.gameState.isGameComplete) return;
        
        const row = parseInt(this.gameState.selectedCell.dataset.row);
        const col = parseInt(this.gameState.selectedCell.dataset.col);
        
        if (this.gameState.originalBoard[row][col] !== 0) return;
        
        try {
            const response = await fetch('/api/make-move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: this.gameState.gameId,
                    row: row,
                    col: col,
                    value: value,
                    move_type: this.gameState.isNoteMode ? 'note' : 'number'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState.board = data.current_board;
                this.gameState.notes = data.notes;
                this.gameState.movesHistory = data.moves_history || this.gameState.movesHistory;
                this.gameState.redoStack = [];
                
                this.renderBoard();
                this.updateProgress();
                this.updateUndoRedoButtons();
                
                if (data.is_complete) {
                    this.handleGameComplete();
                }
            } else {
                throw new Error(data.error || 'Failed to make move');
            }
        } catch (error) {
            console.error('Error making move:', error);
            this.showError('Failed to make move. Please try again.');
        }
    }
    
    async undoMove() {
        if (!this.gameState.gameId) return;
        
        try {
            const response = await fetch('/api/undo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: this.gameState.gameId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState.board = data.current_board;
                this.gameState.notes = data.notes;
                this.gameState.movesHistory = data.moves_history || this.gameState.movesHistory;
                this.gameState.redoStack = data.redo_stack || this.gameState.redoStack;
                
                this.renderBoard();
                this.updateProgress();
                this.updateUndoRedoButtons();
            } else {
                throw new Error(data.error || 'Failed to undo move');
            }
        } catch (error) {
            console.error('Error undoing move:', error);
            this.showError('Failed to undo move. Please try again.');
        }
    }
    
    async redoMove() {
        if (!this.gameState.gameId) return;
        
        try {
            const response = await fetch('/api/redo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: this.gameState.gameId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState.board = data.current_board;
                this.gameState.notes = data.notes;
                this.gameState.movesHistory = data.moves_history || this.gameState.movesHistory;
                this.gameState.redoStack = data.redo_stack || this.gameState.redoStack;
                
                this.renderBoard();
                this.updateProgress();
                this.updateUndoRedoButtons();
            } else {
                throw new Error(data.error || 'Failed to redo move');
            }
        } catch (error) {
            console.error('Error redoing move:', error);
            this.showError('Failed to redo move. Please try again.');
        }
    }
    
    updateUndoRedoButtons() {
        this.undoBtn.disabled = this.gameState.movesHistory.length === 0;
        this.redoBtn.disabled = this.gameState.redoStack.length === 0;
    }
    
    toggleNoteMode() {
        this.gameState.isNoteMode = !this.gameState.isNoteMode;
        this.noteBtn.classList.toggle('active', this.gameState.isNoteMode);
        this.updateNumberPad();
    }
    
    async getHint() {
        if (!this.gameState.selectedCell || this.gameState.isGameComplete) {
            this.showStatus('Please select a cell first.', 'error');
            return;
        }
        
        if (this.gameState.hintsUsed >= this.gameState.maxHints) {
            this.showStatus(`You've used all ${this.gameState.maxHints} hints for this game.`, 'error');
            return;
        }
        
        const row = parseInt(this.gameState.selectedCell.dataset.row);
        const col = parseInt(this.gameState.selectedCell.dataset.col);
        
        if (this.gameState.originalBoard[row][col] !== 0) {
            this.showStatus('Cannot get hint for original cells.', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/hint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: this.gameState.gameId,
                    row: row,
                    col: col
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.hint) {
                this.gameState.hintsUsed = data.hints_used;
                this.hintCount.textContent = this.gameState.maxHints - this.gameState.hintsUsed;
                
                // Apply the hint
                await this.makeMove(data.hint);
                
                this.gameState.selectedCell.classList.add('hint');
                setTimeout(() => {
                    if (this.gameState.selectedCell) {
                        this.gameState.selectedCell.classList.remove('hint');
                    }
                }, 1000);
                
                this.showStatus(`Hint applied! (${this.gameState.maxHints - this.gameState.hintsUsed} hints remaining)`, 'success');
            } else {
                this.showStatus('No hint available for this cell.', 'error');
            }
        } catch (error) {
            console.error('Error getting hint:', error);
            this.showError('Failed to get hint. Please try again.');
        }
    }
    
    async checkSolution() {
        if (!this.gameState.gameId) return;
        
        try {
            const response = await fetch('/api/check-solution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: this.gameState.gameId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (data.is_valid) {
                    this.showStatus('Current solution is valid!', 'success');
                    this.clearErrors();
                } else {
                    this.showStatus('Current solution has conflicts.', 'error');
                    this.highlightErrors();
                }
            } else {
                throw new Error(data.error || 'Failed to check solution');
            }
        } catch (error) {
            console.error('Error checking solution:', error);
            this.showError('Failed to check solution. Please try again.');
        }
    }
    
    highlightErrors() {
        this.clearErrors();
        
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (this.gameState.board[i][j] !== 0) {
                    if (!this.isValidMove(i, j, this.gameState.board[i][j])) {
                        const cell = this.boardElement.querySelector(`[data-row="${i}"][data-col="${j}"]`);
                        if (cell) {
                            cell.classList.add('error');
                        }
                    }
                }
            }
        }
    }
    
    clearErrors() {
        document.querySelectorAll('.cell.error').forEach(cell => {
            cell.classList.remove('error');
        });
    }
    
    isValidMove(row, col, num) {
        // Check row
        for (let j = 0; j < 9; j++) {
            if (j !== col && this.gameState.board[row][j] === num) {
                return false;
            }
        }
        
        // Check column
        for (let i = 0; i < 9; i++) {
            if (i !== row && this.gameState.board[i][col] === num) {
                return false;
            }
        }
        
        // Check 3x3 box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        
        for (let i = boxRow; i < boxRow + 3; i++) {
            for (let j = boxCol; j < boxCol + 3; j++) {
                if ((i !== row || j !== col) && this.gameState.board[i][j] === num) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    handleGameComplete() {
        this.gameState.isGameComplete = true;
        this.stopTimer();
        this.showWinModal();
        this.saveGameStats();
    }
    
    updateProgress() {
        const filledCells = this.gameState.board.flat().filter(cell => cell !== 0).length;
        const totalCells = 81;
        const percentage = (filledCells / totalCells) * 100;
        
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `${filledCells}/${totalCells}`;
    }
    
    startTimer() {
        this.gameState.gameStartTime = Date.now();
        this.gameState.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }
    
    stopTimer() {
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            this.gameState.timerInterval = null;
        }
    }
    
    updateTimer() {
        if (!this.gameState.gameStartTime) return;
        
        const elapsed = Math.floor((Date.now() - this.gameState.gameStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        this.timerElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    async saveGameStats() {
        if (!this.gameState.gameId) return;
        
        try {
            const timeTaken = Math.floor((Date.now() - this.gameState.gameStartTime) / 1000);
            
            await fetch('/api/game-stats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: this.gameState.gameId,
                    time_taken: timeTaken,
                    completed: this.gameState.isGameComplete
                })
            });
        } catch (error) {
            console.error('Error saving game stats:', error);
        }
    }
    
    async showStats() {
        try {
            const response = await fetch('/api/user-stats');
            const data = await response.json();
            
            if (data.success) {
                this.populateStats(data.stats);
                this.showModal(this.statsModal);
            } else {
                throw new Error(data.error || 'Failed to load statistics');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showError('Failed to load statistics. Please try again.');
        }
    }
    
    populateStats(stats) {
        this.totalGames.textContent = stats.total_games || 0;
        this.completedGames.textContent = stats.completed_games || 0;
        this.totalTime.textContent = this.formatTime(stats.total_play_time || 0);
        this.totalHints.textContent = stats.hints_used || 0;
        
        // Populate best times
        this.bestTimesList.innerHTML = '';
        if (stats.best_times) {
            Object.entries(stats.best_times).forEach(([difficulty, time]) => {
                const timeItem = document.createElement('div');
                timeItem.className = 'time-item';
                timeItem.innerHTML = `
                    <span>${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
                    <span>${this.formatTime(time)}</span>
                `;
                this.bestTimesList.appendChild(timeItem);
            });
        }
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }
    
    showSettings() {
        this.themeSelect.value = this.settings.theme;
        this.animationToggle.checked = this.settings.animations;
        this.autoCheckToggle.checked = this.settings.autoCheck;
        this.soundToggle.checked = this.settings.sound;
        this.showModal(this.settingsModal);
    }
    
    saveSettings() {
        this.settings.theme = this.themeSelect.value;
        this.settings.animations = this.animationToggle.checked;
        this.settings.autoCheck = this.autoCheckToggle.checked;
        this.settings.sound = this.soundToggle.checked;
        
        this.gameState.autoCheck = this.settings.autoCheck;
        
        this.saveSettingsToStorage();
        this.applyTheme();
        this.hideModal(this.settingsModal);
        this.showStatus('Settings saved!', 'success');
    }
    
    loadSettings() {
        const saved = localStorage.getItem('sudokuProSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
            this.gameState.autoCheck = this.settings.autoCheck;
        }
    }
    
    saveSettingsToStorage() {
        localStorage.setItem('sudokuProSettings', JSON.stringify(this.settings));
    }
    
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }
    
    showWinModal() {
        this.finalTime.textContent = this.timerElement.textContent;
        this.finalHints.textContent = this.gameState.hintsUsed;
        this.finalDifficulty.textContent = this.gameState.difficulty.charAt(0).toUpperCase() + this.gameState.difficulty.slice(1);
        this.showModal(this.winModal);
    }
    
    shareResult() {
        const text = `I solved a ${this.gameState.difficulty} Sudoku puzzle in ${this.timerElement.textContent} with ${this.gameState.hintsUsed} hints! 🧩`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Sudoku Pro',
                text: text,
                url: window.location.href
            });
        } else {
            // Fallback to copying to clipboard
            navigator.clipboard.writeText(text).then(() => {
                this.showStatus('Result copied to clipboard!', 'success');
            });
        }
    }
    
    handleKeyPress(event) {
        if (!this.gameState.selectedCell || this.gameState.isGameComplete) return;
        
        const row = parseInt(this.gameState.selectedCell.dataset.row);
        const col = parseInt(this.gameState.selectedCell.dataset.col);
        
        if (this.gameState.originalBoard[row][col] !== 0) return;
        
        if (event.key >= '1' && event.key <= '9') {
            this.makeMove(parseInt(event.key));
        } else if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') {
            this.makeMove(0);
        } else if (event.key === 'n' || event.key === 'N') {
            this.toggleNoteMode();
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || 
                   event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            this.moveSelection(event.key);
        }
    }
    
    moveSelection(direction) {
        if (!this.gameState.selectedCell) return;
        
        const currentRow = parseInt(this.gameState.selectedCell.dataset.row);
        const currentCol = parseInt(this.gameState.selectedCell.dataset.col);
        let newRow = currentRow;
        let newCol = currentCol;
        
        switch (direction) {
            case 'ArrowUp':
                newRow = Math.max(0, currentRow - 1);
                break;
            case 'ArrowDown':
                newRow = Math.min(8, currentRow + 1);
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, currentCol - 1);
                break;
            case 'ArrowRight':
                newCol = Math.min(8, currentCol + 1);
                break;
        }
        
        this.selectCell(newRow, newCol);
    }
    
    resetGameState() {
        this.gameState.board = [];
        this.gameState.solution = [];
        this.gameState.originalBoard = [];
        this.gameState.notes = [];
        this.gameState.selectedCell = null;
        this.gameState.isGameComplete = false;
        this.gameState.hintsUsed = 0;
        this.gameState.movesHistory = [];
        this.gameState.redoStack = [];
        this.gameState.isNoteMode = false;
        
        this.stopTimer();
        this.timerElement.textContent = '00:00';
        this.hintCount.textContent = this.gameState.maxHints;
        this.updateProgress();
        this.updateUndoRedoButtons();
        this.showStatus('');
    }
    
    showStatus(message, type = '') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = 'status-message';
        if (type) {
            this.statusMessage.classList.add(type);
        }
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.showModal(this.errorModal);
    }
    
    showModal(modal) {
        modal.classList.add('show');
    }
    
    hideModal(modal) {
        modal.classList.remove('show');
    }
    
    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.add('show');
        } else {
            this.loadingOverlay.classList.remove('show');
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SudokuPro();
}); 