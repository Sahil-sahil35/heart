// App State
const STATE_KEY = 'ourForeverAdventure.v1';
let appState = {
    currentIndex: 0,
    answers: {},
    games: {},
    startedAt: new Date().toISOString(),
    completedAt: null,
    ending: null,
    pathScores: { beach: 0, adventure: 0, cozy: 0, creative: 0 },
    settings: {
        darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
};

// Config Data (will be loaded from JSON)
let config = null;
let steps = [];

// DOM Elements
const stepContainer = document.getElementById('step-container');
const progressFill = document.getElementById('progress-fill');
const stepCounter = document.getElementById('step-counter');
const backBtn = document.getElementById('back-btn');
const skipBtn = document.getElementById('skip-btn');
const nextBtn = document.getElementById('next-btn');
const confettiContainer = document.getElementById('confetti-container');
const appTitle = document.getElementById('app-title');

// Initialize the application
async function initApp() {
    const savedState = localStorage.getItem(STATE_KEY);
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            if (!parsedState.completedAt) {
                appState = parsedState; // Load saved state
                showContinueScreen();
                return;
            }
        } catch (e) {
            console.error('Error loading saved state:', e);
            localStorage.removeItem(STATE_KEY); // Clear corrupted state
        }
    }
    
    // Load config from the provided file
        try {
        const response = await fetch('love_config.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        config = await response.json();
        
        appTitle.textContent = config.meta.appTitle;
        steps = buildSteps(config);
        
        renderStep();
        updateProgress();
    } catch (error) {
        console.error('Error loading config:', error);
        stepContainer.innerHTML = `
            <div class="card">
                <h2>Something went wrong</h2>
                <p>We couldn't load your journey. Please check that 'love_config.json' is present and refresh.</p>
            </div>
        `;
    }

}

// Build steps from sequence
function buildSteps(config) {
    return config.sequence.map(item => {
        if (item.type === 'interlude') return config.interludes.find(i => i.id === item.ref);
        if (item.type === 'question') return config.questions.find(q => q.id === item.ref);
        if (item.type === 'game') return config.games.find(g => g.id === item.ref);
        if (item.type === 'ending') return { type: 'ending' }; // Use a placeholder for the final step
    }).filter(Boolean);
}

// Show continue screen if there's a saved state
function showContinueScreen() {
    stepContainer.innerHTML = `
        <div class="card">
            <h2>Welcome Back, My Love</h2>
            <div class="intro-line">Our adventure is waiting for you...</div>
            <p>It looks like you've already started our forever adventure. Would you like to continue where you left off?</p>
            <div class="response-options">
                <button class="btn" id="continue-btn">Continue Our Journey</button>
                <button class="btn btn-secondary" id="restart-btn">Start Over</button>
            </div>
        </div>
    `;
    config = CONFIG_DATA; // Ensure config is loaded before continuing
    steps = buildSteps(config);
    document.getElementById('continue-btn').addEventListener('click', () => {
        renderStep();
        updateProgress();
    });
    document.getElementById('restart-btn').addEventListener('click', restartApp);
    backBtn.style.display = 'none';
    skipBtn.style.display = 'none';
    nextBtn.style.display = 'none';
}

// Render the current step
function renderStep() {
    if (appState.currentIndex >= steps.length - 1) { // Check for one before last step
        renderEnding();
        return;
    }
    
    const step = steps[appState.currentIndex];
    
    backBtn.style.display = 'block';
    skipBtn.style.display = 'block';
    nextBtn.style.display = 'block';
    backBtn.disabled = appState.currentIndex === 0;
    nextBtn.disabled = !isStepComplete(step);
    
    if (step.type === 'interlude') renderInterlude(step);
    else if (['single', 'multi', 'scale', 'short'].includes(step.type)) renderQuestion(step);
    else if (['memory-match', 'catch-the-hearts', 'maze', 'puzzle'].includes(step.type)) renderGame(step);
    
    updateProgress();
    saveState();
}

// Render an interlude step
function renderInterlude(interlude) {
    const image = config.gallery.find(img => img.id === interlude.imageId);
    stepContainer.innerHTML = `
        <div class="step active">
            <div class="intro-line">${interlude.intro}</div>
            <div class="card">
                <img src="${image.url}" alt="${image.alt}" class="interlude-image" loading="lazy">
                <div class="image-caption">${image.caption}</div>
                <p>${interlude.text}</p>
            </div>
            <div class="outro-line">${interlude.outro}</div>
        </div>
    `;
    nextBtn.disabled = false;
}

