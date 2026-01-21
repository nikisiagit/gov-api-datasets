// UK Flood Monitoring Map Application
// Data sources: Environment Agency Real-time Flood Monitoring API & BGS Landslide Data

const API_BASE = 'https://environment.data.gov.uk/flood-monitoring';
const BGS_API_BASE = 'https://ogcapi.bgs.ac.uk';

// API Endpoints
const ENDPOINTS = {
    stations: `${API_BASE}/id/stations`,
    floods: `${API_BASE}/id/floods`,
    floodAreas: `${API_BASE}/id/floodAreas`,
    landslides: `${BGS_API_BASE}/collections/landslideindex/items?f=json&limit=5000`,
    localAuthorities: 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD_MAY_2025_UK_BGC_V2/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson'
};

// Global map and layer groups
let map;
let layerGroups = {
    stations: null,
    floods: null,
    floodAreas: null,
    landslides: null,
    localAuthorities: null
};

// Status tracking
let statusElement;
let loadingOverlay;
let loadingText;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    statusElement = document.getElementById('statusText');
    loadingOverlay = document.getElementById('loadingOverlay');
    loadingText = document.getElementById('loadingText');

    initializeMap();
    loadAllData();
});

// Initialize Leaflet map
function initializeMap() {
    // Center on England
    map = L.map('map').setView([52.8, -1.5], 6);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create panes to control z-index
    map.createPane('polygonsPane');
    map.getPane('polygonsPane').style.zIndex = 350;

    map.createPane('pointsPane');
    map.getPane('pointsPane').style.zIndex = 650;

    updateStatus('Map initialized');
}

// Main data loading function
async function loadAllData() {
    const startTime = Date.now();
    updateStatus('Loading data from APIs...');

    try {
        // Load all data sources in parallel for optimal performance
        const [stationsData, floodsData, floodAreasData, landslidesData, localAuthData] = await Promise.all([
            fetchData(ENDPOINTS.stations, 'Monitoring Stations'),
            fetchData(ENDPOINTS.floods, 'Flood Warnings'),
            fetchData(ENDPOINTS.floodAreas, 'Flood Areas'),
            fetchLandslidesData(ENDPOINTS.landslides, 'BGS Landslides'),
            fetchLocalAuthoritiesData(ENDPOINTS.localAuthorities, 'Local Authorities')
        ]);

        // Convert to GeoJSON and create layers
        updateLoadingText('Processing data...');

        const stationsGeoJSON = convertStationsToGeoJSON(stationsData);
        const floodsGeoJSON = convertFloodsToGeoJSON(floodsData);
        const areasGeoJSON = convertFloodAreasToGeoJSON(floodAreasData);
        const landslidesGeoJSON = landslidesData; // Already in GeoJSON format from BGS
        const localAuthGeoJSON = localAuthData; // Already in GeoJSON format

        // Create map layers
        createStationsLayer(stationsGeoJSON);
        createFloodsLayer(floodsGeoJSON);
        createFloodAreasLayer(areasGeoJSON);
        createLandslidesLayer(landslidesGeoJSON);
        createLocalAuthoritiesLayer(localAuthGeoJSON);

        // Add layer control
        addLayerControl();

        const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
        updateStatus(`Loaded successfully in ${loadTime}s - ${stationsGeoJSON.features.length} stations, ${floodsGeoJSON.features.length} warnings, ${areasGeoJSON.features.length} areas, ${landslidesGeoJSON.features.length} landslides, ${localAuthGeoJSON.features.length} districts`);

        hideLoading();

    } catch (error) {
        console.error('Error loading data:', error);
        updateStatus('Error loading data. Please refresh the page.');
        updateLoadingText('Error loading data - check console');
    }
}

// Fetch data from API with error handling
async function fetchData(url, name) {
    updateLoadingText(`Fetching ${name}...`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`${name} loaded:`, data.items?.length || 0, 'items');

        return data.items || [];

    } catch (error) {
        console.error(`Error fetching ${name}:`, error);
        updateStatus(`Warning: Could not load ${name}`);
        return [];
    }
}

