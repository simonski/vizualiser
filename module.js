// module.js - Draggable and resizable UI modules

class Module {
    constructor(id, title, defaultPosition = { x: 20, y: 20 }, defaultSize = { width: 250, height: 200 }) {
        this.id = id;
        this.title = title;
        this.container = null;
        this.dragHandle = null;
        this.resizeHandle = null;
        this.contentContainer = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        
        // Load saved position/size or use defaults
        const saved = this.loadState();
        this.position = saved?.position || defaultPosition;
        this.size = saved?.size || defaultSize;
        
        this.createContainer();
        this.setupEventListeners();
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
        this.container.style.minHeight = `${this.size.height}px`;
        this.container.style.background = 'rgba(0, 0, 0, 0.7)';
        this.container.style.border = '1px solid #333';
        this.container.style.borderRadius = '5px';
        this.container.style.zIndex = '10';
        this.container.style.overflow = 'hidden';
        this.container.style.transition = 'border-color 0.2s';
        
        // Drag handle (appears on hover at top)
        this.dragHandle = document.createElement('div');
        this.dragHandle.className = 'module-drag-handle';
        this.dragHandle.style.position = 'absolute';
        this.dragHandle.style.top = '0';
        this.dragHandle.style.left = '0';
        this.dragHandle.style.right = '0';
        this.dragHandle.style.height = '24px';
        this.dragHandle.style.background = 'rgba(0, 255, 136, 0.2)';
        this.dragHandle.style.borderBottom = '1px solid #00ff88';
        this.dragHandle.style.cursor = 'grab';
        this.dragHandle.style.display = 'none';
        this.dragHandle.style.alignItems = 'center';
        this.dragHandle.style.justifyContent = 'center';
        this.dragHandle.style.fontFamily = 'monospace';
        this.dragHandle.style.fontSize = '12px';
        this.dragHandle.style.color = '#00ff88';
        this.dragHandle.textContent = '⋮⋮⋮ ' + this.title;
        
        // Resize handle (appears on hover at bottom-right)
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
        
        // Content container
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'module-content';
        this.contentContainer.style.padding = '15px';
        this.contentContainer.style.height = '100%';
        this.contentContainer.style.overflowY = 'auto';
        
        this.container.appendChild(this.dragHandle);
        this.container.appendChild(this.contentContainer);
        this.container.appendChild(this.resizeHandle);
    }
    
    setupEventListeners() {
        // Show drag/resize handles on hover
        this.container.addEventListener('mouseenter', () => {
            this.dragHandle.style.display = 'flex';
            this.resizeHandle.style.display = 'block';
            this.container.style.borderColor = '#00ff88';
        });
        
        this.container.addEventListener('mouseleave', () => {
            if (!this.isDragging && !this.isResizing) {
                this.dragHandle.style.display = 'none';
                this.resizeHandle.style.display = 'none';
                this.container.style.borderColor = '#333';
            }
        });
        
        // Drag functionality
        this.dragHandle.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragOffset.x = e.clientX - this.container.offsetLeft;
            this.dragOffset.y = e.clientY - this.container.offsetTop;
            this.dragHandle.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        // Resize functionality
        this.resizeHandle.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            this.resizeStart.x = e.clientX;
            this.resizeStart.y = e.clientY;
            this.resizeStart.width = this.container.offsetWidth;
            this.resizeStart.height = this.container.offsetHeight;
            e.preventDefault();
        });
        
        // Global mouse handlers
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const newX = e.clientX - this.dragOffset.x;
                const newY = e.clientY - this.dragOffset.y;
                
                // Boundary constraints
                const maxX = window.innerWidth - this.container.offsetWidth;
                const maxY = window.innerHeight - this.container.offsetHeight;
                
                this.position.x = Math.max(0, Math.min(maxX, newX));
                this.position.y = Math.max(0, Math.min(maxY, newY));
                
                this.container.style.left = `${this.position.x}px`;
                this.container.style.top = `${this.position.y}px`;
            }
            
            if (this.isResizing) {
                const deltaX = e.clientX - this.resizeStart.x;
                const deltaY = e.clientY - this.resizeStart.y;
                
                const newWidth = Math.max(150, this.resizeStart.width + deltaX);
                const newHeight = Math.max(100, this.resizeStart.height + deltaY);
                
                this.size.width = newWidth;
                this.size.height = newHeight;
                
                this.container.style.width = `${newWidth}px`;
                this.container.style.minHeight = `${newHeight}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDragging || this.isResizing) {
                this.saveState();
            }
            
            if (this.isDragging) {
                this.isDragging = false;
                this.dragHandle.style.cursor = 'grab';
            }
            
            if (this.isResizing) {
                this.isResizing = false;
            }
        });
    }
    
    setContent(element) {
        this.contentContainer.innerHTML = '';
        this.contentContainer.appendChild(element);
    }
    
    appendToBody() {
        document.body.appendChild(this.container);
    }
    
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
        this.container.style.display = 'block';
    }
    
    hide() {
        this.container.style.display = 'none';
    }
    
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