// Render a question step
function renderQuestion(question) {
    const image = config.gallery.find(img => img.id === question.imageId);
    let questionHTML = '';
    
    if (question.type === 'single') {
        questionHTML = `<div class="options-grid">${question.options.map((option, index) => `<div class="option-card" data-value="${index}" data-path="${question.path ? question.path[index] : ''}">${option}</div>`).join('')}</div>`;
    } else if (question.type === 'multi') {
        questionHTML = `<div class="options-grid">${question.options.map((option, index) => `<div class="option-card" data-value="${index}" data-path="${question.path ? question.path[index] : ''}">${option}</div>`).join('')}</div>`;
    } else if (question.type === 'scale') {
        questionHTML = `<div class="scale-container">${question.labels.map((label, index) => `<div class="scale-option" data-value="${index + 1}">❤️</div>`).join('')}</div>`;
    } else if (question.type === 'short') {
        questionHTML = `<input type="text" class="short-input" placeholder="${question.placeholder}" maxlength="100"><div class="char-counter">0/100</div>`;
    }
    
    stepContainer.innerHTML = `<div class="step active"><div class="intro-line">${question.intro}</div><div class="card">${image ? `<img src="${image.url}" alt="${image.alt}" class="interlude-image" loading="lazy">` : ''}<div class="question-prompt">${question.prompt}</div>${questionHTML}</div><div class="outro-line">${question.outro}</div></div>`;
    
    if (question.type === 'single') {
        stepContainer.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', () => {
                appState.answers[question.id] = { type: 'single', value: card.dataset.value, text: card.textContent.trim(), path: card.dataset.path };
                if (card.dataset.path) appState.pathScores[card.dataset.path]++;
                nextBtn.disabled = false;
                saveState();
                // Re-render to show selection
                renderStep();
            });
        });
        if (appState.answers[question.id]) {
            const selectedCard = stepContainer.querySelector(`.option-card[data-value="${appState.answers[question.id].value}"]`);
            if (selectedCard) selectedCard.classList.add('selected');
        }
    } else if (question.type === 'multi') {
        stepContainer.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', () => {
                card.classList.toggle('selected');
                const selectedCards = Array.from(stepContainer.querySelectorAll('.option-card.selected'));
                const selectedValues = selectedCards.map(c => ({ value: c.dataset.value, text: c.textContent.trim(), path: c.dataset.path }));
                appState.answers[question.id] = { type: 'multi', value: selectedValues };
                
                // Update path scores
                Object.keys(appState.pathScores).forEach(path => appState.pathScores[path] = 0);
                config.questions.filter(q => q.path).forEach(q => {
                    const answer = appState.answers[q.id];
                    if (answer?.type === 'single' && answer.path) appState.pathScores[answer.path]++;
                    if (answer?.type === 'multi') answer.value.forEach(v => { if(v.path) appState.pathScores[v.path]++; });
                });
                
                nextBtn.disabled = selectedValues.length === 0;
                saveState();
            });
        });
        if (appState.answers[question.id]) {
            appState.answers[question.id].value.forEach(answer => {
                const selectedCard = stepContainer.querySelector(`.option-card[data-value="${answer.value}"]`);
                if (selectedCard) selectedCard.classList.add('selected');
            });
        }
    } else if (question.type === 'scale') {
        const scaleContainer = stepContainer.querySelector('.scale-container');
        const scaleOptions = stepContainer.querySelectorAll('.scale-option');
        function updateHearts(selectedValue) { scaleOptions.forEach(opt => opt.classList.toggle('selected', parseInt(opt.dataset.value) <= selectedValue)); }
        scaleContainer.addEventListener('click', (e) => { if (e.target.classList.contains('scale-option')) { const value = e.target.dataset.value; appState.answers[question.id] = { type: 'scale', value: value }; updateHearts(value); nextBtn.disabled = false; saveState(); } });
        scaleContainer.addEventListener('mouseover', (e) => { if (e.target.classList.contains('scale-option')) updateHearts(e.target.dataset.value); });
        scaleContainer.addEventListener('mouseout', () => updateHearts(appState.answers[question.id]?.value || 0));
        if (appState.answers[question.id]) updateHearts(appState.answers[question.id].value);
    } else if (question.type === 'short') {
        const input = stepContainer.querySelector('.short-input');
        const counter = stepContainer.querySelector('.char-counter');
        input.addEventListener('input', () => { const text = input.value; counter.textContent = `${text.length}/100`; appState.answers[question.id] = { type: 'short', value: text.trim() }; nextBtn.disabled = text.trim().length === 0; saveState(); });
        if (appState.answers[question.id]) { input.value = appState.answers[question.id].value; counter.textContent = `${input.value.length}/100`; }
    }
}

