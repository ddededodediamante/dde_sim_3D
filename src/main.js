import "./styles.css";
import * as THREE from "three";

const WORLD_MIN_X = -8;
const WORLD_MAX_X = 8;
const GRAVITY = 0.17;
const CAT_CHANCE = 0.1;
const CAT_BOOST_DURATION = 8000;
const CAT_BOOST_AMOUNT = 0.2;

const sounds = {
  ddededodediamante: new Audio("/ddededodediamante.wav"),
  scream: new Audio("/scream.wav"),
  cat: new Audio("/cat.wav"),
  music: new Audio("/newfriendly.mp3"),
};

let settings = {
  cameraSmoothness: 0.1,
  musicEnabled: true,
  sfxEnabled: true,
};

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem("settings"));
  if (!saved) return;

  settings = Object.assign({}, settings, saved);
}
loadSettings();

function saveSettings() {
  localStorage.setItem("settings", JSON.stringify(settings));
}

let bestTime = parseFloat(localStorage.getItem("bestTime")) || 0;
function saveBestTime(time = bestTime) {
  bestTime = time;
  localStorage.setItem("bestTime", time);
}

function playMusic(audio) {
  if (!settings.musicEnabled) return;
  audio.play().catch(() => { });
}

function playSFX(audio) {
  if (!settings.sfxEnabled) return;
  audio.currentTime = 0;
  audio.play().catch(() => { });
}

sounds.music.loop = true;

function updateMusicState() {
  if (settings.musicEnabled) {
    playMusic(sounds.music);
  } else {
    sounds.music.pause();
  }
}

updateMusicState();

document.addEventListener(
  "click",
  () => {
    updateMusicState();
  },
  { once: true }
);

const canvas = document.getElementById("game");
const gui = document.querySelector("div#gui");
const pauseButton = gui.querySelector("#pause");
const stats = gui.querySelector("#stats");
const gameoverStats =
  document.querySelector("#gameover p#stats");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 10, 5);
scene.add(sunLight);

let assetsLoaded = false;
const manager = new THREE.LoadingManager(() => {
  assetsLoaded = true;
});

const loader = new THREE.TextureLoader(manager);

const floorTexture = loader.load("/grass.png");
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(2, 2);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ map: floorTexture, color: 0x59bd37 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const playerTexture = loader.load("/ddededodediamante.png");
playerTexture.colorSpace = THREE.SRGBColorSpace;
playerTexture.generateMipmaps = false;
playerTexture.minFilter = THREE.NearestFilter;
playerTexture.magFilter = THREE.NearestFilter;

const player = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: playerTexture,
    transparent: true,
  })
);

player.scale.set(1.3, 2.6, 1);
player.position.set(0, 1.3, 0);
scene.add(player);

const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const moveSpeed = 0.12;
const jumpForce = 0.31;

let catBoosts = [];
let speedMultiplier = 1;

let velocityY = 0;
let onGround = false;
let playing = false;
let paused = false;
let gameStartTime = 0;
let elapsedTime = 0;
let catsCollected = 0;

const rain = [];
const lavaGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
const lavaMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

const catTexture = loader.load("/cat.webp");
const catGeometry = new THREE.BoxGeometry(0.7);
const catMaterial = new THREE.MeshStandardMaterial({
  map: catTexture,
  transparent: true,
});

let spawnDelay = 1200;
let lastSpawnTime = 0;
const spawnSpeedMultiplier = 0.985;
const minSpawnDelay = 150;

function spawnRain() {
  const x = WORLD_MIN_X + Math.random() * (WORLD_MAX_X - WORLD_MIN_X);

  if (Math.random() < CAT_CHANCE) {
    const cat = new THREE.Mesh(catGeometry, catMaterial);
    cat.position.set(x, 16, 0);
    cat.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    scene.add(cat);
    rain.push({ type: "cat", mesh: cat });
  } else {
    const lava = new THREE.Mesh(lavaGeometry, lavaMaterial);
    lava.position.set(x, 16, 0);

    scene.add(lava);
    rain.push({ type: "lava", mesh: lava });
  }

  spawnDelay = Math.max(minSpawnDelay, spawnDelay * spawnSpeedMultiplier);
}

