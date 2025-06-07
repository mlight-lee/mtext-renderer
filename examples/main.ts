import { MTextParser, MTextContext } from '@mlightcad/mtext-parser';
import * as THREE from 'three';
import { MText } from '../src/renderer/mext';
import { FontManager } from '../src/font';
import { StyleManager } from '../src/renderer/styleManager';

class MTextRendererExample {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private fontManager: FontManager;
    private styleManager: StyleManager;
    private currentMText: MText | null = null;

    // DOM elements
    private mtextInput: HTMLTextAreaElement;
    private validateBtn: HTMLButtonElement;
    private renderBtn: HTMLButtonElement;
    private statusDiv: HTMLDivElement;
    private fontSelect: HTMLSelectElement;

    // Font library URL
    private readonly fontBaseUrl = 'https://raw.githubusercontent.com/mlight-lee/cad-data/main/fonts/';
    private readonly fontLibraryUrl = `${this.fontBaseUrl}fonts.json`;

    constructor() {
        // Initialize Three.js components
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x333333);

        // Use orthographic camera for 2D rendering
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 10;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Initialize managers
        this.fontManager = FontManager.instance;
        this.styleManager = new StyleManager();

        // Get DOM elements
        this.mtextInput = document.getElementById('mtext-input') as HTMLTextAreaElement;
        this.validateBtn = document.getElementById('validate-btn') as HTMLButtonElement;
        this.renderBtn = document.getElementById('render-btn') as HTMLButtonElement;
        this.statusDiv = document.getElementById('status') as HTMLDivElement;
        this.fontSelect = document.getElementById('font-select') as HTMLSelectElement;

        // Add lights
        this.setupLights();

        // Setup event listeners
        this.setupEventListeners();

        // Load font library
        this.loadFontLibrary();

        // Initial render
        this.renderMText(this.mtextInput.value);

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
            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = 10;
            this.camera.left = frustumSize * aspect / -2;
            this.camera.right = frustumSize * aspect / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = frustumSize / -2;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Validate button
        this.validateBtn.addEventListener('click', () => {
            const content = this.mtextInput.value;
            const isValid = this.validateMText(content);
            this.statusDiv.textContent = isValid ? 'Valid MText content' : 'Invalid MText content';
            this.statusDiv.style.color = isValid ? '#0f0' : '#f00';
        });

        // Render button
        this.renderBtn.addEventListener('click', () => {
            const content = this.mtextInput.value;
            if (this.validateMText(content)) {
                this.renderMText(content);
                this.statusDiv.textContent = 'MText rendered successfully';
                this.statusDiv.style.color = '#0f0';
            } else {
                this.statusDiv.textContent = 'Cannot render invalid MText content';
                this.statusDiv.style.color = '#f00';
            }
        });

        // Font selection
        this.fontSelect.addEventListener('change', () => {
            const content = this.mtextInput.value;
            if (this.validateMText(content)) {
                this.renderMText(content);
            }
        });
    }

    private async loadFontLibrary(): Promise<void> {
        try {
            const response = await fetch(this.fontLibraryUrl);
            if (!response.ok) throw new Error('Failed to load font library');
            const fonts = await response.json();
            
            // Clear existing options except the first one
            this.fontSelect.innerHTML = '<option value="Arial">Arial</option>';
            
            fonts.forEach(font => {
                const option = document.createElement('option');
                option.value = font.file;
                option.textContent = font.name;
                this.fontSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading font library:', error);
            this.statusDiv.textContent = 'Error loading font library';
            this.statusDiv.style.color = '#f00';
        }
    }

    private validateMText(content: string): boolean {
        try {
            const context = new MTextContext();
            const parser = new MTextParser(content, context, true);
            parser.parse();
            return true;
        } catch (error) {
            return false;
        }
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
            position: new THREE.Vector3(0, 0, 0)
        };

        this.currentMText = new MText(mtextContent, {
            name: 'Standard',
            standardFlag: 0,
            fixedTextHeight: 0.1,
            widthFactor: 1,
            obliqueAngle: 0,
            textGenerationFlag: 0,
            lastHeight: 0.1,
            font: this.fontSelect.value,
            bigFont: '',
            color: 0xffffff
        }, this.styleManager, this.fontManager);

        this.scene.add(this.currentMText);
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

// Create and start the example
new MTextRendererExample(); 