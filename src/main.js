import "./styles.css";
import * as THREE from "three";

const WORLD_MIN_X = -8;
const WORLD_MAX_X = 8;
const GRAVITY = 0.18;

const canvas = document.getElementById("game");

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

const loader = new THREE.TextureLoader();

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

const player = new THREE.Sprite(new THREE.SpriteMaterial({
    map: playerTexture,
    transparent: true
}));
player.scale.set(1.3, 2.6, 1);
player.position.set(0, 1, 0);

scene.add(player);

const keys = {};
const moveSpeed = 0.12;
const jumpForce = 0.35;

let velocityY = 0;
let onGround = false;

const lavaCubes = [];
const lavaGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
const lavaMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

let spawnDelay = 1200;
const spawnSpeedMultiplier = 0.96;
const minSpawnDelay = 150;

window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

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
    setTimeout(spawnLava, spawnDelay);
}

spawnLava();

function animate() {
    requestAnimationFrame(animate);

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

    for (let i = lavaCubes.length - 1; i >= 0; i--) {
        lavaCubes[i].position.y -= GRAVITY;
        if (lavaCubes[i].position.y < -5) {
            scene.remove(lavaCubes[i]);
            lavaCubes.splice(i, 1);
        }
    }

    player.position.z = 0;
    player.position.x = Math.max(
        WORLD_MIN_X,
        Math.min(WORLD_MAX_X, player.position.x)
    );

    camera.position.x = player.position.x / 2;

    renderer.render(scene, camera);
}

animate();