function collision(mesh) {
  const dx = Math.abs(mesh.position.x - player.position.x);
  const dy = Math.abs(mesh.position.y - player.position.y);
  return dx < 0.7 && dy < 1.3;
}

let lastTime = 0;
function loop(time) {
  const delta = lastTime ? (time - lastTime) / 1000 : 0;
  lastTime = time;

  const frameScale = delta * 60;

  if (assetsLoaded) renderer.render(scene, camera);

  if (playing && !paused) {
    catBoosts = catBoosts.filter((end) => end > time);
    speedMultiplier = 1 + catBoosts.length * CAT_BOOST_AMOUNT;

    if (keys["a"] || keys["arrowleft"])
      player.position.x -= moveSpeed * speedMultiplier * frameScale;

    if (keys["d"] || keys["arrowright"])
      player.position.x += moveSpeed * speedMultiplier * frameScale;

    if ((keys["w"] || keys[" "] || keys["arrowup"]) && onGround) {
      velocityY = jumpForce;
      onGround = false;
    }

    velocityY -= (GRAVITY / 9) * frameScale;
    player.position.y += velocityY * frameScale;

    if (player.position.y <= 1.3) {
      player.position.y = 1.3;
      velocityY = 0;
      onGround = true;
    }

    if (time - lastSpawnTime >= spawnDelay) {
      spawnRain();
      lastSpawnTime = time;
    }

    for (let i = rain.length - 1; i >= 0; i--) {
      const r = rain[i];
      r.mesh.position.y -= GRAVITY * frameScale;

      if (r.type === "lava") {
        if (collision(r.mesh)) {
          gameOver();
          break;
        }
      }

      if (r.type === "cat") {
        r.mesh.rotation.x += 0.05 * frameScale;
        r.mesh.rotation.y += 0.05 * frameScale;
        r.mesh.rotation.z += 0.05 * frameScale;

        if (collision(r.mesh)) {
          playSFX(sounds.cat);

          catsCollected++;
          catBoosts.push(performance.now() + CAT_BOOST_DURATION);

          scene.remove(r.mesh);
          rain.splice(i, 1);
          continue;
        }
      }

      if (r.mesh.position.y < -5) {
        scene.remove(r.mesh);
        rain.splice(i, 1);
      }
    }

    player.position.x = Math.max(
      WORLD_MIN_X,
      Math.min(WORLD_MAX_X, player.position.x)
    );

    const targetX = player.position.x / 2;
    const smooth = 1 - Math.pow(settings.cameraSmoothness, frameScale);
    camera.position.x += (targetX - camera.position.x) * smooth;

    elapsedTime = ((time - gameStartTime) / 1000).toFixed(1);
    stats.innerHTML = `
      Timer: ${elapsedTime}<br>
      Rain spawning: ${(spawnDelay / 1000).toFixed(2)}s<br>
      Cats collected: ${catsCollected}
    `;
  }

  requestAnimationFrame(loop);
}

loop();

function gameOver() {
  playing = false;
  setPaused(false);

  const survivedSeconds =
    ((performance.now() - gameStartTime) / 1000).toFixed(1);

  let newRecord = survivedSeconds > bestTime;
  if (newRecord) {
    saveBestTime(survivedSeconds);
  }

  gameoverStats.innerHTML = `
    You survived for <b>${survivedSeconds}</b> seconds
    and collected <b>${catsCollected}</b> cats.
    <br><br>
    <b>${newRecord ? "New record!" : `Your highscore: ${bestTime}s`}</b>
  `;

  updateGUI();
  gameoverDialog.show();
  playSFX(sounds.scream);
}

function resetGame() {
  rain.forEach((l) => scene.remove(l.mesh));
  rain.length = 0;

  player.position.set(0, 1.3, 0);
  camera.position.set(0, 5, 10);

  velocityY = 0;
  spawnDelay = 1200;
  catBoosts.length = 0;
  speedMultiplier = 1;
  catsCollected = 0;
}

function startGame() {
  playing = true;
  setPaused(false);

  resetGame();
  lastSpawnTime = performance.now();
  gameStartTime = performance.now();
  elapsedTime = 0;

  playSFX(sounds.ddededodediamante);
  updateGUI();
}

