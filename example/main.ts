import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { MTextRenderer } from '../src';

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Create MText renderer
const mtextRenderer = new MTextRenderer();

// Example MText content
const mtextContent = "{\\C1;Hello World}\\P{\\C2;This is a test}\\P{\\C3;MText Renderer}";

// Create MText mesh
const mtextMesh = await mtextRenderer.createMesh(mtextContent, {
    height: 0.1,
    color: 0xffffff
});

// Add to scene
scene.add(mtextMesh);

// Add some lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate(); 