const gameContainer = document.getElementById("game-container");

const config = {
  type: Phaser.AUTO,
  width: Math.min(gameContainer.clientWidth, 800),
  height: Math.min(gameContainer.clientHeight, 600),
  backgroundColor: "#87ceeb",
  parent: "game-container",
  physics: {
    default: "matter",
    matter: {
      debug: false,
      gravity: { y: 1 },
    },
  },
  scene: {
    preload,
    create,
    update,
  },
};

const game = new Phaser.Game(config);

// Adjust game size on resize
window.addEventListener("resize", () => {
  game.scale.resize(
    Math.min(gameContainer.clientWidth, 800),
    Math.min(gameContainer.clientHeight, 600)
  );
});

let nextShapeType;
let timerText;
let countdown = 30; // Countdown timer (in seconds)
let timerEvent;
let shapes = []; // To track active shapes
let shapesInBoxText; // To display the number of shapes in the box
let timerStarted = false; // To check if the timer has started
let additionalTimeElapsed = false; // Flag to indicate extra time is over
let extraTime = 15; // Additional seconds after main timer

// ----- SCORE + LEADERBOARD -----
let finalScore = 0;
let highScore = 0;
let leaderboard = [];

const HIGH_SCORE_KEY = "ShapeStackerHighScore";

/**
 * Supabase config:
 * Values from Project Settings -> API
 */
const SUPABASE_URL = "https://ivwjksiaoypeuanvlzar.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2d2prc2lhb3lwZXVhbnZsemFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNDgzNjEsImV4cCI6MjA3ODgyNDM2MX0.kRh2i4O2cBF5-o2RGXStK1IFmN_RPTJFrpDdRdQR-nQ";
const SCORES_TABLE = "scores";

// Initialize score system (local + cloud)
function initScoreSystem() {
  loadHighScore();
  updateScoreUI();
  fetchLeaderboard();
  setupInitialsModal();
}

function loadHighScore() {
  const saved = localStorage.getItem(HIGH_SCORE_KEY);
  highScore = saved ? parseInt(saved, 10) || 0 : 0;
}

function saveHighScore() {
  localStorage.setItem(HIGH_SCORE_KEY, highScore.toString());
}

function updateScoreUI() {
  const currentEl = document.getElementById("current-score");
  const highEl = document.getElementById("high-score");

  if (currentEl) currentEl.textContent = `Score: ${finalScore}`;
  if (highEl) highEl.textContent = `High Score: ${highScore}`;
}

function showNewRecordBadge() {
  const badge = document.getElementById("new-record-badge");
  const highEl = document.getElementById("high-score");
  if (badge) {
    badge.classList.remove("hidden");
    badge.classList.add("visible");
    setTimeout(() => {
      badge.classList.remove("visible");
    }, 2000);
  }
  if (highEl) {
    highEl.classList.add("flash");
    setTimeout(() => highEl.classList.remove("flash"), 1500);
  }
}

function checkHighScore() {
  if (finalScore > highScore) {
    highScore = finalScore;
    saveHighScore();
    updateScoreUI();
    showNewRecordBadge();
    showInitialsModal();
  } else {
    updateScoreUI();
  }
}

function preload() {
  // Load images for shapes
  this.load.image("rectangle", "assets/images/rectangle.png");
  this.load.image("square", "assets/images/square.png");
  this.load.image("sticky", "assets/images/sticky.png");
  this.load.image("triangle", "assets/images/triangle.png");
  this.load.image("circle", "assets/images/circle.png");
  this.load.image("star", "assets/images/star.png");
}

