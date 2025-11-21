const canvas = document.getElementById("mazeCanvas");
const ctx = canvas.getContext("2d");

// ===== BALL =====
let ballX = 30;
let ballY = 300;
let ballRadius = 8;
let dx = 0;
let dy = 0;
let speed = 1.5;   // ← You can adjust this easily

let gameRunning = false;

// ===== MAZE =====
function drawMaze() {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 8;

    // *** OUTER BORDER (with 2 openings) ***
    ctx.beginPath();
    ctx.moveTo(0, 0);       ctx.lineTo(600, 0);     // top border
    ctx.lineTo(600, 600);   ctx.lineTo(0, 600);     // other sides
    ctx.lineTo(0, 320);     // left side break
    ctx.moveTo(0, 280);     ctx.lineTo(0, 0);
    ctx.stroke();

    // *** FINISH OPENING (right side) ***
    ctx.beginPath();
    ctx.moveTo(600, 280);
    ctx.lineTo(600, 320);
    ctx.stroke();

    // *** INTERNAL MAZE WALLS ***
    let walls = [
        [80, 0, 80, 520],
        [160, 80, 500, 80],
        [500, 80, 500, 500],
        [160, 160, 420, 160],
        [160, 160, 160, 500],
        [240, 240, 500, 240],
        [240, 240, 240, 500],
        [320, 320, 500, 320],
        [320, 320, 320, 500],
        [400, 400, 500, 400],
        [400, 400, 400, 500]
    ];

    walls.forEach(w => {
        ctx.beginPath();
        ctx.moveTo(w[0], w[1]);
        ctx.lineTo(w[2], w[3]);
        ctx.stroke();
    });
}

// ===== BALL =====
function drawBall() {
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();
}

// ===== MOVEMENT =====
function moveBall() {
    if (!gameRunning) return;

    let nextX = ballX + dx * speed;
    let nextY = ballY + dy * speed;

    let imgData = ctx.getImageData(nextX - ballRadius, nextY - ballRadius, ballRadius * 2, ballRadius * 2).data;

    for (let i = 0; i < imgData.length; i += 4) {
        if (imgData[i] === 0 && imgData[i + 1] === 0 && imgData[i + 2] === 0) {
            alert("Game Over!");
            resetGame();
            return;
        }
    }

    ballX = nextX;
    ballY = nextY;

    if (ballX > 595 && ballY > 280 && ballY < 320) {
        alert("YOU WIN!");
        resetGame();
    }
}

function gameLoop() {
    if (gameRunning) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawMaze();
        moveBall();
        drawBall();
    }
    requestAnimationFrame(gameLoop);
}

// ===== CONTROLS =====
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { dx = 0; dy = -1; }
    if (e.key === "ArrowDown") { dx = 0; dy = 1; }
    if (e.key === "ArrowLeft") { dx = -1; dy = 0; }
    if (e.key === "ArrowRight") { dx = 1; dy = 0; }
});

// Onscreen button controls
document.getElementById("upBtn").onclick = () => { dx = 0; dy = -1; };
document.getElementById("downBtn").onclick = () => { dx = 0; dy = 1; };
document.getElementById("leftBtn").onclick = () => { dx = -1; dy = 0; };
document.getElementById("rightBtn").onclick = () => { dx = 1; dy = 0; };

// ===== BUTTONS =====
document.getElementById("startBtn").onclick = () => {
    gameRunning = true;
};

document.getElementById("resetBtn").onclick = resetGame;

function resetGame() {
    gameRunning = false;
    ballX = 30;
    ballY = 300;
    dx = 0;
    dy = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMaze();
    drawBall();
}

drawMaze();
drawBall();
gameLoop();