// Render a game step
function renderGame(game) {
    stepContainer.innerHTML = `<div class="step active"><div class="intro-line">${game.intro}</div><div class="card"><h3>${game.title}</h3><div class="game-container" id="game-container"></div></div><div class="outro-line">${game.outro}</div></div>`;
    const gameContainer = document.getElementById('game-container');
    if (game.type === 'memory-match') renderMemoryGame(game, gameContainer);
    else if (game.type === 'catch-the-hearts') renderCatchHeartsGame(game, gameContainer);
    else if (game.type === 'maze') renderMazeGame(game, gameContainer);
    else if (game.type === 'puzzle') renderPuzzleGame(game, gameContainer);
    nextBtn.disabled = true;
}

// Render memory match game
function renderMemoryGame(game, container) {
    const shuffledEmojis = game.settings.shuffle ? game.settings.pairs.flat().sort(() => Math.random() - 0.5) : game.settings.pairs.flat();
    container.innerHTML = `<div class="memory-grid">${shuffledEmojis.map(emoji => `<div class="memory-card"><div class="front">?</div><div class="back">${emoji}</div></div>`).join('')}</div>`;
    const cards = container.querySelectorAll('.memory-card');
    let firstCard, secondCard, lockBoard = false, matchedPairs = 0;

    function flipCard() {
        if (lockBoard || this === firstCard) return;
        this.classList.add('flipped');
        if (!firstCard) { firstCard = this; return; }
        secondCard = this;
        lockBoard = true;
        firstCard.querySelector('.back').textContent === secondCard.querySelector('.back').textContent ? disableCards() : unflipCards();
    }

    function disableCards() {
        firstCard.removeEventListener('click', flipCard);
        secondCard.removeEventListener('click', flipCard);
        if (++matchedPairs === game.settings.pairs.length) {
            appState.games[game.id] = { won: true };
            nextBtn.disabled = false;
            saveState();
            if (config.meta.ui.enableConfetti) createConfetti();
        }
        resetBoard();
    }

    function unflipCards() {
        setTimeout(() => {
            firstCard.classList.remove('flipped');
            secondCard.classList.remove('flipped');
            resetBoard();
        }, 1000);
    }

    function resetBoard() { [firstCard, secondCard, lockBoard] = [null, null, false]; }
    cards.forEach(card => card.addEventListener('click', flipCard));
}

// Render catch hearts game
function renderCatchHeartsGame(game, container) {
    container.innerHTML = `<div class="game-stats"><span>Score: <span id="score">0</span>/${game.settings.targetScore}</span><span>Time: <span id="timer">${game.settings.durationSeconds}</span>s</span></div><div class="catch-area" id="catch-area"></div>`;
    const catchArea = document.getElementById('catch-area'), scoreElement = document.getElementById('score'), timerElement = document.getElementById('timer');
    let score = 0, timeLeft = game.settings.durationSeconds, gameInterval, spawnInterval;
    function endGame() { clearInterval(gameInterval); clearInterval(spawnInterval); document.querySelectorAll('.catch-area .heart').forEach(h => h.remove()); appState.games[game.id] = { score: score, won: score >= game.settings.targetScore }; nextBtn.disabled = false; saveState(); if (config.meta.ui.enableConfetti && score >= game.settings.targetScore) createConfetti(); }
    gameInterval = setInterval(() => { timerElement.textContent = --timeLeft; if (timeLeft <= 0) endGame(); }, 1000);
    spawnInterval = setInterval(() => { if (timeLeft > 0) spawnHeart(); }, game.settings.spawnIntervalMs);
    function spawnHeart() { const heart = document.createElement('div'); heart.className = 'heart'; heart.innerHTML = '❤️'; heart.style.left = `${Math.random() * (catchArea.offsetWidth - 40)}px`; heart.style.bottom = '0px'; heart.style.fontSize = `${24 + Math.random() * 12}px`; heart.style.animationDuration = `${2.5 + Math.random() * 2}s`; catchArea.appendChild(heart); setTimeout(() => heart.remove(), game.settings.heartLifetimeMs); heart.addEventListener('click', () => { score++; scoreElement.textContent = score; heart.remove(); if (score >= game.settings.targetScore) { timeLeft = 0; timerElement.textContent = '0'; endGame(); } }); }
}

