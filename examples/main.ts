import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { MText } from '../src/renderer/mext';
import { FontManager } from '../src/font';
import { StyleManager } from '../src/renderer/styleManager';
import { DefaultFontLoader } from '../src/font/defaultFontLoader';

class MTextRendererExample {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private fontManager: FontManager;
  private styleManager: StyleManager;
  private currentMText: MText | null = null;
  private fontLoader: DefaultFontLoader;
  private mtextBox: THREE.LineSegments | null = null;

  // DOM elements
  private mtextInput: HTMLTextAreaElement;
  private renderBtn: HTMLButtonElement;
  private statusDiv: HTMLDivElement;
  private fontSelect: HTMLSelectElement;
  private showBoundingBoxCheckbox: HTMLInputElement;

  constructor() {
    // Initialize Three.js components
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x333333);

    // Use orthographic camera for 2D rendering
    const renderArea = document.getElementById('render-area');
    if (!renderArea) return;

    const width = renderArea.clientWidth;
    const height = renderArea.clientHeight;
    const aspect = width / height;
    const frustumSize = 10;

    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    renderArea.appendChild(this.renderer.domElement);

    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2;

    // Initialize managers and loader
    this.fontManager = FontManager.instance;
    this.styleManager = new StyleManager();
    this.fontLoader = new DefaultFontLoader();

    // Get DOM elements
    this.mtextInput = document.getElementById('mtext-input') as HTMLTextAreaElement;
    this.renderBtn = document.getElementById('render-btn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLDivElement;
    this.fontSelect = document.getElementById('font-select') as HTMLSelectElement;
    this.showBoundingBoxCheckbox = document.getElementById('show-bounding-box') as HTMLInputElement;

    // Add lights
    this.setupLights();

    // Setup event listeners
    this.setupEventListeners();

    // Initialize fonts and UI, then render
    this.initializeFonts()
      .then(() => {
        // Initial render after fonts are loaded
        this.renderMText(this.mtextInput.value);
      })
      .catch((error) => {
        console.error('Failed to initialize fonts:', error);
        this.statusDiv.textContent = 'Failed to initialize fonts';
        this.statusDiv.style.color = '#f00';
      });

    // Start animation loop
    this.animate();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
  }

  private setupEventListeners(): void {
    // Window resize
    window.addEventListener('resize', () => {
      const renderArea = document.getElementById('render-area');
      if (!renderArea) return;

      const width = renderArea.clientWidth;
      const height = renderArea.clientHeight;
      const aspect = width / height;
      const frustumSize = 10;

      this.camera.left = (frustumSize * aspect) / -2;
      this.camera.right = (frustumSize * aspect) / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = frustumSize / -2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });

    // Render button
    this.renderBtn.addEventListener('click', () => {
      const content = this.mtextInput.value;
      this.renderMText(content);
      this.statusDiv.textContent = 'MText rendered successfully';
      this.statusDiv.style.color = '#0f0';
    });

    // Font selection
    this.fontSelect.addEventListener('change', async () => {
      const content = this.mtextInput.value;
      const selectedFont = this.fontSelect.value;

      try {
        // Show loading status
        this.statusDiv.textContent = `Loading font ${selectedFont}...`;
        this.statusDiv.style.color = '#ffa500'; // Orange color for loading state

        // Load the selected font
        await this.fontLoader.load([selectedFont]);

        // Re-render MText with new font
        this.renderMText(content);

        // Update status to indicate font change
        this.statusDiv.textContent = `Font changed to ${selectedFont}`;
        this.statusDiv.style.color = '#0f0';
      } catch (error) {
        console.error('Error loading font:', error);
        this.statusDiv.textContent = `Error loading font ${selectedFont}`;
        this.statusDiv.style.color = '#f00';
      }
    });

    // Bounding box toggle
    this.showBoundingBoxCheckbox.addEventListener('change', () => {
      if (this.mtextBox) {
        this.mtextBox.visible = this.showBoundingBoxCheckbox.checked;
      }
    });
  }

  private async initializeFonts(): Promise<void> {
    try {
      // Load available fonts for the dropdown
      const fonts = await this.fontLoader.getAvaiableFonts();

      // Load default fonts
      await this.fontLoader.load([this.fontManager.defaultFont]);

      // Clear existing options
      this.fontSelect.innerHTML = '';

      // Add all available fonts to dropdown
      fonts.forEach((font) => {
        const option = document.createElement('option');
        option.value = font.name[0];
        option.textContent = font.name[0]; // Use the first name from the array
        // Set selected if this is the default font
        if (font.name[0] === this.fontManager.defaultFont) {
          option.selected = true;
        }
        this.fontSelect.appendChild(option);
      });

      this.statusDiv.textContent = 'Fonts loaded successfully';
      this.statusDiv.style.color = '#0f0';
    } catch (error) {
      console.error('Error loading fonts:', error);
      this.statusDiv.textContent = 'Error loading fonts';
      this.statusDiv.style.color = '#f00';
      throw error; // Re-throw to handle in the constructor
    }
  }

  private createMTextBox(box: THREE.Box3): THREE.LineSegments {
    // Remove existing box if any
    if (this.mtextBox) {
      this.scene.remove(this.mtextBox);
    }

    // Create box geometry
    const geometry = new THREE.BufferGeometry();
    const min = box.min;
    const max = box.max;
    const vertices = new Float32Array([
      min.x,
      min.y,
      0, // bottom left
      max.x,
      min.y,
      0, // bottom right
      max.x,
      max.y,
      0, // top right
      min.x,
      max.y,
      0, // top left
      min.x,
      min.y,
      0, // back to bottom left
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Create line material
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 1,
    });

    // Create line segments
    this.mtextBox = new THREE.LineSegments(geometry, material);
    return this.mtextBox;
  }

  private renderMText(content: string): void {
    // Remove existing MText if any
    if (this.currentMText) {
      this.scene.remove(this.currentMText);
    }

    // Create new MText instance
    const mtextContent = {
      text: content,
      height: 0.1,
      width: 0,
      position: new THREE.Vector3(0, 0, 0),
    };

    this.currentMText = new MText(
      mtextContent,
      {
        name: 'Standard',
        standardFlag: 0,
        fixedTextHeight: 0.1,
        widthFactor: 1,
        obliqueAngle: 0,
        textGenerationFlag: 0,
        lastHeight: 0.1,
        font: this.fontSelect.value,
        bigFont: '',
        color: 0xffffff,
      },
      this.styleManager,
      this.fontManager
    );

    this.scene.add(this.currentMText);

    // Create box around MText using its bounding box only if checkbox is checked
    if (
      this.showBoundingBoxCheckbox.checked &&
      this.currentMText.box &&
      !this.currentMText.box.isEmpty()
    ) {
      const box = this.createMTextBox(this.currentMText.box);
      this.scene.add(box);
    }
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Create and start the example
new MTextRendererExample();
