// module.js - Draggable and resizable UI modules

// Global module registry for proximity detection
const ModuleRegistry = {
    modules: [],
    config: null, // Will be set from config.json
    canvasTransform: { panOffsetX: 0, panOffsetY: 0, zoomScale: 1.0 }, // Canvas transform state
    register(module) {
        this.modules.push(module);
    },
    unregister(module) {
        this.modules = this.modules.filter(m => m !== module);
    },
    getAll() {
        return this.modules;
    },
    getAllExcept(module) {
        return this.modules.filter(m => m !== module);
    },
    setConfig(config) {
        this.config = config;
    },
    getBorderMargin() {
        return this.config?.ui?.dragBorderMargin || 10;
    },
    getBorderWarningDistance() {
        return this.config?.ui?.dragBorderWarningDistance || 30;
    },
    setCanvasTransform(panOffsetX, panOffsetY, zoomScale) {
        this.canvasTransform = { panOffsetX, panOffsetY, zoomScale };
    },
    // Convert screen coordinates to canvas space
    screenToCanvas(screenX, screenY) {
        const { panOffsetX, panOffsetY, zoomScale } = this.canvasTransform;
        return {
            x: (screenX - panOffsetX) / zoomScale,
            y: (screenY - panOffsetY) / zoomScale
        };
    },
    // Convert canvas coordinates to screen space
    canvasToScreen(canvasX, canvasY) {
        const { panOffsetX, panOffsetY, zoomScale } = this.canvasTransform;
        return {
            x: canvasX * zoomScale + panOffsetX,
            y: canvasY * zoomScale + panOffsetY
        };
    }
};

class Module {
    constructor(id, title, defaultPosition = { x: 20, y: 20 }, defaultSize = { width: 250, height: 200 }, resizable = true) {
        this.id = id;
        this.title = title;
        this.resizable = resizable;
        this.container = null;
        this.dragHandle = null;
        this.resizeHandle = null;
        this.contentContainer = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        this.proximityThreshold = 20; // pixels distance for proximity detection
        this.repulsionForce = 5; // pixels to push away per frame
        this.isFlipped = false; // Track card flip state
        
        // Load saved position/size or use defaults
        const saved = this.loadState();
        this.position = saved?.position || defaultPosition;
        this.size = saved?.size || defaultSize;
        
        this.createContainer();
        this.setupEventListeners();
        
        // Register this module
        ModuleRegistry.register(this);
    }
    
