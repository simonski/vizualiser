// viz_scenes.js - Year in Review Visualization with Scene Support
(async function() {
    'use strict';

    // Load configuration
    const config = await fetch('config.json').then(r => r.json());
    
    // Parse CSV and extract label from header
    async function loadCSV(filepath) {
        const response = await fetch(filepath);
        const text = await response.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        
        // Second column header is the label
        const label = headers[1] ? headers[1].trim() : 'Data';
        
        const data = lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, i) => {
                obj[header.trim()] = values[i].trim();
            });
            return obj;
        });
        
        return { data, label };
    }

    // Scene class - encapsulates a visualization scene with one or more graphs
    class Scene {
        constructor(sceneConfig, threeScene, camera, config) {
            this.name = sceneConfig.name;
            this.title = sceneConfig.title;
            this.graphs = [];
            this.threeScene = threeScene;
            this.camera = camera;
            this.config = config;
            this.sceneConfig = sceneConfig;
            this.threeObjects = new THREE.Group();
            this.threeScene.add(this.threeObjects);
        }

        async init() {
            // Load data for all graphs in this scene
            for (const graphConfig of this.sceneConfig.graphs) {
                const graph = await this.createGraph(graphConfig);
                this.graphs.push(graph);
            }
        }

        async createGraph(graphConfig) {
            // Load data sources
            const dataSets = await Promise.all(
                (graphConfig.dataSources || []).map(async source => {
                    const { data, label } = await loadCSV(source.file);
                    return { ...source, data, label };
                })
            );
            
            // Load events
            let eventSources = [];
            if (graphConfig.events && Array.isArray(graphConfig.events)) {
                eventSources = await Promise.all(
                    graphConfig.events.map(async eventConfig => {
                        const { data } = await loadCSV(eventConfig.file);
                        const events = data.map(row => {
                            const dayIndex = Math.floor((new Date(row.date) - new Date(this.config.animation.startDate)) / (1000 * 60 * 60 * 24));
                            return {
                                date: row.date,
                                event: row.event,
                                dayIndex: dayIndex,
                                targetHeight: 0.5 + Math.random() * 0.5,
                                color: eventConfig.color
                            };
                        });
                        return { ...eventConfig, events };
                    })
                );
            }

            return {
                name: graphConfig.name,
                position: graphConfig.position,
                dataSets,
                eventSources,
                chartWidth: graphConfig.position.width,
                chartHeight: graphConfig.position.height,
                globalMaxValue: Math.max(...dataSets.map(ds => 
                    Math.max(...ds.data.map(d => parseFloat(d[Object.keys(d)[1]])))
                ))
            };
        }

        activate() {
            this.threeObjects.visible = true;
        }

        deactivate() {
            this.threeObjects.visible = false;
        }

        updateLegend(legendContainer) {
            legendContainer.innerHTML = '';
            
            // Add title
            const title = document.createElement('div');
            title.style.fontSize = '20px';
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '10px';
            title.textContent = this.title;
            legendContainer.appendChild(title);
            
            // Add metrics legends from all graphs
            this.graphs.forEach(graph => {
                graph.dataSets.forEach(dataSource => {
                    const item = document.createElement('div');
                    item.className = 'legend-item';
                    
                    const colorBox = document.createElement('div');
                    colorBox.className = 'legend-color';
                    colorBox.style.backgroundColor = dataSource.color;
                    
                    const labelText = document.createElement('div');
                    labelText.className = 'legend-label';
                    labelText.textContent = dataSource.label;
                    
                    item.appendChild(colorBox);
                    item.appendChild(labelText);
                    legendContainer.appendChild(item);
                });
                
                // Add events to legend
                if (graph.eventSources.length > 0) {
                    const spacer = document.createElement('div');
                    spacer.style.height = '20px';
                    legendContainer.appendChild(spacer);
                    
                    graph.eventSources.forEach(eventSource => {
                        const item = document.createElement('div');
                        item.className = 'legend-item';
                        
                        const colorBox = document.createElement('div');
                        colorBox.className = 'legend-color';
                        colorBox.style.backgroundColor = eventSource.color;
                        
                        const labelText = document.createElement('div');
                        labelText.className = 'legend-label';
                        labelText.textContent = eventSource.label;
                        
                        item.appendChild(colorBox);
                        item.appendChild(labelText);
                        legendContainer.appendChild(item);
                    });
                }
            });
        }

        render(exactDay, totalDays) {
            // Clear previous frame
            while(this.threeObjects.children.length > 0) {
                this.threeObjects.remove(this.threeObjects.children[0]);
            }
            
            // Render each graph
            this.graphs.forEach(graph => {
                const graphGroup = new THREE.Group();
                graphGroup.position.set(graph.position.x, graph.position.y, 0);
                
                // Add axes
                graphGroup.add(this.createAxes(graph));
                
                // Add data lines
                graph.dataSets.forEach(dataSource => {
                    const line = this.createAnimatedLine(dataSource, exactDay, graph);
                    graphGroup.add(line);
                });
                
                // Add events
                if (graph.eventSources.length > 0) {
                    const events = this.createEventMarkers(graph.eventSources, exactDay, totalDays, graph);
                    graphGroup.add(events);
                }
                
                this.threeObjects.add(graphGroup);
            });
        }

        createAnimatedLine(dataSource, exactDay, graph) {
            const { data, color } = dataSource;
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineBasicMaterial({ 
                color: color || '#00ff88',
                linewidth: 2
            });
            
            const points = [];
            const currentDay = Math.floor(exactDay);
            const dayFraction = exactDay - currentDay;
            
            const visibleData = data.slice(0, currentDay + 1);
            
            visibleData.forEach((point, i) => {
                const x = (i / data.length) * graph.chartWidth - graph.chartWidth / 2;
                const value = parseFloat(point[Object.keys(point)[1]]);
                const y = (value / graph.globalMaxValue) * graph.chartHeight - graph.chartHeight / 2;
                points.push(new THREE.Vector3(x, y, 0));
            });
            
            if (dayFraction > 0 && currentDay < data.length - 1) {
                const currentValue = parseFloat(data[currentDay][Object.keys(data[currentDay])[1]]);
                const nextValue = parseFloat(data[currentDay + 1][Object.keys(data[currentDay + 1])[1]]);
                const interpolatedValue = currentValue + (nextValue - currentValue) * dayFraction;
                
                const x = ((currentDay + dayFraction) / data.length) * graph.chartWidth - graph.chartWidth / 2;
                const y = (interpolatedValue / graph.globalMaxValue) * graph.chartHeight - graph.chartHeight / 2;
                points.push(new THREE.Vector3(x, y, 0));
            }
            
            geometry.setFromPoints(points);
            return new THREE.Line(geometry, material);
        }

        createAxes(graph) {
            const axesGroup = new THREE.Group();
            const axisMaterial = new THREE.LineBasicMaterial({ color: 0x444444 });
            
            // X axis
            const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-graph.chartWidth / 2, -graph.chartHeight / 2, 0),
                new THREE.Vector3(graph.chartWidth / 2, -graph.chartHeight / 2, 0)
            ]);
            axesGroup.add(new THREE.Line(xAxisGeometry, axisMaterial));
            
            // Y axis
            const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-graph.chartWidth / 2, -graph.chartHeight / 2, 0),
                new THREE.Vector3(-graph.chartWidth / 2, graph.chartHeight / 2, 0)
            ]);
            axesGroup.add(new THREE.Line(yAxisGeometry, axisMaterial));
            
            // Add month labels
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthStarts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
            const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            
            months.forEach((month, i) => {
                const monthMidpoint = monthStarts[i] + monthLengths[i] / 2;
                const x = (monthMidpoint / 365) * graph.chartWidth - graph.chartWidth / 2;
                const y = -graph.chartHeight / 2 - 3;
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 128;
                canvas.height = 64;
                context.font = 'Bold 38px monospace';
                context.fillStyle = '#666666';
                context.textAlign = 'center';
                context.fillText(month, 64, 40);
                
                const texture = new THREE.CanvasTexture(canvas);
                const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.position.set(x, y, 0);
                sprite.scale.set(4, 2, 1);
                axesGroup.add(sprite);
            });
            
            return axesGroup;
        }

        createEventMarkers(eventSources, exactDay, totalDays, graph) {
            const group = new THREE.Group();
            const fadeInDays = 7;
            
            eventSources.forEach(eventSource => {
                eventSource.events.forEach(event => {
                    const daysUntilEvent = event.dayIndex - exactDay;
                    
                    if (daysUntilEvent > fadeInDays) return;
                    
                    let opacity = 1;
                    if (daysUntilEvent > 0) {
                        opacity = 1 - (daysUntilEvent / fadeInDays);
                    }
                    
                    let heightProgress = 1;
                    if (daysUntilEvent > 0) {
                        heightProgress = 1 - (daysUntilEvent / fadeInDays);
                    }
                    
                    const x = (event.dayIndex / totalDays) * graph.chartWidth - graph.chartWidth / 2;
                    const lineHeight = graph.chartHeight * event.targetHeight * heightProgress;
                    const yTop = lineHeight - graph.chartHeight / 2;
                    
                    // Vertical line
                    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(x, -graph.chartHeight / 2, 0),
                        new THREE.Vector3(x, yTop, 0)
                    ]);
                    const lineMaterial = new THREE.LineBasicMaterial({ 
                        color: event.color,
                        transparent: true,
                        opacity: opacity
                    });
                    group.add(new THREE.Line(lineGeometry, lineMaterial));
                    
                    // Circle
                    const circleGeometry = new THREE.CircleGeometry(0.5, 16);
                    const circleMaterial = new THREE.MeshBasicMaterial({ 
                        color: event.color,
                        transparent: true,
                        opacity: opacity
                    });
                    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
                    circle.position.set(x, yTop, 0);
                    group.add(circle);
                    
                    // Text label
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = 256;
                    canvas.height = 64;
                    context.font = 'Bold 48px monospace';
                    context.fillStyle = event.color;
                    context.globalAlpha = opacity;
                    context.textAlign = 'center';
                    context.fillText(event.event, 128, 40);
                    
                    const texture = new THREE.CanvasTexture(canvas);
                    const spriteMaterial = new THREE.SpriteMaterial({ 
                        map: texture,
                        transparent: true,
                        opacity: opacity
                    });
                    const sprite = new THREE.Sprite(spriteMaterial);
                    sprite.position.set(x, yTop + 2, 0);
                    sprite.scale.set(8, 2, 1);
                    group.add(sprite);
                });
            });
            
            return group;
        }
    }

    // Setup Three.js
    const canvas = document.getElementById('viz-canvas');
    const threeScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = 50;
    
    // Mouse tracking for starfield parallax
    const mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Create starfield
    function createStarfield() {
        const starfield = new THREE.Group();
        const starfieldConfig = config.starfield || {};
        
        if (starfieldConfig.enabled === false) {
            return starfield;
        }
        
        const atomCount = starfieldConfig.atomCount || 200;
        const minRadius = starfieldConfig.minRadius || 0.05;
        const maxRadius = starfieldConfig.maxRadius || 0.3;
        const minOpacity = starfieldConfig.minOpacity || 0.1;
        const maxOpacity = starfieldConfig.maxOpacity || 0.6;
        
        for (let i = 0; i < atomCount; i++) {
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            const geometry = new THREE.SphereGeometry(radius, 8, 8);
            const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: opacity
            });
            const atom = new THREE.Mesh(geometry, material);
            
            atom.position.x = (Math.random() - 0.5) * 150;
            atom.position.y = (Math.random() - 0.5) * 100;
            atom.position.z = (Math.random() - 0.5) * 100 - 20;
            
            atom.userData.originalPosition = atom.position.clone();
            starfield.add(atom);
        }
        
        return starfield;
    }
    
    const starfield = createStarfield();
    threeScene.add(starfield);

    // Initialize all scenes
    const scenes = [];
    for (const sceneConfig of config.scenes) {
        const scene = new Scene(sceneConfig, threeScene, camera, config);
        await scene.init();
        scenes.push(scene);
    }

    // Scene management
    let currentSceneIndex = 0;
    let currentScene = scenes[currentSceneIndex];
    
    // Activate first scene
    scenes.forEach((s, i) => {
        if (i === currentSceneIndex) {
            s.activate();
        } else {
            s.deactivate();
        }
    });

    // UI Elements
    const dateDisplay = document.getElementById('date-display');
    const legendContainer = document.getElementById('legend');
    
    // Update legend for current scene
    currentScene.updateLegend(legendContainer);
    
    // Scene navigation UI
    if (scenes.length > 1) {
        const sceneNav = document.createElement('div');
        sceneNav.id = 'scene-nav';
        sceneNav.style.position = 'absolute';
        sceneNav.style.bottom = '20px';
        sceneNav.style.left = '50%';
        sceneNav.style.transform = 'translateX(-50%)';
        sceneNav.style.display = 'flex';
        sceneNav.style.gap = '10px';
        
        scenes.forEach((scene, index) => {
            const btn = document.createElement('button');
            btn.textContent = scene.title;
            btn.style.padding = '10px 20px';
            btn.style.backgroundColor = index === currentSceneIndex ? '#00ff88' : '#333';
            btn.style.color = index === currentSceneIndex ? '#000' : '#fff';
            btn.style.border = 'none';
            btn.style.cursor = 'pointer';
            btn.style.fontFamily = 'monospace';
            btn.style.fontSize = '14px';
            btn.onclick = () => switchScene(index);
            sceneNav.appendChild(btn);
        });
        
        document.body.appendChild(sceneNav);
    }

    function switchScene(index) {
        if (index === currentSceneIndex) return;
        
        // Deactivate current scene
        currentScene.deactivate();
        
        // Activate new scene
        currentSceneIndex = index;
        currentScene = scenes[currentSceneIndex];
        currentScene.activate();
        currentScene.updateLegend(legendContainer);
        
        // Update nav buttons
        const navButtons = document.querySelectorAll('#scene-nav button');
        navButtons.forEach((btn, i) => {
            btn.style.backgroundColor = i === currentSceneIndex ? '#00ff88' : '#333';
            btn.style.color = i === currentSceneIndex ? '#000' : '#fff';
        });
        
        // Reset animation
        animationStartTime = Date.now();
    }

    // Animation state
    const startDate = new Date(config.animation.startDate);
    const endDate = new Date(config.animation.endDate);
    const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const totalDuration = config.animation.totalDurationSeconds || 60;
    const millisecondsPerDay = (totalDuration * 1000) / totalDays;
    
    let currentDay = 0;
    let animationStartTime = Date.now();
    let lastFrameTime = Date.now();
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    // Main animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        const now = Date.now();
        const deltaTime = now - lastFrameTime;
        
        if (deltaTime < frameInterval) {
            return;
        }
        lastFrameTime = now - (deltaTime % frameInterval);
        
        // Update starfield parallax
        if (starfield && config.starfield?.enabled !== false) {
            starfield.children.forEach(atom => {
                const parallaxStrength = 0.5;
                atom.position.x = atom.userData.originalPosition.x + mouse.x * parallaxStrength;
                atom.position.y = atom.userData.originalPosition.y + mouse.y * parallaxStrength;
            });
        }

        const elapsedTime = now - animationStartTime;
        const exactDay = Math.min(elapsedTime / millisecondsPerDay, totalDays - 1);
        const calculatedDay = Math.floor(exactDay);

        if (calculatedDay !== currentDay && calculatedDay < totalDays) {
            currentDay = calculatedDay;
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + currentDay);
            dateDisplay.textContent = currentDate.toISOString().split('T')[0];
        }

        // Render current scene
        currentScene.render(exactDay, totalDays);

        renderer.render(threeScene, camera);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Start animation
    animate();
})();