let wasPaused = false;
window.addEventListener("blur", () => {
  if (playing) {
    wasPaused = paused;
    setPaused(true);
    updateGUI();
  }
});

window.addEventListener("focus", () => {
  if (playing) {
    setPaused(wasPaused);
    updateGUI();
  }
});

let pauseStartTime = 0;
function setPaused(value) {
  if (paused === value) return;

  paused = value;

  if (paused) {
    pauseStartTime = performance.now();
  } else {
    const pausedDuration = performance.now() - pauseStartTime;
    lastSpawnTime += pausedDuration;
    gameStartTime += pausedDuration;
  }

  updateGUI();
}

function updateGUI() {
  if (playing) {
    gui.style.display = null;
    pauseButton.innerHTML = `<img src="/${paused ? "resume" : "pause"}.svg">`;
  } else {
    gui.style.display = "none";
  }
}

pauseButton.addEventListener("click", () => {
  if (!playing) return;
  setPaused(!paused);
  updateGUI();
});

function createDialog(id, { show = false, buttons = {} } = {}) {
  const dialog = document.querySelector(`dialog#${id}`);

  if (show) dialog.style.display = "flex";

  for (const selector in buttons) {
    const btn = dialog.querySelector(selector);
    if (!btn) continue;
    btn.addEventListener("click", buttons[selector]);
  }

  return {
    show() {
      dialog.style.display = "flex";
    },
    hide() {
      dialog.style.display = "none";
    },
    element: dialog,
  };
}

const tutorialDialog = createDialog("tutorial", {
  show: false,
  buttons: {
    "button#back": () => {
      startDialog.show();
      tutorialDialog.hide();
    },
  },
});

const startDialog = createDialog("start", {
  show: true,
  buttons: {
    "button#start": () => {
      startDialog.hide();
      startGame();
    },
    "button#settings": () => {
      startDialog.hide();
      settingsDialog.show();
    },
    "button#tutorial": () => {
      startDialog.hide();
      tutorialDialog.show()
    },
  },
});

const gameoverDialog = createDialog("gameover", {
  buttons: {
    "button#restart": () => {
      gameoverDialog.hide();
      startGame();
    },
    "button#menu": () => {
      gameoverDialog.hide();
      startDialog.show();
    },
  },
});

const settingsDialog = createDialog("settings", {
  show: false,
  buttons: {
    "button#back": () => {
      startDialog.show();
      settingsDialog.hide();
      saveSettings();
    },
  },
});

const cameraSmoothnessInput =
  settingsDialog.element.querySelector("#camerasmoothness");
cameraSmoothnessInput.value = settings.cameraSmoothness;
cameraSmoothnessInput.addEventListener("input", (e) => {
  settings.cameraSmoothness = parseFloat(e.target.value);
  saveSettings();
});

const musicEnableInput =
  settingsDialog.element.querySelector("#musicenable");
musicEnableInput.checked = settings.musicEnabled;
const sfxEnableInput =
  settingsDialog.element.querySelector("#sfxenable");
sfxEnableInput.checked = settings.sfxEnabled;

musicEnableInput.addEventListener("change", (e) => {
  settings.musicEnabled = e.target.checked;
  updateMusicState();
  saveSettings();
});

sfxEnableInput.addEventListener("change", (e) => {
  settings.sfxEnabled = e.target.checked;
  saveSettings();
});

const hasTouch =
  window.matchMedia("(pointer: coarse)").matches ||
  navigator.maxTouchPoints > 0;
if (hasTouch) {
  const mobileControls = document.getElementById("mobilecontrols");
  mobileControls.style.display = "flex";

  function bindButton(button, key) {
    button.addEventListener("touchstart", (e) => {
      e.preventDefault();
      keys[key] = true;
    });
    button.addEventListener("touchend", (e) => {
      e.preventDefault();
      keys[key] = false;
    });
    button.addEventListener("touchcancel", () => {
      keys[key] = false;
    });
  }

  bindButton(mobileControls.querySelector("#left"), "a");
  bindButton(mobileControls.querySelector("#right"), "d");
  bindButton(mobileControls.querySelector("#up"), "w");
}