    createContainer() {
        // Main container
        this.container = document.createElement('div');
        this.container.className = 'module';
        this.container.id = this.id;
        this.container.style.position = 'absolute';
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
        this.container.style.width = `${this.size.width}px`;
        this.container.style.height = `${this.size.height}px`;
        this.container.style.background = 'rgba(0, 0, 0, 0.7)';
        this.container.style.border = '1px solid #333';
        this.container.style.borderRadius = '5px';
        this.container.style.zIndex = '10';
        this.container.style.overflow = 'hidden';
        this.container.style.transition = 'border-color 0.2s';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.transformStyle = 'preserve-3d';
        this.container.style.perspective = '1000px';
        
        // Card wrapper for flip effect
        this.cardWrapper = document.createElement('div');
        this.cardWrapper.className = 'module-card-wrapper';
        this.cardWrapper.style.flex = '1';
        this.cardWrapper.style.position = 'relative';
        this.cardWrapper.style.transformStyle = 'preserve-3d';
        this.cardWrapper.style.transition = 'transform 0.6s';
        this.cardWrapper.style.minHeight = '0'; // Allow flex shrinking
        
        // Front face (main content)
        this.frontFace = document.createElement('div');
        this.frontFace.className = 'module-face module-front';
        this.frontFace.style.position = 'absolute';
        this.frontFace.style.width = '100%';
        this.frontFace.style.height = '100%';
        this.frontFace.style.backfaceVisibility = 'hidden';
        this.frontFace.style.display = 'flex';
        this.frontFace.style.flexDirection = 'column';
        
        // Back face (settings)
        this.backFace = document.createElement('div');
        this.backFace.className = 'module-face module-back';
        this.backFace.style.position = 'absolute';
        this.backFace.style.width = '100%';
        this.backFace.style.height = '100%';
        this.backFace.style.backfaceVisibility = 'hidden';
        this.backFace.style.transform = 'rotateY(180deg)';
        this.backFace.style.display = 'flex';
        this.backFace.style.flexDirection = 'column';
        this.backFace.style.background = 'rgba(0, 0, 0, 0.7)';
        
        // Header/Title bar (always visible, lower opacity by default)
        this.dragHandle = document.createElement('div');
        this.dragHandle.className = 'module-drag-handle';
        this.dragHandle.style.position = 'relative';
        this.dragHandle.style.width = '100%';
        this.dragHandle.style.height = '24px';
        this.dragHandle.style.minHeight = '24px';
        this.dragHandle.style.background = 'rgba(0, 255, 136, 0.1)';
        this.dragHandle.style.borderBottom = '1px solid rgba(0, 255, 136, 0.3)';
        this.dragHandle.style.cursor = 'grab';
        this.dragHandle.style.display = 'flex';
        this.dragHandle.style.alignItems = 'center';
        this.dragHandle.style.justifyContent = 'center';
        this.dragHandle.style.fontFamily = 'monospace';
        this.dragHandle.style.fontSize = '12px';
        this.dragHandle.style.color = 'rgba(0, 255, 136, 0.6)';
        this.dragHandle.style.transition = 'background 0.2s, color 0.2s, border-color 0.2s';
        this.dragHandle.style.flexShrink = '0';
        this.dragHandle.textContent = '⋮⋮⋮ ' + this.title;
        
        // Settings icon (top-right, appears on hover)
        this.settingsIcon = document.createElement('div');
        this.settingsIcon.className = 'module-settings-icon';
        this.settingsIcon.style.position = 'absolute';
        this.settingsIcon.style.top = '4px';
        this.settingsIcon.style.right = '8px';
        this.settingsIcon.style.width = '16px';
        this.settingsIcon.style.height = '16px';
        this.settingsIcon.style.cursor = 'pointer';
        this.settingsIcon.style.color = 'rgba(0, 255, 136, 0.6)';
        this.settingsIcon.style.fontSize = '14px';
        this.settingsIcon.style.display = 'none';
        this.settingsIcon.style.alignItems = 'center';
        this.settingsIcon.style.justifyContent = 'center';
        this.settingsIcon.style.transition = 'color 0.2s';
        this.settingsIcon.textContent = '⚙';
        this.settingsIcon.title = 'Module settings';
        this.dragHandle.appendChild(this.settingsIcon);
        
        // Resize handle (appears on hover at bottom-right) - only if resizable
        if (this.resizable) {
            this.resizeHandle = document.createElement('div');
            this.resizeHandle.className = 'module-resize-handle';
            this.resizeHandle.style.position = 'absolute';
            this.resizeHandle.style.bottom = '0';
            this.resizeHandle.style.right = '0';
            this.resizeHandle.style.width = '16px';
            this.resizeHandle.style.height = '16px';
            this.resizeHandle.style.background = 'rgba(0, 255, 136, 0.3)';
            this.resizeHandle.style.borderTopLeft = '1px solid #00ff88';
            this.resizeHandle.style.cursor = 'nwse-resize';
            this.resizeHandle.style.display = 'none';
            this.resizeHandle.textContent = '⋰';
            this.resizeHandle.style.fontSize = '10px';
            this.resizeHandle.style.color = '#00ff88';
            this.resizeHandle.style.textAlign = 'center';
            this.resizeHandle.style.lineHeight = '16px';
        }
        
        // Content container
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'module-content';
        this.contentContainer.style.padding = '15px';
        this.contentContainer.style.flex = '1';
        this.contentContainer.style.overflowY = 'auto';
        this.contentContainer.style.overflowX = 'hidden';
        this.contentContainer.style.boxSizing = 'border-box';
        this.contentContainer.style.minHeight = '0'; // Allow flex shrinking
        
        // Settings header (for back face)
        this.settingsHeader = document.createElement('div');
        this.settingsHeader.className = 'module-drag-handle';
        this.settingsHeader.style.position = 'relative';
        this.settingsHeader.style.width = '100%';
        this.settingsHeader.style.height = '24px';
        this.settingsHeader.style.minHeight = '24px';
        this.settingsHeader.style.background = 'rgba(0, 255, 136, 0.1)';
        this.settingsHeader.style.borderBottom = '1px solid rgba(0, 255, 136, 0.3)';
        this.settingsHeader.style.cursor = 'grab';
        this.settingsHeader.style.display = 'flex';
        this.settingsHeader.style.alignItems = 'center';
        this.settingsHeader.style.justifyContent = 'center';
        this.settingsHeader.style.fontFamily = 'monospace';
        this.settingsHeader.style.fontSize = '12px';
        this.settingsHeader.style.color = 'rgba(0, 255, 136, 0.6)';
        this.settingsHeader.style.flexShrink = '0';
        this.settingsHeader.textContent = '⋮⋮⋮ ' + this.title + ' - Settings';
        
        // Close icon for settings (top-right of back face)
        this.closeIcon = document.createElement('div');
        this.closeIcon.className = 'module-close-icon';
        this.closeIcon.style.position = 'absolute';
        this.closeIcon.style.top = '4px';
        this.closeIcon.style.right = '8px';
        this.closeIcon.style.width = '16px';
        this.closeIcon.style.height = '16px';
        this.closeIcon.style.cursor = 'pointer';
        this.closeIcon.style.color = '#00ff88';
        this.closeIcon.style.fontSize = '14px';
        this.closeIcon.style.display = 'flex';
        this.closeIcon.style.alignItems = 'center';
        this.closeIcon.style.justifyContent = 'center';
        this.closeIcon.textContent = '×';
        this.closeIcon.title = 'Close settings';
        this.settingsHeader.appendChild(this.closeIcon);
        
        // Settings container
        this.settingsContainer = document.createElement('div');
        this.settingsContainer.className = 'module-settings';
        this.settingsContainer.style.padding = '15px';
        this.settingsContainer.style.flex = '1';
        this.settingsContainer.style.overflowY = 'auto';
        this.settingsContainer.style.overflowX = 'hidden';
        this.settingsContainer.style.boxSizing = 'border-box';
        this.settingsContainer.style.color = '#ccc';
        this.settingsContainer.style.fontSize = '12px';
        this.settingsContainer.style.fontFamily = 'monospace';
        
        // Default settings content
        const emptyMessage = document.createElement('div');
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.marginTop = '20px';
        emptyMessage.style.opacity = '0.5';
        emptyMessage.textContent = 'No settings available';
        this.settingsContainer.appendChild(emptyMessage);
        
        // Assemble front face
        this.frontFace.appendChild(this.dragHandle);
        this.frontFace.appendChild(this.contentContainer);
        
        // Assemble back face
        this.backFace.appendChild(this.settingsHeader);
        this.backFace.appendChild(this.settingsContainer);
        
        // Assemble card
        this.cardWrapper.appendChild(this.frontFace);
        this.cardWrapper.appendChild(this.backFace);
        this.container.appendChild(this.cardWrapper);
        
        if (this.resizable && this.resizeHandle) {
            this.container.appendChild(this.resizeHandle);
        }
    }
    
