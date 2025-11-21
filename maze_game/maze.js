// ----------------- BASIC CANVAS SETUP -----------------
const canvas = document.getElementById("mazeCanvas");
const ctx = canvas.getContext("2d");

const size = 600;
const cell = 40;  // MAZE CELL SIZE
const rows = size / cell;
const cols = size / cell;

// Player ball properties
let ball = {
    x: 0,
    y: 0,
    r: 10,
    dx: 0,
    dy: 0,
    speed: 1
};

let gameRunning = false;

// ----------------- MAZE CREATION -----------------

// Create grid filled with walls
let verticalWalls = [];
let horizontalWalls = [];

for (let r = 0; r <= rows; r++) {
    horizontalWalls[r] = [];
    for (let c = 0; c < cols; c++) {
        horizontalWalls[r][c] = true;
    }
}

for (let r = 0; r < rows; r++) {
    verticalWalls[r] = [];
    for (let c = 0; c <= cols; c++) {
        verticalWalls[r][c] = true;
    }
}

// Depth-First Search Maze Generator
function generateMaze(r, c, visited) {
    visited[r][c] = true;

    let neighbors = [
        [r - 1, c, "up"],
        [r + 1, c, "down"],
        [r, c - 1, "left"],
        [r, c + 1, "right"]
    ];

    // Randomize directions
    neighbors.sort(() => Math.random() - 0.5);

    for (let [nr, nc, dir] of neighbors) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (visited[nr][nc]) continue;

        // Remove walls between cells
        if (dir === "up") horizontalWalls[r][c] = false;
        if (dir === "down") horizontalWalls[r + 1][c] = false;
        if (dir === "left") verticalWalls[r][c] = false;
        if (dir === "right") verticalWalls[r][c + 1] = false;

        generateMaze(nr, nc, visited);
    }
}

// Build maze
let visited = [];
for (let r = 0; r < rows; r++) {
    visited[r] = [];
    for (let c = 0; c < cols; c++) visited[r][c] = false;
}

generateMaze(0, 0, visited);

// Create Start + Finish openings
horizontalWalls[0][0] = false;                // TOP LEFT ENTRANCE
horizontalWalls[rows][cols - 1] = false;      // BOTTOM RIGHT EXIT

// ----------------- DRAW MAZE -----------------
function drawMaze() {
    ctx.clearRect(0, 0, size, size);

    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";

    // Horizontal walls
    for (let r = 0; r <= rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (horizontalWalls[r][c]) {
                ctx.beginPath();
                ctx.moveTo(c * cell, r * cell);
                ctx.lineTo((c + 1) * cell, r * cell);
                ctx.stroke();
            }
        }
    }

    // Vertical walls
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols; c++) {
            if (verticalWalls[r][c]) {
                ctx.beginPath();
                ctx.moveTo(c * cell, r * cell);
                ctx.lineTo(c * cell, (r + 1) * cell);
                ctx.stroke();
            }
        }
    }

    // Draw player ball
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
}

// ----------------- BALL START POSITION -----------------
function resetBall() {
    ball.x = cell / 2;
    ball.y = -10;   // just outside entrance
    ball.dx = 0;
    ball.dy = 0;
}

// ----------------- COLLISION DETECTION -----------------
function checkCollision() {
    // Only check walls (not open spaces)
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {

            // Check vertical walls
            if (verticalWalls[r][c]) {
                let wallX = c * cell;
                let wallY1 = r * cell;
                let wallY2 = (r + 1) * cell;

                if (Math.abs(ball.x - wallX) < ball.r &&
                    ball.y > wallY1 &&
                    ball.y < wallY2)
                    return true;
            }

            // Check horizontal walls
            if (horizontalWalls[r][c]) {
                let wallY = r * cell;
                let wallX1 = c * cell;
                let wallX2 = (c + 1) * cell;

                if (Math.abs(ball.y - wallY) < ball.r &&
                    ball.x > wallX1 &&
                    ball.x < wallX2)
                    return true;
            }
        }
    }

    return false;
}

// ----------------- GAME LOOP -----------------
function gameLoop() {
    if (gameRunning) {
        ball.x += ball.dx;
        ball.y += ball.dy;

        if (checkCollision()) {
            alert("GAME OVER! You hit a wall.");
            gameRunning = false;
        }

        drawMaze();
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();

// ----------------- CONTROLS -----------------
document.addEventListener("keydown", (e) => {
    if (!gameRunning) return;

    if (e.key === "ArrowUp") { ball.dx = 0; ball.dy = -ball.speed; }
    if (e.key === "ArrowDown") { ball.dx = 0; ball.dy = ball.speed; }
    if (e.key === "ArrowLeft") { ball.dx = -ball.speed; ball.dy = 0; }
    if (e.key === "ArrowRight") { ball.dx = ball.speed; ball.dy = 0; }
});

// START GAME BUTTON
document.getElementById("startBtn").onclick = () => {
    resetBall();
    gameRunning = true;
};

// RESET BUTTON
document.getElementById("resetBtn").onclick = () => {
    resetBall();
    gameRunning = false;
    drawMaze();
};

// Draw initial maze + ball
resetBall();
drawMaze();
