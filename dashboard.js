document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('locationInput');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');

    // Debounce search input
    let timeout = null;
    input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                performSearch(query);
            }
        }, 800);
    });

    async function performSearch(query) {
        loading.style.display = 'block';
        results.style.display = 'none';

        // 1. Geocode
        const location = await DataService.geocodeLocation(query);

        if (!location) {
            loading.innerText = "Location not found.";
            return;
        }

        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);

        // 2. Fetch All Data
        const [stations, floods, landslides, nrwWarnings] = await Promise.all([
            DataService.fetchStations(),
            DataService.fetchFloods(),
            DataService.fetchLandslides(),
            DataService.fetchNRWWarnings(lat, lon, 10000) // 10km radius for NRW
        ]);

        // 3. Filter Data (Radius: 10km)
        const RADIUS_KM = 10;

        const nearbyStations = stations.filter(s => {
            if (!s.lat || !s.long) return false;
            return DataService.calculateDistance(lat, lon, s.lat, s.long) <= RADIUS_KM;
        });

        // Strict spatial filtering for Floods (EA)
        const nearbyFloods = floods.filter(f => {
            // 1. Check if it has direct lat/long (rare but possible)
            if (f.lat && f.long) {
                return DataService.calculateDistance(lat, lon, f.lat, f.long) <= RADIUS_KM;
            }

            // 2. Check if it has a floodArea with polygon
            // Note: This relies on the new helper in DataService
            if (f.floodArea && f.floodArea.polygon) {
                const coords = DataService.extractPolygonCoordinates(f.floodArea.polygon);
                const centroid = DataService.calculateCentroid(coords);
                if (centroid) {
                    // Centroid is [lon, lat]
                    return DataService.calculateDistance(lat, lon, centroid[1], centroid[0]) <= RADIUS_KM;
                }
            }

            return false;
        });

        const nearbyLandslides = landslides.filter(l => {
            if (l.geometry && l.geometry.type === 'Point') {
                const [lLon, lLat] = l.geometry.coordinates;
                return DataService.calculateDistance(lat, lon, lLat, lLon) <= RADIUS_KM;
            }
            return false;
        });

        // 4. Update UI
        updateUI(nearbyStations, nearbyFloods, nearbyLandslides, nrwWarnings);

        loading.style.display = 'none';
        results.style.display = 'grid';
    }

    function updateUI(stations, localFloods, landslides, nrwWarnings) {
        // Stations
        document.getElementById('stationCount').innerText = stations.length;
        const stationList = document.getElementById('stationList');
        stationList.innerHTML = stations.length === 0 ? '<li class="list-item">No stations nearby.</li>' :
            stations.map(s => `<li class="list-item"><strong>${s.label}</strong><br><small>${s.riverName || 'Unknown River'}</small></li>`).join('');

        // Landslides
        document.getElementById('landslideCount').innerText = landslides.length;
        const landslideList = document.getElementById('landslideList');
        landslideList.innerHTML = landslides.length === 0 ? '<li class="list-item">No records found.</li>' :
            landslides.map(l => `<li class="list-item"><strong>${l.properties.landslide_name || 'Landslide'}</strong><br><small>${l.properties.locality_details || ''}</small></li>`).join('');

        // Floods (EA + NRW) - STRICTLY LOCAL ONLY
        let floodContent = '';
        let count = 0;

        // Add NRW Warnings
        if (nrwWarnings && nrwWarnings.length > 0) {
            count += nrwWarnings.length;
            floodContent += `<li class="list-item" style="background: #e0f7fa;"><strong>Found ${nrwWarnings.length} local NRW warnings</strong></li>`;
            nrwWarnings.forEach(w => {
                floodContent += `<li class="list-item"><strong>${w.description || 'NRW Warning'}</strong><br><small>${w.severity || 'Unknown severity'}</small></li>`;
            });
        }

        // Add Local EA Warnings
        if (localFloods.length > 0) {
            count += localFloods.length;
            floodContent += localFloods.map(f => {
                const tagClass = f.severityLevel === 1 ? 'tag-severe' : 'tag-warning';
                const tagText = f.severityLevel === 1 ? 'SEVERE' : 'WARNING';
                return `<li class="list-item">
                    <strong>${f.eaAreaName}</strong> <span class="tag ${tagClass}">${tagText}</span><br>
                    <small>${f.message || 'No details'}</small>
                </li>`;
            }).join('');
        }

        if (count === 0) {
            floodContent = '<li class="list-item">No active flood alerts in this area.</li>';
        }

        document.getElementById('floodCount').innerText = count;
        // Update label to reflect strictly local data
        document.querySelector('.card:first-child p').innerText = "Active alerts within 10km";

        const floodList = document.getElementById('floodList');
        floodList.innerHTML = floodContent;
    }
});