    setupEventListeners() {
        // Increase header opacity on hover
        this.container.addEventListener('mouseenter', () => {
            this.dragHandle.style.background = 'rgba(0, 255, 136, 0.2)';
            this.dragHandle.style.borderBottom = '1px solid #00ff88';
            this.dragHandle.style.color = '#00ff88';
            this.settingsIcon.style.display = 'flex';
            this.settingsIcon.style.color = '#00ff88';
            if (this.resizable && this.resizeHandle) {
                this.resizeHandle.style.display = 'block';
            }
            this.container.style.borderColor = '#00ff88';
        });
        
        this.container.addEventListener('mouseleave', () => {
            if (!this.isDragging && !this.isResizing) {
                this.dragHandle.style.background = 'rgba(0, 255, 136, 0.1)';
                this.dragHandle.style.borderBottom = '1px solid rgba(0, 255, 136, 0.3)';
                this.dragHandle.style.color = 'rgba(0, 255, 136, 0.6)';
                this.settingsIcon.style.display = 'none';
                if (this.resizable && this.resizeHandle) {
                    this.resizeHandle.style.display = 'none';
                }
                this.container.style.borderColor = '#333';
            }
        });
        
        // Settings icon click - flip to back
        this.settingsIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.flipToSettings();
        });
        
        // Close icon click - flip to front
        this.closeIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.flipToFront();
        });
        
        // Drag functionality (works on both front and back headers)
        const setupDragForHeader = (header) => {
            header.addEventListener('mousedown', (e) => {
                // Don't drag if clicking on settings or close icon
                if (e.target === this.settingsIcon || e.target === this.closeIcon) {
                    return;
                }
                this.isDragging = true;
                
                // Convert screen coords to canvas space for accurate offset
                const canvasPos = ModuleRegistry.screenToCanvas(e.clientX, e.clientY);
                this.dragOffset.x = canvasPos.x - this.position.x;
                this.dragOffset.y = canvasPos.y - this.position.y;
                
                header.style.cursor = 'grabbing';
                e.preventDefault();
            });
        };
        
        setupDragForHeader(this.dragHandle);
        setupDragForHeader(this.settingsHeader);
        
        // Resize functionality - only if resizable
        if (this.resizable && this.resizeHandle) {
            this.resizeHandle.addEventListener('mousedown', (e) => {
                this.isResizing = true;
                this.resizeStart.x = e.clientX;
                this.resizeStart.y = e.clientY;
                this.resizeStart.width = this.container.offsetWidth;
                this.resizeStart.height = this.container.offsetHeight;
                e.preventDefault();
            });
        }
        
        // Global mouse handlers
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                // Convert screen coordinates to canvas space
                const canvasPos = ModuleRegistry.screenToCanvas(e.clientX, e.clientY);
                
                // Calculate new position in canvas space
                this.position.x = canvasPos.x - this.dragOffset.x;
                this.position.y = canvasPos.y - this.dragOffset.y;
                
                this.container.style.left = `${this.position.x}px`;
                this.container.style.top = `${this.position.y}px`;
                
                // Check proximity to window borders
                this.checkBorderProximity();
                
                // Check proximity to other modules
                this.checkProximity();
            }
            
            if (this.isResizing) {
                const deltaX = e.clientX - this.resizeStart.x;
                const deltaY = e.clientY - this.resizeStart.y;
                
                const newWidth = Math.max(150, this.resizeStart.width + deltaX);
                const newHeight = Math.max(100, this.resizeStart.height + deltaY);
                
                this.size.width = newWidth;
                this.size.height = newHeight;
                
                this.container.style.width = `${this.size.width}px`;
                this.container.style.height = `${this.size.height}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDragging || this.isResizing) {
                this.saveState();
            }
            
            if (this.isDragging) {
                this.isDragging = false;
                this.dragHandle.style.cursor = 'grab';
                // Reset all module borders
                this.resetBorder();
                ModuleRegistry.getAllExcept(this).forEach(module => {
                    module.resetBorder();
                });
            }
            
            if (this.isResizing) {
                this.isResizing = false;
            }
        });
    }
    
    getBounds() {
        return {
            left: this.position.x,
            right: this.position.x + this.size.width,
            top: this.position.y,
            bottom: this.position.y + this.size.height,
            width: this.size.width,
            height: this.size.height
        };
    }
    
    checkBorderProximity() {
        const bounds = this.getBounds();
        const borderMargin = ModuleRegistry.getBorderMargin();
        const warningDistance = ModuleRegistry.getBorderWarningDistance();
        
        // Calculate distances to viewport edges (for visual warning only)
        const distToLeft = bounds.left - borderMargin;
        const distToTop = bounds.top - borderMargin;
        const distToRight = (window.innerWidth - borderMargin) - bounds.right;
        const distToBottom = (window.innerHeight - borderMargin) - bounds.bottom;
        
        // Determine which edges are in proximity (visual feedback only)
        const edges = {
            left: distToLeft >= 0 && distToLeft <= warningDistance,
            top: distToTop >= 0 && distToTop <= warningDistance,
            right: distToRight >= 0 && distToRight <= warningDistance,
            bottom: distToBottom >= 0 && distToBottom <= warningDistance
        };
        
        const hasAnyProximity = edges.left || edges.top || edges.right || edges.bottom;
        
        if (hasAnyProximity) {
            // Calculate intensity for each edge
            const intensities = {
                left: edges.left ? Math.max(0, Math.min(1, distToLeft / warningDistance)) : 1,
                top: edges.top ? Math.max(0, Math.min(1, distToTop / warningDistance)) : 1,
                right: edges.right ? Math.max(0, Math.min(1, distToRight / warningDistance)) : 1,
                bottom: edges.bottom ? Math.max(0, Math.min(1, distToBottom / warningDistance)) : 1
            };
            
            this.highlightBorderWarning(edges, intensities);
        } else {
            // Only reset if not in proximity to other modules
            if (!this.hasModuleProximity) {
                this.resetBorder();
            }
        }
    }
    
    getDistanceToModule(otherModule) {
        const myBounds = this.getBounds();
        const otherBounds = otherModule.getBounds();
        
        // Calculate minimum distance between rectangles
        const dx = Math.max(
            myBounds.left - otherBounds.right,
            otherBounds.left - myBounds.right,
            0
        );
        const dy = Math.max(
            myBounds.top - otherBounds.bottom,
            otherBounds.top - myBounds.bottom,
            0
        );
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    checkProximity() {
        const otherModules = ModuleRegistry.getAllExcept(this);
        let hasProximity = false;
        
        otherModules.forEach(otherModule => {
            const distance = this.getDistanceToModule(otherModule);
            
            if (distance < this.proximityThreshold) {
                hasProximity = true;
                // Increase border luminosity on both modules
                this.highlightBorder();
                otherModule.highlightBorder();
                
                // Apply repulsion to the other module
                this.repelModule(otherModule);
            } else {
                otherModule.resetBorder();
            }
        });
        
        this.hasModuleProximity = hasProximity;
        
        if (!hasProximity) {
            // Don't reset here - let border proximity handle it
        }
    }
    
    repelModule(otherModule) {
        const myBounds = this.getBounds();
        const otherBounds = otherModule.getBounds();
        
        // Calculate repulsion direction
        const myCenterX = myBounds.left + myBounds.width / 2;
        const myCenterY = myBounds.top + myBounds.height / 2;
        const otherCenterX = otherBounds.left + otherBounds.width / 2;
        const otherCenterY = otherBounds.top + otherBounds.height / 2;
        
        const dx = otherCenterX - myCenterX;
        const dy = otherCenterY - myCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Normalize and apply repulsion force
            const force = this.repulsionForce;
            const repelX = (dx / distance) * force;
            const repelY = (dy / distance) * force;
            
            // Update other module's position (no boundary constraints)
            const newX = otherModule.position.x + repelX;
            const newY = otherModule.position.y + repelY;
            
            otherModule.position.x = newX;
            otherModule.position.y = newY;
            
            otherModule.container.style.left = `${otherModule.position.x}px`;
            otherModule.container.style.top = `${otherModule.position.y}px`;
            
            // Save the repelled module's new position
            otherModule.saveState();
        }
    }
    
    highlightBorder() {
        this.container.style.border = '2px solid #00ff88';
        this.container.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.6)';
    }
    
    highlightBorderWarning(edges, intensities) {
        // edges: {left, top, right, bottom} - boolean for each edge in proximity
        // intensities: {left, top, right, bottom} - 0 (at border) to 1 (at warning distance)
        
        // Build border-color with individual edge colors
        const getBorderColor = (edge) => {
            if (!edges[edge]) {
                return '#333'; // Default color for non-proximity edges
            }
            const glowIntensity = 1 - intensities[edge];
            const opacity = 0.5 + glowIntensity * 0.5;
            return `rgba(255, 0, 0, ${opacity})`;
        };
        
        // Build border-width with individual edge widths
        const getBorderWidth = (edge) => {
            if (!edges[edge]) {
                return '1px';
            }
            const glowIntensity = 1 - intensities[edge];
            const width = 1 + glowIntensity;
            return `${width}px`;
        };
        
        // Apply individual border styles for each edge
        this.container.style.borderTopColor = getBorderColor('top');
        this.container.style.borderRightColor = getBorderColor('right');
        this.container.style.borderBottomColor = getBorderColor('bottom');
        this.container.style.borderLeftColor = getBorderColor('left');
        
        this.container.style.borderTopWidth = getBorderWidth('top');
        this.container.style.borderRightWidth = getBorderWidth('right');
        this.container.style.borderBottomWidth = getBorderWidth('bottom');
        this.container.style.borderLeftWidth = getBorderWidth('left');
        
        this.container.style.borderStyle = 'solid';
        
        // Build box-shadow for glowing edges
        const shadows = [];
        if (edges.left) {
            const glowIntensity = 1 - intensities.left;
            const spread = glowIntensity * 10;
            const opacity = 0.3 + (glowIntensity * 0.5);
            shadows.push(`-${spread}px 0 ${spread}px rgba(255, 0, 0, ${opacity})`);
        }
        if (edges.right) {
            const glowIntensity = 1 - intensities.right;
            const spread = glowIntensity * 10;
            const opacity = 0.3 + (glowIntensity * 0.5);
            shadows.push(`${spread}px 0 ${spread}px rgba(255, 0, 0, ${opacity})`);
        }
        if (edges.top) {
            const glowIntensity = 1 - intensities.top;
            const spread = glowIntensity * 10;
            const opacity = 0.3 + (glowIntensity * 0.5);
            shadows.push(`0 -${spread}px ${spread}px rgba(255, 0, 0, ${opacity})`);
        }
        if (edges.bottom) {
            const glowIntensity = 1 - intensities.bottom;
            const spread = glowIntensity * 10;
            const opacity = 0.3 + (glowIntensity * 0.5);
            shadows.push(`0 ${spread}px ${spread}px rgba(255, 0, 0, ${opacity})`);
        }
        
        this.container.style.boxShadow = shadows.length > 0 ? shadows.join(', ') : 'none';
    }
    
    resetBorder() {
        this.container.style.border = '1px solid #333';
        this.container.style.borderStyle = 'solid';
        this.container.style.borderTopColor = '#333';
        this.container.style.borderRightColor = '#333';
        this.container.style.borderBottomColor = '#333';
        this.container.style.borderLeftColor = '#333';
        this.container.style.borderTopWidth = '1px';
        this.container.style.borderRightWidth = '1px';
        this.container.style.borderBottomWidth = '1px';
        this.container.style.borderLeftWidth = '1px';
        this.container.style.boxShadow = 'none';
    }
    
    setContent(element) {
        this.contentContainer.innerHTML = '';
        this.contentContainer.appendChild(element);
    }
    
    setContentNoPadding(element) {
        this.contentContainer.innerHTML = '';
        this.contentContainer.style.padding = '0';
        this.contentContainer.style.margin = '0';
        this.contentContainer.style.overflow = 'hidden'; // No scrollbars
        this.contentContainer.style.display = 'flex'; // Use flex to fill space
        this.contentContainer.style.flexDirection = 'column';
        this.contentContainer.appendChild(element);
    }
    
    appendToBody() {
        document.body.appendChild(this.container);
    }
    
    appendTo(containerElement) {
        containerElement.appendChild(this.container);
    }
    
    // Bounds enforcement removed for infinite canvas
    
    saveState() {
        const state = {
            position: this.position,
            size: this.size
        };
        localStorage.setItem(`module_${this.id}`, JSON.stringify(state));
    }
    
    loadState() {
        const saved = localStorage.getItem(`module_${this.id}`);
        return saved ? JSON.parse(saved) : null;
    }
    
    show() {
        this.container.style.display = 'flex';  // Use flex, not block
    }
    
    hide() {
        this.container.style.display = 'none';
    }
    
    flipToSettings() {
        this.cardWrapper.style.transform = 'rotateY(180deg)';
        this.isFlipped = true;
    }
    
    flipToFront() {
        this.cardWrapper.style.transform = 'rotateY(0deg)';
        this.isFlipped = false;
    }
    
    destroy() {
        // Unregister from module registry
        ModuleRegistry.unregister(this);
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// No bounds enforcement needed for infinite canvas