function create() {
  console.log("Phaser game has started!");

  // Initialize score / leaderboard UI
  initScoreSystem();

  const gameWidth = config.width * 0.84;
  const gameHeight = config.height * 0.84;
  const centerX = (config.width - gameWidth) / 2;
  const centerY = (config.height - gameHeight) / 2;

  // Create graphics object
  const graphics = this.add.graphics();

  // Fill the game area with #f0f0f0
  graphics.fillStyle(0xf0f0f0, 1);
  graphics.fillRect(centerX, centerY, gameWidth, gameHeight);

  // Top line (red dashed)
  const dashLength = 10;
  const gapLength = 5;
  graphics.lineStyle(4, 0xff0000);
  graphics.beginPath();
  for (let x = centerX; x < centerX + gameWidth; x += dashLength + gapLength) {
    graphics.moveTo(x, centerY - config.height * 0.08);
    graphics.lineTo(
      Math.min(x + dashLength, centerX + gameWidth),
      centerY - config.height * 0.08
    );
  }
  graphics.strokePath();

  // Draw the side borders and bottom line (keep them white)
  graphics.lineStyle(4, 0xffffff);

  // Top line
  graphics.beginPath();
  graphics.moveTo(centerX, centerY);
  graphics.lineTo(centerX + gameWidth, centerY);
  graphics.strokePath();

  // Bottom line
  graphics.beginPath();
  graphics.moveTo(centerX, centerY + gameHeight);
  graphics.lineTo(centerX + gameWidth, centerY + gameHeight);
  graphics.strokePath();

  // Left border
  graphics.beginPath();
  graphics.moveTo(centerX, centerY);
  graphics.lineTo(centerX, centerY + gameHeight);
  graphics.strokePath();

  // Right border
  graphics.beginPath();
  graphics.moveTo(centerX + gameWidth, centerY);
  graphics.lineTo(centerX + gameWidth, centerY + gameHeight);
  graphics.strokePath();

  // Add ground
  const ground = this.matter.add.rectangle(
    config.width / 2,
    centerY + gameHeight + 20,
    gameWidth,
    40,
    { isStatic: true }
  );

  // Instruction text
  const instructions = this.add.text(
    config.width / 2,
    centerY + 20,
    "Tap above the box to drop shapes!",
    {
      font: "18px Arial",
      fill: "#000",
    }
  );
  instructions.setOrigin(0.5);

  // Show the next shape above the gameplay box
  nextShapeType = Phaser.Math.RND.pick([
    "rectangle",
    "square",
    "sticky",
    "triangle",
    "circle",
    "star",
  ]);
  const nextShapeText = this.add.text(
    centerX + gameWidth - 100,
    centerY - config.height * 0.05,
    "Next:",
    {
      font: "16px Arial",
      fill: "#fff",
    }
  );
  const nextShape = this.add
    .image(centerX + gameWidth - 20, centerY - config.height * 0.04, nextShapeType)
    .setScale(0.5);

  // Add countdown timer
  timerText = this.add.text(
    centerX + 50,
    centerY + gameHeight + 20,
    `Time Left: ${countdown}`,
    {
      font: "18px Arial",
      fill: "#fff",
    }
  );
  timerText.setOrigin(0.5);

  // Shapes in box text
  shapesInBoxText = this.add.text(
    centerX + gameWidth - 60,
    centerY + gameHeight + 20,
    `Shapes in Box: 0`,
    {
      font: "18px Arial",
      fill: "#fff",
    }
  );
  shapesInBoxText.setOrigin(0.5);

  // Pointer down event to drop shapes
  this.input.on("pointerdown", (pointer) => {
    if (!timerStarted) {
      startTimer.call(this); // Start timer on first click
      timerStarted = true;
    }

    if (countdown > 0 && pointer.y < centerY) {
      const x = Phaser.Math.Clamp(pointer.x, centerX, centerX + gameWidth);
      const shape = this.matter.add.image(x, centerY, nextShapeType);
      shape.setBounce(0.5).setFriction(0.5);
      shapes.push(shape); // Track the shape

      // Update next shape
      nextShapeType = Phaser.Math.RND.pick([
        "rectangle",
        "square",
        "sticky",
        "triangle",
        "circle",
        "star",
      ]);
      nextShape.setTexture(nextShapeType);
    }
  });
}