// Render maze game
function renderMazeGame(game, container) {
    container.innerHTML = `<div class="maze-container"><div class="game-stats"><span>Steps: <span id="steps">0</span></span></div><div class="maze-grid" id="maze-grid"></div><div class="controls"><button class="control-btn control-up">↑</button><button class="control-btn control-left">←</button><button class="control-btn control-right">→</button><button class="control-btn control-down">↓</button></div></div>`;
    const mazeGrid = document.getElementById('maze-grid'), stepsElement = document.getElementById('steps'), size = game.settings.gridSize;
    let stepCount = 0, playerPos = { x: 0, y: 0 };
    const grid = Array(size).fill(null).map(() => Array(size).fill(null).map(() => ({ visited: false, walls: { top: true, right: true, bottom: true, left: true } })));
    function carvePassages(cx, cy) { grid[cy][cx].visited = true; const directions = ['N', 'E', 'S', 'W'].sort(() => Math.random() - 0.5); for (const direction of directions) { const nx = cx + { E: 1, W: -1, N: 0, S: 0 }[direction], ny = cy + { E: 0, W: 0, N: -1, S: 1 }[direction]; if (ny >= 0 && ny < size && nx >= 0 && nx < size && !grid[ny][nx].visited) { if (direction === 'N') { grid[cy][cx].walls.top = false; grid[ny][nx].walls.bottom = false; } if (direction === 'S') { grid[cy][cx].walls.bottom = false; grid[ny][nx].walls.top = false; } if (direction === 'E') { grid[cy][cx].walls.right = false; grid[ny][nx].walls.left = false; } if (direction === 'W') { grid[cy][cx].walls.left = false; grid[ny][nx].walls.right = false; } carvePassages(nx, ny); } } }
    carvePassages(0, 0);
    mazeGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const cell = document.createElement('div'); cell.className = 'maze-cell'; cell.dataset.x = x; cell.dataset.y = y; if (!grid[y][x].walls.top) cell.classList.add('no-wall-top'); if (!grid[y][x].walls.right) cell.classList.add('no-wall-right'); if (!grid[y][x].walls.bottom) cell.classList.add('no-wall-bottom'); if (!grid[y][x].walls.left) cell.classList.add('no-wall-left'); if (x === 0 && y === 0) cell.classList.add('start'); if (x === size - 1 && y === size - 1) cell.classList.add('end'); mazeGrid.appendChild(cell); }
    mazeGrid.querySelector('[data-x="0"][data-y="0"]').classList.add('current');
    function movePlayer(dx, dy) { const { x, y } = playerPos; const newX = x + dx, newY = y + dy; if (newX < 0 || newX >= size || newY < 0 || newY >= size) return; let canMove = (dx === 1 && !grid[y][x].walls.right) || (dx === -1 && !grid[y][x].walls.left) || (dy === 1 && !grid[y][x].walls.bottom) || (dy === -1 && !grid[y][x].walls.top); if (!canMove) return; mazeGrid.querySelector('.maze-cell.current').classList.remove('current'); playerPos = { x: newX, y: newY }; mazeGrid.querySelector(`[data-x="${newX}"][data-y="${newY}"]`).classList.add('current'); stepsElement.textContent = ++stepCount; if (playerPos.x === size - 1 && playerPos.y === size - 1) { appState.games[game.id] = { steps: stepCount, won: true }; nextBtn.disabled = false; saveState(); if (config.meta.ui.enableConfetti) createConfetti(); document.removeEventListener('keydown', keydownHandler); container.querySelectorAll('.control-btn').forEach(btn => btn.disabled = true); } }
    container.querySelector('.control-up').onclick = () => movePlayer(0, -1); container.querySelector('.control-down').onclick = () => movePlayer(0, 1); container.querySelector('.control-left').onclick = () => movePlayer(-1, 0); container.querySelector('.control-right').onclick = () => movePlayer(1, 0);
    const keydownHandler = (e) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); if (e.key === 'ArrowUp') movePlayer(0, -1); if (e.key === 'ArrowDown') movePlayer(0, 1); if (e.key === 'ArrowLeft') movePlayer(-1, 0); if (e.key === 'ArrowRight') movePlayer(1, 0); } };
    document.addEventListener('keydown', keydownHandler);
}