// Fetch landslides data from BGS API (returns GeoJSON directly)
async function fetchLandslidesData(url, name) {
    updateLoadingText(`Fetching ${name}...`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`${name} loaded:`, data.features?.length || 0, 'features');

        // BGS API returns GeoJSON directly
        return {
            type: 'FeatureCollection',
            features: data.features || []
        };

    } catch (error) {
        console.error(`Error fetching ${name}:`, error);
        updateStatus(`Warning: Could not load ${name}`);
        return { type: 'FeatureCollection', features: [] };
    }
}

// Fetch Local Authorities data (returns GeoJSON directly)
async function fetchLocalAuthoritiesData(url, name) {
    updateLoadingText(`Fetching ${name}...`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`${name} loaded:`, data.features?.length || 0, 'features');

        return {
            type: 'FeatureCollection',
            features: data.features || []
        };

    } catch (error) {
        console.error(`Error fetching ${name}:`, error);
        updateStatus(`Warning: Could not load ${name}`);
        return { type: 'FeatureCollection', features: [] };
    }
}

// Convert stations data to GeoJSON
function convertStationsToGeoJSON(stations) {
    const features = stations
        .filter(station => station.lat && station.long)
        .map(station => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [station.long, station.lat]
            },
            properties: {
                id: station.stationReference || station['@id'],
                name: station.label || 'Unknown Station',
                riverName: station.riverName || 'N/A',
                town: station.town || 'N/A',
                catchment: station.catchmentName || 'N/A',
                status: station.status || 'Unknown',
                type: 'station',
                measures: station.measures || []
            }
        }));

    return {
        type: 'FeatureCollection',
        features: features
    };
}

// Convert flood warnings to GeoJSON
function convertFloodsToGeoJSON(floods) {
    const features = floods
        .filter(flood => flood.eaAreaName)
        .map(flood => {
            // Extract coordinates if available
            let coordinates = [-1.5, 52.8]; // Default to center of England

            if (flood.floodArea && flood.floodArea.polygon) {
                // If polygon data exists, use its centroid
                const polygon = flood.floodArea.polygon;
                if (typeof polygon === 'string') {
                    const coords = extractPolygonCoordinates(polygon);
                    if (coords.length > 0) {
                        coordinates = calculateCentroid(coords);
                    }
                }
            }

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: coordinates
                },
                properties: {
                    id: flood['@id'],
                    areaName: flood.eaAreaName,
                    severity: flood.severityLevel || 3,
                    severityText: getSeverityText(flood.severityLevel),
                    description: flood.description || 'No description available',
                    message: flood.message || '',
                    timeRaised: flood.timeRaised || 'Unknown',
                    timeChanged: flood.timeMessageChanged || flood.timeRaised || 'Unknown',
                    type: 'flood'
                }
            };
        });

    return {
        type: 'FeatureCollection',
        features: features
    };
}

// Convert flood areas to GeoJSON
function convertFloodAreasToGeoJSON(areas) {
    const features = areas
        .filter(area => area.polygon)
        .map(area => {
            const coordinates = extractPolygonCoordinates(area.polygon);

            if (coordinates.length === 0) return null;

            return {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates]
                },
                properties: {
                    id: area['@id'],
                    label: area.label || 'Flood Area',
                    notation: area.notation || 'N/A',
                    riverOrSea: area.riverOrSea || 'N/A',
                    county: area.county || 'N/A',
                    type: 'floodArea'
                }
            };
        })
        .filter(f => f !== null);

    return {
        type: 'FeatureCollection',
        features: features
    };
}