function startTimer() {
  timerEvent = this.time.addEvent({
    delay: 1000, // 1 second
    callback: () => {
      countdown--;
      timerText.setText(`Time Left: ${countdown}`);
      if (countdown <= 0) {
        timerEvent.remove(); // Stop the timer
        timerText.setText("Time's Up!");

        // Add extra time after countdown
        startExtraTime.call(this);
      }
    },
    callbackScope: this,
    loop: true,
  });
}

function startExtraTime() {
  // Create a text message at the top center for the extra time countdown
  const extraTimeText = this.add.text(
    config.width / 2, // Center horizontally
    20, // Small margin from the top
    `Locked in: ${extraTime}`,
    {
      font: "24px Arial",
      fill: "#ff0000",
      align: "center",
    }
  );
  extraTimeText.setOrigin(0.5);

  // Additional 15 seconds after the main timer ends
  this.time.addEvent({
    delay: 1000, // 1 second
    callback: () => {
      extraTime--;
      extraTimeText.setText(`Locked in: ${extraTime}`);

      if (extraTime <= 0) {
        additionalTimeElapsed = true;

        finalScore = shapes.filter((shape) => shape.y < config.height).length;
        shapesInBoxText.setText(`Final Count: ${finalScore}`);

        updateScoreUI();
        checkHighScore();

        // Lock gravity and movement of shapes
        shapes.forEach((shape) => {
          shape.setStatic(true);
        });

        // Hide the extra time text
        extraTimeText.setVisible(false);
      }
    },
    callbackScope: this,
    loop: true,
  });
}

function update() {
  // Remove shapes that have fallen off the game area
  if (!additionalTimeElapsed) {
    shapes = shapes.filter((shape) => shape.y < config.height);
    const shapesInBox = shapes.filter((shape) => shape.y < config.height).length;
    shapesInBoxText.setText(`Shapes in Box: ${shapesInBox}`);
  }
}

// ----- INITIALS MODAL + CLOUD SYNC + LEADERBOARD -----

function setupInitialsModal() {
  const submitBtn = document.getElementById("initials-submit");
  if (submitBtn) {
    submitBtn.addEventListener("click", handleInitialsSubmit);
  }
}

function showInitialsModal() {
  const modal = document.getElementById("initials-modal");
  const input = document.getElementById("initials-input");
  if (!modal || !input) return;
  modal.classList.remove("hidden");
  input.value = "";
  input.focus();
}

function hideInitialsModal() {
  const modal = document.getElementById("initials-modal");
  if (!modal) return;
  modal.classList.add("hidden");
}

function handleInitialsSubmit() {
  const input = document.getElementById("initials-input");
  if (!input) return;

  const initials = (input.value || "").toUpperCase().trim().slice(0, 3);
  if (!initials) {
    alert("Please enter your initials.");
    return;
  }

  hideInitialsModal();
  submitScoreToCloud(initials, finalScore);
}

async function fetchLeaderboard() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase config not set");
    return;
  }

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/${SCORES_TABLE}` +
      `?select=initials,score&order=score.desc&limit=10`;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) throw new Error("Network error fetching leaderboard");
    const data = await res.json();
    leaderboard = Array.isArray(data) ? data : [];
    renderLeaderboard();
  } catch (err) {
    console.warn("Unable to fetch leaderboard:", err);
  }
}

async function submitScoreToCloud(initials, score) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase config not set");
    return;
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/${SCORES_TABLE}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ initials, score }),
    });

    if (!res.ok) throw new Error("Failed to submit score");

    // Refresh leaderboard after successful submit
    await fetchLeaderboard();
  } catch (err) {
    console.warn("Unable to submit score:", err);
  }
}

function renderLeaderboard() {
  const list = document.getElementById("leaderboard-list");
  if (!list) return;

  list.innerHTML = "";

  leaderboard
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10)
    .forEach((entry, index) => {
      const li = document.createElement("li");
      const initials = (entry.initials || "???").toUpperCase();
      const score = entry.score || 0;
      li.textContent = `${index + 1}. ${initials} — ${score}`;
      list.appendChild(li);
    });
}

// Reset button functionality
document.getElementById("reset-button").addEventListener("click", () => {
  location.reload(); // Reload the entire page
});
