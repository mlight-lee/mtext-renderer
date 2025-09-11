import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { UnifiedRenderer, RenderMode } from '../src/worker';
import { MTextData, TextStyle } from '../src/renderer/types';

class MTextRendererExample {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private unifiedRenderer: UnifiedRenderer;
  private currentMText: THREE.Object3D | null = null;
  private mtextBox: THREE.LineSegments | null = null;

  // DOM elements
  private mtextInput: HTMLTextAreaElement;
  private renderBtn: HTMLButtonElement;
  private statusDiv: HTMLDivElement;
  private fontSelect: HTMLSelectElement;
  private showBoundingBoxCheckbox: HTMLInputElement;
  private renderModeSelect: HTMLSelectElement;

  // Example texts
  private readonly exampleTexts = {
    basic:
      '{\\C1;Hello World}\\P{\\C2;Diameter: %%c50}\\P{\\C3;Temperature: 25%%d}\\P{\\C4;Tolerance: %%p0.1}\\P{\\C6;\\LUnderlined\\l, \\OOverlined\\o, \\KStriked\\k}\\P{\\C7;\\Q15;Oblique 15 deg}\\P{\\C8;\\FArial|b1;Bold Text}\\P{\\C9;\\FArial|i1;Italic Text}\\P{\\C10;\\FArial|b1|i1;Bold Italic Text}\\PUnicode: \\U+4F60\\U+597D (should display 你好)',
    complex:
      '{\\C1;\\W2;Title}\\P{\\C2;This is a paragraph with different styles.}\\P{\\C3;\\W1.5;Subtitle}\\P{\\C4;• First item\\P• Second item\\P• Third item}\\P{\\T2;Absolute character spacing: 2, }{\\T0.2x;Relative character spacing: 0.2}\\P{\\W0.8;Footer text}',
    color:
      '{\\C0;By Block}\\P{\\C1;Red Text}\\P{\\C2;Yellow Text}\\P{\\C3;Green Text}\\P{\\C4;Cyan Text}\\P{\\C5;Blue Text}\\P{\\C6;Magenta Text}\\P{\\C7;White Text}\\P{\\C256;By Layer}\\P{\\c16761035;Pink (0x0FFC0CB)}\\PRestore ByLayer\\P\\C1;Old Context Color: Red, {\\C2; New Context Color: Yellow, } Restored Context Color: Red',
    font: '{\\C1;\\W2;\\FSimSun;SimSun Text}\\P{\\C2;\\W0.5;\\FArial;Arial Text}\\P{\\C3;30;\\Faehalf.shx;SHX Text}\\P{\\C4;\\Q1;\\FSimHei;SimHei Text}\\P{\\C5;\\Q0.5;\\FSimKai;SimKai Text}',
    stacking:
      '{\\C1;Basic Fractions:}\\P{\\C2;The value is \\S1/2; and \\S3/4; of the total.}\\P{\\C3;Stacked Fractions:}\\P{\\C4;\\S1 2/3 4; represents \\Sx^ y; in the equation \\S1#2;.}\\P{\\C5;Complex Fractions:}\\P{\\C6;The result \\S1/2/3; is between \\S1^ 2^ 3; and \\S1#2#3;.}\\P{\\C7;Subscript Examples:}\\P{\\C8;H\\S^ 2;O (Water)}\\P{\\C9;CO\\S^ 2; (Carbon Dioxide)}\\P{\\C10;x\\S^ 2; + y\\S^ 2;}\\P{\\C11;Superscript Examples:}\\P{\\C12;E = mc\\S2^ ; (Energy)}\\P{\\C13;x\\S2^ ; + y\\S2^ ; = r\\S2^ ; (Circle)}\\P{\\C14;Combined Examples:}\\P{\\C15;H\\S^ 2;O\\S2^ ; (Hydrogen Peroxide)}\\P{\\C16;Fe\\S^ 2;+\\S3^ ; (Iron Ion)}',
    alignment:
      '{\\pql;Left aligned paragraph.}\\P{\\pqc;Center aligned paragraph.}\\P{\\pqr;Right aligned paragraph.}\\P{\\pqc;Center again.}\\P{\\pql;Back to left.}',
    paragraph:
      '{\\pql;\\P{\\pqi;\\pxi2;\\pxl5;\\pxr5;This paragraph has an indent of 2 units, left margin of 5 units, and right margin of 5 units. The first line is indented.}\\P{\\pqi;\\pxi2;\\pxl5;\\pxr5;This is the second line of the same paragraph, showing the effect of margins.}}',
  };

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
    const frustumSize = 5;

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
    this.renderer.setPixelRatio(window.devicePixelRatio);
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