// Extract polygon coordinates from WKT or other format
function extractPolygonCoordinates(polygon) {
    try {
        if (typeof polygon === 'string') {
            // Handle WKT format: POLYGON((lon lat, lon lat, ...))
            const match = polygon.match(/POLYGON\s*\(\((.*?)\)\)/i);
            if (match) {
                const coordPairs = match[1].split(',');
                return coordPairs.map(pair => {
                    const [lon, lat] = pair.trim().split(/\s+/);
                    return [parseFloat(lon), parseFloat(lat)];
                }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
            }
        }
    } catch (error) {
        console.error('Error extracting polygon coordinates:', error);
    }
    return [];
}

// Calculate centroid of polygon
function calculateCentroid(coordinates) {
    let sumLon = 0, sumLat = 0;
    coordinates.forEach(coord => {
        sumLon += coord[0];
        sumLat += coord[1];
    });
    return [sumLon / coordinates.length, sumLat / coordinates.length];
}

// Get severity text
function getSeverityText(level) {
    const severities = {
        1: 'Severe Flood Warning',
        2: 'Flood Warning',
        3: 'Flood Alert',
        4: 'Warning No Longer In Force'
    };
    return severities[level] || 'Unknown';
}

// Create stations layer
function createStationsLayer(geojson) {
    layerGroups.stations = L.geoJSON(geojson, {
        pane: 'pointsPane',
        coordsToLatLng: (coords) => {
            // GeoJSON is [lng, lat], Leaflet expects [lat, lng]
            return L.latLng(coords[1], coords[0]);
        },
        pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: '#3388ff',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const popup = `
                <div class="popup-title">📍 ${props.name}</div>
                <div class="popup-detail"><span class="popup-label">River:</span> ${props.riverName}</div>
                <div class="popup-detail"><span class="popup-label">Town:</span> ${props.town}</div>
                <div class="popup-detail"><span class="popup-label">Catchment:</span> ${props.catchment}</div>
                <div class="popup-detail"><span class="popup-label">Status:</span> ${props.status}</div>
                <div class="popup-detail"><span class="popup-label">Measures:</span> ${props.measures.length} available</div>
                <div class="popup-detail" style="margin-top: 8px; font-size: 11px; color: #999;">
                    Source: EA Stations API
                </div>
            `;
            layer.bindPopup(popup);
        }
    });
}

// Create floods layer
function createFloodsLayer(geojson) {
    layerGroups.floods = L.geoJSON(geojson, {
        pane: 'pointsPane',
        coordsToLatLng: (coords) => {
            // GeoJSON is [lng, lat], Leaflet expects [lat, lng]
            return L.latLng(coords[1], coords[0]);
        },
        pointToLayer: (feature, latlng) => {
            const severity = feature.properties.severity;
            let color;

            switch (severity) {
                case 1: color = '#d32f2f'; break; // Severe
                case 2: color = '#ff9800'; break; // Warning
                case 3: color = '#fdd835'; break; // Alert
                default: color = '#999'; break;
            }

            return L.circleMarker(latlng, {
                radius: 10,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const severityClass = props.severity === 1 ? 'severe' :
                props.severity === 2 ? 'warning' : 'alert';

            const popup = `
                <div class="popup-title">⚠️ ${props.areaName}</div>
                <div class="popup-detail">
                    <span class="severity-badge severity-${severityClass}">
                        ${props.severityText}
                    </span>
                </div>
                <div class="popup-detail" style="margin-top: 8px;">
                    ${props.description.substring(0, 200)}${props.description.length > 200 ? '...' : ''}
                </div>
                <div class="popup-detail" style="margin-top: 8px;">
                    <span class="popup-label">Raised:</span> ${new Date(props.timeRaised).toLocaleString()}
                </div>
                <div class="popup-detail" style="margin-top: 8px; font-size: 11px; color: #999;">
                    Source: EA Floods API
                </div>
            `;
            layer.bindPopup(popup, { maxWidth: 300 });
        }
    });
}

// Create flood areas layer
function createFloodAreasLayer(geojson) {
    layerGroups.floodAreas = L.geoJSON(geojson, {
        pane: 'polygonsPane',
        coordsToLatLng: (coords) => {
            // GeoJSON is [lng, lat], Leaflet expects [lat, lng]
            return L.latLng(coords[1], coords[0]);
        },
        style: () => ({
            fillColor: '#6495ed',
            color: '#4169e1',
            weight: 2,
            opacity: 0.7,
            fillOpacity: 0.2
        }),
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const popup = `
                <div class="popup-title">🗺️ ${props.label}</div>
                <div class="popup-detail"><span class="popup-label">River/Sea:</span> ${props.riverOrSea}</div>
                <div class="popup-detail"><span class="popup-label">County:</span> ${props.county}</div>
                <div class="popup-detail"><span class="popup-label">Notation:</span> ${props.notation}</div>
                <div class="popup-detail" style="margin-top: 8px; font-size: 11px; color: #999;">
                    Source: EA Flood Areas API
                </div>
            `;
            layer.bindPopup(popup);

            // Highlight on hover
            layer.on('mouseover', () => {
                layer.setStyle({
                    fillOpacity: 0.4,
                    weight: 3
                });
            });

            layer.on('mouseout', () => {
                layer.setStyle({
                    fillOpacity: 0.2,
                    weight: 2
                });
            });
        }
    });
}

// Create landslides layer
function createLandslidesLayer(geojson) {
    layerGroups.landslides = L.geoJSON(geojson, {
        pane: 'pointsPane',
        coordsToLatLng: (coords) => {
            // GeoJSON is [lng, lat], Leaflet expects [lat, lng]
            return L.latLng(coords[1], coords[0]);
        },
        pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
                radius: 5,
                fillColor: '#8b4513',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties;

            // Build popup with available properties
            let popup = '<div class="popup-title">⚠️ Landslide Data</div>';

            // Add any available properties dynamically
            if (props) {
                Object.keys(props).forEach(key => {
                    if (props[key] && key !== 'id' && key !== '@id') {
                        const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        const value = typeof props[key] === 'object' ? JSON.stringify(props[key]) : props[key];
                        popup += `<div class="popup-detail"><span class="popup-label">${displayKey}:</span> ${value}</div>`;
                    }
                });
            }

            popup += `<div class="popup-detail" style="margin-top: 8px; font-size: 11px; color: #999;">
                Source: BGS Landslides API
            </div>`;

            layer.bindPopup(popup);
        }
    });
}