// Render puzzle game
function renderPuzzleGame(game, container) {
    const image = config.gallery.find(img => img.id === game.settings.imageId);
    container.innerHTML = `<div class="puzzle-container"><div class="puzzle-board" id="puzzle-board"></div><div class="game-stats" style="justify-content:center;"><span>Moves: <span id="puzzle-moves">0</span></span></div></div>`;
    const puzzleBoard = document.getElementById('puzzle-board');
    const movesElement = document.getElementById('puzzle-moves');
    let moves = 0;
    const size = 3;
    const totalPieces = size * size;
    let pieces = Array.from({length: totalPieces}, (_, i) => i);
    
    // Simple shuffle for now
    pieces.sort(() => Math.random() - 0.5);
    
    let emptyIndex = pieces.indexOf(totalPieces - 1);

    function updatePuzzle() {
        puzzleBoard.innerHTML = '';
        pieces.forEach((pieceId, i) => {
            const piece = document.createElement('div');
            piece.className = 'puzzle-piece';
            piece.dataset.index = i;
            if (pieceId === totalPieces - 1) {
                piece.classList.add('empty');
            } else {
                const row = Math.floor(pieceId / size);
                const col = pieceId % size;
                piece.style.backgroundImage = `url('${image.url}')`;
                piece.style.backgroundSize = `${size * 100}%`;
                piece.style.backgroundPosition = `${col * 100 / (size - 1)}% ${row * 100 / (size - 1)}%`;
                piece.addEventListener('click', onPieceClick);
            }
            puzzleBoard.appendChild(piece);
        });
    }
    
    function onPieceClick(e) {
        const clickedIndex = parseInt(e.target.dataset.index);
        const emptyRow = Math.floor(emptyIndex / size);
        const emptyCol = emptyIndex % size;
        const clickedRow = Math.floor(clickedIndex / size);
        const clickedCol = clickedIndex % size;

        const isAdjacent = (Math.abs(emptyRow - clickedRow) + Math.abs(emptyCol - clickedCol)) === 1;

        if (isAdjacent) {
            [pieces[clickedIndex], pieces[emptyIndex]] = [pieces[emptyIndex], pieces[clickedIndex]];
            emptyIndex = clickedIndex;
            moves++;
            movesElement.textContent = moves;
            updatePuzzle();

            // Check for win
            if (pieces.every((p, i) => p === i)) {
                appState.games[game.id] = { moves: moves, won: true };
                nextBtn.disabled = false;
                saveState();
                if (config.meta.ui.enableConfetti) createConfetti();
                // Make final piece visible
                puzzleBoard.querySelector('.empty').style.backgroundImage = `url('${image.url}')`;
            }
        }
    }
    updatePuzzle();
}

// Render the final ending step
function renderEnding() {
    const endingId = determineEnding();
    const selectedEnding = config.endings.find(e => e.id === endingId);
    appState.ending = endingId;

    stepContainer.innerHTML = `
        <div class="step active">
            <div class="card endings-container">
                <h2 class="ending-title">${selectedEnding.title}</h2>
                <img src="${selectedEnding.image}" alt="${selectedEnding.alt}" class="ending-image">
                <div class="love-letter">${selectedEnding.description}</div>
            </div>
            <div class="response-options">
                <button class="btn" id="yes-btn">Yes, a thousand times yes! 💍</button>
                <button class="btn" id="always-btn">Always and forever! ❤️</button>
            </div>
        </div>
    `;
    backBtn.style.display = 'none';
    skipBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    document.getElementById('yes-btn').addEventListener('click', handleFinalResponse);
    document.getElementById('always-btn').addEventListener('click', handleFinalResponse);
    if (config.meta.ui.enableConfetti) createConfetti();
}

