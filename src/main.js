import "./styles.css";
import * as THREE from "three";

const WORLD_MIN_X = -8;
const WORLD_MAX_X = 8;
const GRAVITY = 0.18;

const sounds = {
    ddededodediamante: new Audio('/ddededodediamante.wav'),
    scream: new Audio('/scream.wav'),
    music: new Audio('/newfriendly.mp3')
};

let settings = {
    cameraSmoothness: 0.1
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

sounds.music.loop = true;

sounds.music.play().catch(() => {
    document.addEventListener('click', () => {
        sounds.music.play();
    }, { once: true });
});

const canvas = document.getElementById("game");
const pauseButton = document.getElementById("pause");

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
        transparent: true
    })
);

player.scale.set(1.3, 2.6, 1);
player.position.set(0, 1.3, 0);
scene.add(player);

const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const moveSpeed = 0.12;
const jumpForce = 0.31;

let velocityY = 0;
let onGround = false;
let playing = false;
let paused = false;

const lavaCubes = [];
const lavaGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
const lavaMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

let spawnDelay = 1200;
let lastSpawnTime = 0;
const spawnSpeedMultiplier = 0.985;
const minSpawnDelay = 150;

function spawnLava() {
    const lava = new THREE.Mesh(lavaGeometry, lavaMaterial);
    lava.position.set(
        WORLD_MIN_X + Math.random() * (WORLD_MAX_X - WORLD_MIN_X),
        20,
        0
    );

    scene.add(lava);
    lavaCubes.push(lava);

    spawnDelay = Math.max(minSpawnDelay, spawnDelay * spawnSpeedMultiplier);
}

function lavaCollision(lava) {
    const dx = Math.abs(lava.position.x - player.position.x);
    const dy = Math.abs(lava.position.y - player.position.y);
    return dx < 0.7 && dy < 1.3;
}

function loop(time) {
    if (assetsLoaded) renderer.render(scene, camera);

    if (playing && !paused) {
        if (keys["a"] || keys["arrowleft"]) player.position.x -= moveSpeed;
        if (keys["d"] || keys["arrowright"]) player.position.x += moveSpeed;

        if ((keys["w"] || keys[" "] || keys["arrowup"]) && onGround) {
            velocityY = jumpForce;
            onGround = false;
        }

        velocityY -= GRAVITY / 9;
        player.position.y += velocityY;

        if (player.position.y <= 1.3) {
            player.position.y = 1.3;
            velocityY = 0;
            onGround = true;
        }

        if (time - lastSpawnTime >= spawnDelay) {
            spawnLava();
            lastSpawnTime = time;
        }

        for (let i = lavaCubes.length - 1; i >= 0; i--) {
            const lava = lavaCubes[i];
            lava.position.y -= GRAVITY;

            if (lavaCollision(lava)) {
                gameOver();
                break;
            }

            if (lava.position.y < -5) {
                scene.remove(lava);
                lavaCubes.splice(i, 1);
            }
        }

        player.position.x = Math.max(
            WORLD_MIN_X,
            Math.min(WORLD_MAX_X, player.position.x)
        );

        const targetX = player.position.x / 2;
        camera.position.x += (targetX - camera.position.x) * (1 - settings.cameraSmoothness);
    }

    requestAnimationFrame(loop);
}

loop();

function gameOver() {
    playing = false;
    setPaused(false);

    updatePauseButton();
    gameoverDialog.show();
    sounds.scream.play();
}

function resetGame() {
    lavaCubes.forEach(l => scene.remove(l));
    lavaCubes.length = 0;

    player.position.set(0, 1.3, 0);
    velocityY = 0;
    spawnDelay = 1200;

    camera.position.set(0, 5, 10);
}

function startGame() {
    playing = true;
    setPaused(false);

    resetGame();
    lastSpawnTime = performance.now();

    sounds.ddededodediamante.play();
    updatePauseButton();
}

let wasPaused = false;
window.addEventListener("blur", () => {
    if (playing) {
        wasPaused = paused;
        setPaused(true);
        updatePauseButton();
    }
});

window.addEventListener("focus", () => {
    if (playing) {
        setPaused(wasPaused);
        updatePauseButton();
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
    }

    updatePauseButton();
}

function updatePauseButton() {
    pauseButton.style.display = playing ? "block" : "none";
    pauseButton.innerHTML = `<img src="/${paused ? "resume" : "pause"}.svg">`;
}

pauseButton.addEventListener("click", () => {
    if (!playing) return;
    setPaused(!paused);
    updatePauseButton();
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
        show() { dialog.style.display = "flex"; },
        hide() { dialog.style.display = "none"; },
        element: dialog
    };
}

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
        }
    }
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
        }
    }
});

const settingsDialog = createDialog("settings", {
    show: false,
    buttons: {
        "button#back": () => {
            startDialog.show();
            settingsDialog.hide();
            saveSettings();
        }
    }
});

const cameraSmoothnessInput = settingsDialog.element.querySelector("#camerasmoothness");
cameraSmoothnessInput.value = settings.cameraSmoothness;
cameraSmoothnessInput.addEventListener("input", e => {
    settings.cameraSmoothness = parseFloat(e.target.value);
    saveSettings();
});