// Create Local Authorities layer
function createLocalAuthoritiesLayer(geojson) {
    layerGroups.localAuthorities = L.geoJSON(geojson, {
        pane: 'polygonsPane',
        style: () => ({
            fillColor: 'transparent',
            color: '#555',
            weight: 1,
            opacity: 0.8,
            dashArray: '5, 5'
        }),
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const popup = `
                <div class="popup-title">🏛️ ${props.LAD25NM}</div>
                <div class="popup-detail"><span class="popup-label">District Code:</span> ${props.LAD25CD}</div>
                <div class="popup-detail" style="margin-top: 8px; font-size: 11px; color: #999;">
                    Source: ONS (ArcGIS)
                </div>
            `;
            layer.bindPopup(popup);

            // Highlight on hover
            layer.on('mouseover', () => {
                layer.setStyle({
                    weight: 3,
                    color: '#333',
                    dashArray: ''
                });
            });

            layer.on('mouseout', () => {
                layer.setStyle({
                    weight: 1,
                    color: '#555',
                    dashArray: '5, 5'
                });
            });
        }
    });
}

// Add layer control
function addLayerControl() {
    const overlays = {
        '<span style="color: #3388ff;">●</span> Monitoring Stations (EA Stations API)': layerGroups.stations,
        '<span style="color: #ff9800;">●</span> Flood Warnings (EA Floods API)': layerGroups.floods,
        '<span style="color: #6495ed;">▬</span> Flood Warning Areas (EA Flood Areas API)': layerGroups.floodAreas,
        '<span style="color: #8b4513;">●</span> Landslides (BGS API)': layerGroups.landslides,
        '<span style="color: #555;">----</span> Local Authorities (ONS)': layerGroups.localAuthorities
    };

    // Add most layers to map by default (except Local Authorities to prevent clutter)
    Object.keys(layerGroups).forEach(key => {
        if (layerGroups[key] && key !== 'localAuthorities') {
            layerGroups[key].addTo(map);
        }
    });

    // Add control
    L.control.layers(null, overlays, {
        collapsed: false,
        position: 'topright'
    }).addTo(map);
}

// UI update functions
function updateStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
    console.log('Status:', message);
}

function updateLoadingText(message) {
    if (loadingText) {
        loadingText.textContent = message;
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
    }
}