// Determine the final ending based on choices
function determineEnding() {
    const scores = appState.pathScores;
    let maxPath = 'cozy'; // Default
    let maxScore = 0;
    for (const path in scores) {
        if (scores[path] > maxScore) {
            maxScore = scores[path];
            maxPath = path;
        }
    }
    return `ending-${maxPath}`;
}

// Handle final response
function handleFinalResponse() {
    appState.completedAt = new Date().toISOString();
    saveState();
    // saveDataToServer(appState); // Placeholder for saving data
    showConfirmation();
}

// Show confirmation screen
function showConfirmation() {
    stepContainer.innerHTML = `
        <div class="step active">
            <div class="card">
                <h2 style="color: var(--primary);">You Made Me the Happiest Person! 🥹❤️</h2>
                <p>Your "Yes" means more to me than all the stars in the sky.</p>
                <p>Our forever adventure has just begun, and I can't wait to create countless memories with you.</p>
                <div class="love-letter" style="border: none; padding-top: 10px;">
                    <p>Every moment with you feels like a beautiful dream I never want to wake up from. 
                    From our first meeting to this incredible moment, my heart has known only you.</p>
                    <p>I promise to love you fiercely, support you unconditionally, and make you laugh every single day.</p>
                    <p>Here's to our forever - may it be filled with joy, adventure, and endless love.</p>
                </div>
                <div class="response-options" style="margin-top: 30px;">
                    <button class="btn btn-secondary" id="restart-journey-btn">Relive Our Journey</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('restart-journey-btn').addEventListener('click', restartApp);
}

// Function to handle restarting the app
function restartApp() {
    if (appState.completedAt) {
        // saveDataToServer(appState); // Save previous run before restarting
    }
    localStorage.removeItem(STATE_KEY);
    appState = {
        currentIndex: 0,
        answers: {},
        games: {},
        startedAt: new Date().toISOString(),
        completedAt: null,
        ending: null,
        pathScores: { beach: 0, adventure: 0, cozy: 0, creative: 0 },
        settings: appState.settings
    };
    renderStep();
}

// Check if the current step is complete
function isStepComplete(step) {
    if (!step) return false;
    if (step.type === 'interlude' || step.type === 'ending') return true;
    if (['single', 'scale'].includes(step.type)) return appState.answers[step.id] !== undefined;
    if (step.type === 'multi') return appState.answers[step.id]?.value?.length > 0;
    if (step.type === 'short') return appState.answers[step.id]?.value?.length > 0;
    if (['memory-match', 'catch-the-hearts', 'maze', 'puzzle'].includes(step.type)) return appState.games[step.id]?.won === true;
    return false;
}

// Update progress bar
function updateProgress() {
    const progress = (appState.currentIndex / (steps.length - 1)) * 100;
    progressFill.style.width = `${progress}%`;
    stepCounter.textContent = `Step ${appState.currentIndex + 1} of ${steps.length}`;
}

// Create confetti animation
function createConfetti() {
    if (appState.settings.reducedMotion) return;
    confettiContainer.innerHTML = '';
    const colors = [getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(), getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim(), getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()];
    for (let i = 0; i < 70; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = `${8 + Math.random() * 6}px`;
        confetti.style.height = `${12 + Math.random() * 8}px`;
        confetti.style.animation = `confettiFall ${2.5 + Math.random() * 2}s linear forwards`;
        confetti.style.animationDelay = `${Math.random() * 2}s`;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confettiContainer.appendChild(confetti);
        setTimeout(() => confetti.remove(), 5000);
    }
}

// Save state to localStorage
function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(appState));
}

// Placeholder for saving data
function saveDataToServer(dataToSave) {
    console.log('Saving response:', dataToSave);
}

// Event listeners for navigation
backBtn.addEventListener('click', () => { if (appState.currentIndex > 0) { appState.currentIndex--; renderStep(); } });
skipBtn.addEventListener('click', () => { appState.currentIndex++; renderStep(); });
nextBtn.addEventListener('click', () => { appState.currentIndex++; renderStep(); });

// Initialize the app
initApp();