    // Initialize unified renderer (default to main thread)
    this.unifiedRenderer = new UnifiedRenderer('worker');

    // Get DOM elements
    this.mtextInput = document.getElementById('mtext-input') as HTMLTextAreaElement;
    this.renderBtn = document.getElementById('render-btn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLDivElement;
    this.fontSelect = document.getElementById('font-select') as HTMLSelectElement;
    this.showBoundingBoxCheckbox = document.getElementById('show-bounding-box') as HTMLInputElement;
    this.renderModeSelect = document.getElementById('render-mode') as HTMLSelectElement;

    // Add lights
    this.setupLights();

    // Setup event listeners
    this.setupEventListeners();

    // Initialize fonts and UI, then render
    this.initializeFonts()
      .then(() => {
        // Initial render after fonts are loaded
        void this.renderMText(this.mtextInput.value);
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
      const frustumSize = 5;

      this.camera.left = (frustumSize * aspect) / -2;
      this.camera.right = (frustumSize * aspect) / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = frustumSize / -2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });

    // Render button
    this.renderBtn.addEventListener('click', async () => {
      const content = this.mtextInput.value;
      await this.renderMText(content);
    });

    // Font selection
    this.fontSelect.addEventListener('change', async () => {
      const content = this.mtextInput.value;
      const selectedFont = this.fontSelect.value;

      try {
        // Show loading status
        this.statusDiv.textContent = `Loading font ${selectedFont}...`;
        this.statusDiv.style.color = '#ffa500';

        // Load the selected font
        await this.unifiedRenderer.loadFonts([selectedFont]);

        // Re-render MText with new font
        await this.renderMText(content);

        // Update status
        this.statusDiv.textContent = `Font changed to ${selectedFont}`;
        this.statusDiv.style.color = '#0f0';
      } catch (error) {
        console.error('Error loading font:', error);
        this.statusDiv.textContent = `Error loading font ${selectedFont}`;
        this.statusDiv.style.color = '#f00';
      }
    });

    // Example buttons
    document.querySelectorAll('.example-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const exampleType = (button as HTMLElement).dataset.example;
        if (exampleType && this.exampleTexts[exampleType as keyof typeof this.exampleTexts]) {
          const content = this.exampleTexts[exampleType as keyof typeof this.exampleTexts];
          this.mtextInput.value = content;

          // Get required fonts from the MText content
          const requiredFonts = Array.from(this.getFontsFromMText(content, true));
          if (requiredFonts.length > 0) {
            try {
              // Show loading status
              this.statusDiv.textContent = `Loading fonts: ${requiredFonts.join(', ')}...`;
              this.statusDiv.style.color = '#ffa500';

              // Load the required fonts
              await this.unifiedRenderer.loadFonts(requiredFonts);

              // Update status
              this.statusDiv.textContent = 'Fonts loaded successfully';
              this.statusDiv.style.color = '#0f0';
            } catch (error) {
              console.error('Error loading fonts:', error);
              this.statusDiv.textContent = `Error loading fonts: ${requiredFonts.join(', ')}`;
              this.statusDiv.style.color = '#f00';
            }
          }

          await this.renderMText(content);
        }
      });
    });

    // Bounding box toggle
    this.showBoundingBoxCheckbox.addEventListener('change', () => {
      if (this.mtextBox) {
        this.mtextBox.visible = this.showBoundingBoxCheckbox.checked;
      }
    });

    // Render mode toggle
    this.renderModeSelect.addEventListener('change', async () => {
      const mode = this.renderModeSelect.value as RenderMode;
      this.unifiedRenderer.switchMode(mode);
      this.statusDiv.textContent = `Switched to ${mode} thread rendering`;
      this.statusDiv.style.color = '#0f0';
      // Re-render with current content to reflect the new mode
      await this.renderMText(this.mtextInput.value);
    });
  }

  private async initializeFonts(): Promise<void> {
    try {
      // Load available fonts for the dropdown
      const result = await this.unifiedRenderer.getAvailableFonts();
      const fonts = result.fonts;

      // Load default fonts
      await this.unifiedRenderer.loadFonts(['simkai']);

      // Clear existing options
      this.fontSelect.innerHTML = '';

      // Add all available fonts to dropdown
      fonts.forEach((font) => {
        const option = document.createElement('option');
        option.value = font.name[0];
        option.textContent = font.name[0]; // Use the first name from the array
        // Set selected if this is the default font
        if (font.name[0] === 'simkai') {
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

  /**
   * Draws a bounding box for the text using the given position, max width, and the height from the box property.
   * @param box The bounding box of the MText (for height)
   * @param position The position (THREE.Vector3) of the text box (min corner)
   * @param maxWidth The maximum width of the text box
   */
  private createMTextBox(
    box: THREE.Box3,
    position: THREE.Vector3,
    maxWidth?: number
  ): THREE.LineSegments {
    // Remove existing box if any
    if (this.mtextBox) {
      this.scene.remove(this.mtextBox);
    }

    // The min and max y/z come from the box, x is from position and maxWidth
    const minY = box.min.y;
    const maxY = box.max.y;
    const minZ = box.min.z;
    const maxZ = box.max.z;
    const minX = position.x;
    const maxX = maxWidth !== undefined && maxWidth > 0 ? minX + maxWidth : box.max.x;

    const vertices = [
      // Bottom face
      minX,
      minY,
      minZ,
      maxX,
      minY,
      minZ,
      maxX,
      minY,
      minZ,
      maxX,
      maxY,
      minZ,
      maxX,
      maxY,
      minZ,
      minX,
      maxY,
      minZ,
      minX,
      maxY,
      minZ,
      minX,
      minY,
      minZ,
      // Top face
      minX,
      minY,
      maxZ,
      maxX,
      minY,
      maxZ,
      maxX,
      minY,
      maxZ,
      maxX,
      maxY,
      maxZ,
      maxX,
      maxY,
      maxZ,
      minX,
      maxY,
      maxZ,
      minX,
      maxY,
      maxZ,
      minX,
      minY,
      maxZ,
      // Sides
      minX,
      minY,
      minZ,
      minX,
      minY,
      maxZ,
      maxX,
      minY,
      minZ,
      maxX,
      minY,
      maxZ,
      maxX,
      maxY,
      minZ,
      maxX,
      maxY,
      maxZ,
      minX,
      maxY,
      minZ,
      minX,
      maxY,
      maxZ,
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 1 });
    this.mtextBox = new THREE.LineSegments(geometry, material);

    // Apply the same transformation as the MText object
    if (this.currentMText) {
      this.mtextBox.position.copy(this.currentMText.position);
      this.mtextBox.rotation.copy(this.currentMText.rotation);
      this.mtextBox.scale.copy(this.currentMText.scale);
    }

    return this.mtextBox;
  }

  private async renderMText(content: string): Promise<void> {
    try {
      // Show loading status
      this.statusDiv.textContent = 'Rendering MText...';
      this.statusDiv.style.color = '#ffa500';

      // Remove existing MText if any
      if (this.currentMText) {
        this.scene.remove(this.currentMText);
      }

      // Create MText data
      const mtextContent: MTextData = {
        text: content,
        height: 0.1,
        width: 5.5,
        position: new THREE.Vector3(-3, 2, 0),
      };

      const textStyle: TextStyle = {
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
      };

      // Render MText using unified renderer
      this.currentMText = await this.unifiedRenderer.renderMText(mtextContent, textStyle, {
        byLayerColor: 0xffffff,
        byBlockColor: 0xffffff,
      });
      this.scene.add(this.currentMText);

      // Create box around MText using its bounding box only if checkbox is checked
      if (
        this.showBoundingBoxCheckbox.checked &&
        (this.currentMText as THREE.Object3D & { box?: THREE.Box3 }).box &&
        !(this.currentMText as THREE.Object3D & { box?: THREE.Box3 }).box.isEmpty()
      ) {
        const box = this.createMTextBox(
          (this.currentMText as THREE.Object3D & { box?: THREE.Box3 }).box!,
          new THREE.Vector3(
            mtextContent.position.x,
            mtextContent.position.y,
            mtextContent.position.z
          ),
          mtextContent.width
        );
        this.scene.add(box);
      }

      // Update status
      this.statusDiv.textContent = 'MText rendered successfully';
      this.statusDiv.style.color = '#0f0';
    } catch (error) {
      console.error('Error rendering MText:', error);
      this.statusDiv.textContent = 'Error rendering MText';
      this.statusDiv.style.color = '#f00';
    }
  }

  /**
   * Extract font names from MText content (simplified version)
   */
  private getFontsFromMText(mtext: string, removeExtension: boolean = false): Set<string> {
    const fonts = new Set<string>();
    const fontRegex = /\\f([^\\|;]+)/gi;
    let match;

    while ((match = fontRegex.exec(mtext)) !== null) {
      let fontName = match[1].toLowerCase();
      if (removeExtension) {
        fontName = fontName.replace(/\.(ttf|otf|shx)$/i, '');
      }
      fonts.add(fontName);
    }

    return fonts;
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Cleanup method to destroy the renderer
   */
  public destroy(): void {
    this.unifiedRenderer.destroy();
  }
}

// Create and start the example
const app = new MTextRendererExample();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
});
