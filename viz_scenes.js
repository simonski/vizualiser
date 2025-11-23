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
            this.lastRenderedDay = -1;
            this.graphObjects = new Map(); // Cache for reusable Three.js objects
        }

        async init() {
            // Load data for all graphs in this scene
            for (const graphConfig of this.sceneConfig.graphs) {
                const graph = await this.createGraph(graphConfig);
                this.graphs.push(graph);
            }
            
            // Pre-create static objects that don't change
            this.createStaticObjects();
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
                title: graphConfig.title || graphConfig.name,
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

        createStaticObjects() {
            // Create static objects for each graph (titles, axes, bounding boxes)
            this.graphs.forEach(graph => {
                const graphGroup = new THREE.Group();
                graphGroup.userData.graphName = graph.name;
                graphGroup.userData.graphData = graph;
                
                // Load saved position or use config position
                const savedPos = loadGraphPosition(this.name, graph.name);
                if (savedPos) {
                    graphGroup.position.set(savedPos.x, savedPos.y, 0);
                    graph.position.x = savedPos.x;
                    graph.position.y = savedPos.y;
                } else {
                    graphGroup.position.set(graph.position.x, graph.position.y, 0);
                }
                
                // Add static elements
                graphGroup.add(this.createGraphTitle(graph));
                graphGroup.add(this.createAxes(graph));
                
                // Add invisible bounding box for raycasting
                const boundingGeometry = new THREE.PlaneGeometry(graph.chartWidth, graph.chartHeight);
                const boundingMaterial = new THREE.MeshBasicMaterial({ 
                    transparent: true, 
                    opacity: 0,
                    side: THREE.DoubleSide
                });
                const boundingMesh = new THREE.Mesh(boundingGeometry, boundingMaterial);
                boundingMesh.userData.isGraphBounds = true;
                graphGroup.add(boundingMesh);
                
                // Create reusable line geometries and materials
                graph.lineObjects = [];
                graph.dataSets.forEach(dataSource => {
                    const geometry = new THREE.BufferGeometry();
                    const maxPoints = dataSource.data.length + 1;
                    const positions = new Float32Array(maxPoints * 3);
                    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                    geometry.setDrawRange(0, 0); // Start with no points
                    
                    const material = new THREE.LineBasicMaterial({ 
                        color: dataSource.color || '#00ff88',
                        linewidth: 2
                    });
                    const line = new THREE.Line(geometry, material);
                    line.userData.dataSource = dataSource;
                    line.userData.label = dataSource.label;
                    graphGroup.add(line);
                    graph.lineObjects.push(line);
                });
                
                // Create event marker group (will be updated each frame)
                graph.eventGroup = new THREE.Group();
                graphGroup.add(graph.eventGroup);
                
                this.threeObjects.add(graphGroup);
                this.graphObjects.set(graph.name, graphGroup);
            });
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
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.gap = '8px';
                    
                    // Toggle button
                    const isVisible = loadMetricVisibility(this.name, dataSource.label);
                    const toggleBtn = document.createElement('button');
                    toggleBtn.textContent = isVisible ? '×' : '○';
                    toggleBtn.style.width = '9px';
                    toggleBtn.style.height = '9px';
                    toggleBtn.style.padding = '0';
                    toggleBtn.style.border = '1px solid #00ff88';
                    toggleBtn.style.backgroundColor = isVisible ? '#00ff88' : '#222';
                    toggleBtn.style.color = isVisible ? '#000' : '#00ff88';
                    toggleBtn.style.cursor = 'pointer';
                    toggleBtn.style.borderRadius = '2px';
                    toggleBtn.style.fontSize = '8px';
                    toggleBtn.style.lineHeight = '7px';
                    toggleBtn.style.fontWeight = 'bold';
                    toggleBtn.title = isVisible ? 'Hide metric' : 'Show metric';
                    
                    toggleBtn.onclick = () => {
                        const newVisibility = !loadMetricVisibility(this.name, dataSource.label);
                        saveMetricVisibility(this.name, dataSource.label, newVisibility);
                        toggleBtn.textContent = newVisibility ? '×' : '○';
                        toggleBtn.style.backgroundColor = newVisibility ? '#00ff88' : '#222';
                        toggleBtn.style.color = newVisibility ? '#000' : '#00ff88';
                        toggleBtn.title = newVisibility ? 'Hide metric' : 'Show metric';
                        needsRender = true;
                    };
                    
                    const colorBox = document.createElement('div');
                    colorBox.className = 'legend-color';
                    colorBox.style.backgroundColor = dataSource.color;
                    colorBox.style.opacity = isVisible ? '1' : '0.3';
                    
                    const labelText = document.createElement('div');
                    labelText.className = 'legend-label';
                    labelText.textContent = dataSource.label;
                    labelText.style.opacity = isVisible ? '1' : '0.5';
                    
                    item.appendChild(toggleBtn);
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
                        item.style.display = 'flex';
                        item.style.alignItems = 'center';
                        item.style.gap = '8px';
                        
                        // Toggle button
                        const isVisible = loadMetricVisibility(this.name, eventSource.label);
                        const toggleBtn = document.createElement('button');
                        toggleBtn.textContent = isVisible ? '×' : '○';
                        toggleBtn.style.width = '9px';
                        toggleBtn.style.height = '9px';
                        toggleBtn.style.padding = '0';
                        toggleBtn.style.border = '1px solid #00ff88';
                        toggleBtn.style.backgroundColor = isVisible ? '#00ff88' : '#222';
                        toggleBtn.style.color = isVisible ? '#000' : '#00ff88';
                        toggleBtn.style.cursor = 'pointer';
                        toggleBtn.style.borderRadius = '2px';
                        toggleBtn.style.fontSize = '8px';
                        toggleBtn.style.lineHeight = '7px';
                        toggleBtn.style.fontWeight = 'bold';
                        toggleBtn.title = isVisible ? 'Hide events' : 'Show events';
                        
                        toggleBtn.onclick = () => {
                            const newVisibility = !loadMetricVisibility(this.name, eventSource.label);
                            saveMetricVisibility(this.name, eventSource.label, newVisibility);
                            toggleBtn.textContent = newVisibility ? '×' : '○';
                            toggleBtn.style.backgroundColor = newVisibility ? '#00ff88' : '#222';
                            toggleBtn.style.color = newVisibility ? '#000' : '#00ff88';
                            toggleBtn.title = newVisibility ? 'Hide events' : 'Show events';
                            needsRender = true;
                        };
                        
                        const colorBox = document.createElement('div');
                        colorBox.className = 'legend-color';
                        colorBox.style.backgroundColor = eventSource.color;
                        colorBox.style.opacity = isVisible ? '1' : '0.3';
                        
                        const labelText = document.createElement('div');
                        labelText.className = 'legend-label';
                        labelText.textContent = eventSource.label;
                        labelText.style.opacity = isVisible ? '1' : '0.5';
                        
                        item.appendChild(toggleBtn);
                        item.appendChild(colorBox);
                        item.appendChild(labelText);
                        legendContainer.appendChild(item);
                    });
                }
            });
        }

        render(exactDay, totalDays) {
            // Update each graph's data lines
            this.graphs.forEach(graph => {
                const graphGroup = this.graphObjects.get(graph.name);
                if (!graphGroup) return;
                
                // Update line geometries with new data (every frame for smooth interpolation)
                graph.lineObjects.forEach(line => {
                    const dataSource = line.userData.dataSource;
                    const isVisible = loadMetricVisibility(this.name, dataSource.label);
                    line.visible = isVisible;
                    
                    if (!isVisible) return;
                    
                    this.updateLineGeometry(line, dataSource, exactDay, graph);
                });
                
                // Update events incrementally - add new ones as they appear
                const currentDay = Math.floor(exactDay);
                if (currentDay !== this.lastRenderedDay) {
                    this.updateEventMarkers(graph, exactDay, totalDays);
                }
                
                // Update chroma border during drag
                this.updateChromaBorder(graph, graphGroup);
            });
            
            this.lastRenderedDay = Math.floor(exactDay);
        }

        updateLineGeometry(line, dataSource, exactDay, graph) {
            const { data } = dataSource;
            const geometry = line.geometry;
            const positions = geometry.attributes.position.array;
            
            const currentDay = Math.floor(exactDay);
            const dayFraction = exactDay - currentDay;
            const visibleData = data.slice(0, currentDay + 1);
            
            let pointIndex = 0;
            visibleData.forEach((point, i) => {
                const x = (i / data.length) * graph.chartWidth - graph.chartWidth / 2;
                const value = parseFloat(point[Object.keys(point)[1]]);
                const y = (value / graph.globalMaxValue) * graph.chartHeight - graph.chartHeight / 2;
                
                positions[pointIndex * 3] = x;
                positions[pointIndex * 3 + 1] = y;
                positions[pointIndex * 3 + 2] = 0;
                pointIndex++;
            });
            
            // Interpolate the last point
            if (currentDay < data.length - 1 && dayFraction > 0) {
                const currentPoint = data[currentDay];
                const nextPoint = data[currentDay + 1];
                
                const currentValue = parseFloat(currentPoint[Object.keys(currentPoint)[1]]);
                const nextValue = parseFloat(nextPoint[Object.keys(nextPoint)[1]]);
                const interpolatedValue = currentValue + (nextValue - currentValue) * dayFraction;
                
                const x = ((currentDay + dayFraction) / data.length) * graph.chartWidth - graph.chartWidth / 2;
                const y = (interpolatedValue / graph.globalMaxValue) * graph.chartHeight - graph.chartHeight / 2;
                
                positions[pointIndex * 3] = x;
                positions[pointIndex * 3 + 1] = y;
                positions[pointIndex * 3 + 2] = 0;
                pointIndex++;
            }
            
            geometry.setDrawRange(0, pointIndex);
            geometry.attributes.position.needsUpdate = true;
        }
        
        updateEventMarkers(graph, exactDay, totalDays) {
            // Track which events have been rendered
            if (!graph.renderedEvents) {
                graph.renderedEvents = new Set();
            }
            
            // Filter visible event sources
            const visibleEventSources = graph.eventSources.filter(eventSource => 
                loadMetricVisibility(this.name, eventSource.label)
            );
            
            if (visibleEventSources.length === 0) return;
            
            // Only add NEW events that should be visible now
            const fadeInDays = 7;
            visibleEventSources.forEach(eventSource => {
                eventSource.events.forEach(event => {
                    const eventKey = `${eventSource.label}_${event.dayIndex}`;
                    
                    // Skip if already rendered
                    if (graph.renderedEvents.has(eventKey)) return;
                    
                    const daysUntilEvent = event.dayIndex - exactDay;
                    
                    // Only render events that are now visible (within fadeIn range)
                    if (daysUntilEvent <= fadeInDays && daysUntilEvent >= -1) {
                        graph.renderedEvents.add(eventKey);
                        this.addEventMarker(graph.eventGroup, event, eventSource, exactDay, totalDays, graph);
                    }
                });
            });
        }

        createGraphTitle(graph) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 64;
            context.font = 'Bold 32px monospace';
            context.fillStyle = '#00ff88';
            context.textAlign = 'center';
            context.fillText(graph.title, 256, 40);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(0, graph.chartHeight / 2 + 5, 0);
            sprite.scale.set(16, 2, 1);
            return sprite;
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

        addEventMarker(targetGroup, event, eventSource, exactDay, totalDays, graph) {
            const fadeInDays = 7;
            const daysUntilEvent = event.dayIndex - exactDay;
            
            let opacity = 1;
            if (daysUntilEvent > 0) {
                // Fading in (before event)
                opacity = 1 - (daysUntilEvent / fadeInDays);
            }
            opacity = Math.max(0, Math.min(1, opacity));
            
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
            targetGroup.add(new THREE.Line(lineGeometry, lineMaterial));
            
            // Circle
            const circleGeometry = new THREE.CircleGeometry(0.5, 16);
            const circleMaterial = new THREE.MeshBasicMaterial({ 
                color: event.color,
                transparent: true,
                opacity: opacity
            });
            const circle = new THREE.Mesh(circleGeometry, circleMaterial);
            circle.position.set(x, yTop, 0);
            targetGroup.add(circle);
            
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
            targetGroup.add(sprite);
        }
        
        updateChromaBorder(graph, graphGroup) {
            // Remove existing border if present
            if (graph.chromaBorder) {
                graphGroup.remove(graph.chromaBorder);
                graph.chromaBorder.geometry.dispose();
                graph.chromaBorder.material.dispose();
                graph.chromaBorder = null;
            }
            
            // Only show border when dragging
            if (!draggedGraph) return;
            
            const isDragged = draggedGraph === graphGroup;
            const proximityThreshold = 15; // Distance to show proximity effect
            
            let showBorder = isDragged;
            let borderColor = 0x00ff88;
            let borderOpacity = 0.8;
            
            // Check proximity to dragged graph
            if (!isDragged && draggedGraph) {
                const dx = Math.abs(graphGroup.position.x - draggedGraph.position.x);
                const dy = Math.abs(graphGroup.position.y - draggedGraph.position.y);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < proximityThreshold) {
                    showBorder = true;
                    borderColor = 0xff8800; // Orange for nearby graphs
                    borderOpacity = 0.5 + (1 - distance / proximityThreshold) * 0.3;
                }
            }
            
            if (!showBorder) return;
            
            // Create chroma border rectangle
            const borderGeometry = new THREE.BufferGeometry();
            const w2 = graph.chartWidth / 2;
            const h2 = graph.chartHeight / 2;
            
            const positions = new Float32Array([
                -w2, -h2, 0,  w2, -h2, 0,  // Bottom
                w2, -h2, 0,  w2, h2, 0,    // Right
                w2, h2, 0,  -w2, h2, 0,    // Top
                -w2, h2, 0,  -w2, -h2, 0   // Left
            ]);
            
            borderGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const borderMaterial = new THREE.LineBasicMaterial({
                color: borderColor,
                transparent: true,
                opacity: borderOpacity,
                linewidth: 3
            });
            
            graph.chromaBorder = new THREE.LineSegments(borderGeometry, borderMaterial);
            graphGroup.add(graph.chromaBorder);
        }
    }

    // Setup Three.js
    const canvas = document.getElementById('viz-canvas');
    const threeScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = 50;
    
    // Mouse tracking for starfield parallax and graph interaction
    const mouse = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    let hoveredGraph = null;
    let draggedGraph = null;
    let dragOffset = { x: 0, y: 0 };
    
    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Handle drag
        if (draggedGraph) {
            const worldPos = screenToWorld(event.clientX, event.clientY);
            draggedGraph.position.x = worldPos.x - dragOffset.x;
            draggedGraph.position.y = worldPos.y - dragOffset.y;
            needsRender = true;
        }
    });
    
    // Convert screen coordinates to world coordinates
    function screenToWorld(screenX, screenY) {
        const vector = new THREE.Vector3(
            (screenX / window.innerWidth) * 2 - 1,
            -(screenY / window.innerHeight) * 2 + 1,
            0.5
        );
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z;
        return camera.position.clone().add(dir.multiplyScalar(distance));
    }
    
    window.addEventListener('mousedown', (event) => {
        if (hoveredGraph) {
            draggedGraph = hoveredGraph;
            const worldPos = screenToWorld(event.clientX, event.clientY);
            dragOffset.x = worldPos.x - draggedGraph.position.x;
            dragOffset.y = worldPos.y - draggedGraph.position.y;
            canvas.style.cursor = 'grabbing';
        }
    });
    
    window.addEventListener('mouseup', () => {
        if (draggedGraph) {
            // Save position to localStorage
            saveGraphPosition(currentScene.name, draggedGraph.userData.graphName, {
                x: draggedGraph.position.x,
                y: draggedGraph.position.y
            });
            draggedGraph = null;
            canvas.style.cursor = hoveredGraph ? 'grab' : 'default';
            needsRender = true;
        }
    });
    
    // Position persistence functions
    function saveGraphPosition(sceneName, graphName, position) {
        const key = `graph_position_${sceneName}_${graphName}`;
        localStorage.setItem(key, JSON.stringify(position));
    }
    
    function loadGraphPosition(sceneName, graphName) {
        const key = `graph_position_${sceneName}_${graphName}`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    }
    
    // Visibility persistence functions
    function saveMetricVisibility(sceneName, metricLabel, isVisible) {
        const key = `metric_visibility_${sceneName}_${metricLabel}`;
        localStorage.setItem(key, JSON.stringify(isVisible));
    }
    
    function loadMetricVisibility(sceneName, metricLabel) {
        const key = `metric_visibility_${sceneName}_${metricLabel}`;
        const saved = localStorage.getItem(key);
        return saved !== null ? JSON.parse(saved) : true; // default: visible
    }

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
    
    // Scene navigation UI - dropdown selector near date
    if (scenes.length > 1) {
        const sceneSelector = document.createElement('select');
        sceneSelector.id = 'scene-selector';
        sceneSelector.style.position = 'absolute';
        sceneSelector.style.top = '50px';
        sceneSelector.style.left = '20px';
        sceneSelector.style.padding = '8px 12px';
        sceneSelector.style.backgroundColor = '#222';
        sceneSelector.style.color = '#00ff88';
        sceneSelector.style.border = '2px solid #00ff88';
        sceneSelector.style.borderRadius = '4px';
        sceneSelector.style.fontFamily = 'monospace';
        sceneSelector.style.fontSize = '14px';
        sceneSelector.style.cursor = 'pointer';
        sceneSelector.style.outline = 'none';
        
        scenes.forEach((scene, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = scene.title;
            option.selected = index === currentSceneIndex;
            sceneSelector.appendChild(option);
        });
        
        sceneSelector.onchange = (e) => switchScene(parseInt(e.target.value));
        
        document.body.appendChild(sceneSelector);
    }
    
    // Playback controls
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'playback-controls';
    controlsContainer.style.position = 'absolute';
    controlsContainer.style.top = '90px';
    controlsContainer.style.left = '20px';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.gap = '5px';
    
    const rewindBtn = document.createElement('button');
    rewindBtn.textContent = '⏮';
    rewindBtn.title = 'Rewind to start';
    styleControlButton(rewindBtn);
    rewindBtn.onclick = () => rewindAnimation();
    
    const playPauseBtn = document.createElement('button');
    playPauseBtn.id = 'play-pause-btn';
    playPauseBtn.textContent = '⏸';
    playPauseBtn.title = 'Pause/Play';
    styleControlButton(playPauseBtn);
    playPauseBtn.onclick = () => togglePlayPause();
    
    controlsContainer.appendChild(rewindBtn);
    controlsContainer.appendChild(playPauseBtn);
    document.body.appendChild(controlsContainer);
    
    function styleControlButton(btn) {
        btn.style.padding = '8px 12px';
        btn.style.backgroundColor = '#222';
        btn.style.color = '#00ff88';
        btn.style.border = '2px solid #00ff88';
        btn.style.borderRadius = '4px';
        btn.style.fontFamily = 'monospace';
        btn.style.fontSize = '18px';
        btn.style.cursor = 'pointer';
        btn.style.outline = 'none';
        btn.style.minWidth = '45px';
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
        
        // Update selector
        const selector = document.getElementById('scene-selector');
        if (selector) {
            selector.value = index;
        }
        
        needsRender = true;
        // Don't reset animation - keep playing from current position
    }

    // Animation state
    const startDate = new Date(config.animation.startDate);
    const endDate = new Date(config.animation.endDate);
    const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const totalDuration = config.animation.totalDurationSeconds || 60;
    const millisecondsPerDay = (totalDuration * 1000) / totalDays;
    
    let currentDay = 0;
    let animationStartTime = Date.now();
    let pausedTime = 0;
    let isPaused = false;
    let lastFrameTime = Date.now();
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    let needsRender = true;
    let isAnimationComplete = false;
    
    function togglePlayPause() {
        const btn = document.getElementById('play-pause-btn');
        if (isPaused) {
            // Resume
            isPaused = false;
            isAnimationComplete = false;
            animationStartTime = Date.now() - pausedTime;
            btn.textContent = '⏸';
            btn.title = 'Pause';
            needsRender = true;
        } else {
            // Pause
            isPaused = true;
            pausedTime = Date.now() - animationStartTime;
            btn.textContent = '▶';
            btn.title = 'Play';
        }
    }
    
    function rewindAnimation() {
        animationStartTime = Date.now();
        pausedTime = 0;
        currentDay = 0;
        isAnimationComplete = false;
        needsRender = true;
        if (isPaused) {
            togglePlayPause();
        }
    }

    // Main animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        const now = Date.now();
        const deltaTime = now - lastFrameTime;
        
        // Skip frame throttling when dragging for smooth interaction
        if (!draggedGraph && deltaTime < frameInterval) {
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

        // Calculate current day based on pause state
        let elapsedTime;
        if (isPaused) {
            elapsedTime = pausedTime;
        } else {
            elapsedTime = now - animationStartTime;
        }
        
        const exactDay = Math.min(elapsedTime / millisecondsPerDay, totalDays - 1);
        const calculatedDay = Math.floor(exactDay);

        if (calculatedDay !== currentDay && calculatedDay < totalDays) {
            currentDay = calculatedDay;
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + currentDay);
            dateDisplay.textContent = currentDate.toISOString().split('T')[0];
        }
        
        // Check if animation is complete
        const wasComplete = isAnimationComplete;
        if (exactDay >= totalDays - 1 && !isPaused) {
            isAnimationComplete = true;
        }
        
        // Only skip rendering if paused AND complete AND no interaction
        if (isAnimationComplete && isPaused && !draggedGraph && !needsRender) {
            return;
        }
        
        // Hover detection via raycasting
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(currentScene.threeObjects.children, true);
        
        let newHoveredGraph = null;
        for (const intersect of intersects) {
            if (intersect.object.userData.isGraphBounds) {
                newHoveredGraph = intersect.object.parent;
                break;
            }
        }
        
        if (newHoveredGraph !== hoveredGraph) {
            hoveredGraph = newHoveredGraph;
            canvas.style.cursor = hoveredGraph && !draggedGraph ? 'grab' : 'default';
        }

        // Render current scene (every frame for smooth interpolation)
        currentScene.render(exactDay, totalDays);

        renderer.render(threeScene, camera);
        needsRender = false;
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
