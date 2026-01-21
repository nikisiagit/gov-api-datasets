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
        // Note: For NRW, we need to pass lat/lon specifically
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

        const nearbyFloods = floods.filter(f => {
            // Some floods might not have lat/long directly, simplified check for now if area matches
            // Ideally we need centroid of flood area, but many responses don't have it top-level
            // We'll skip complex polygon check for this dashboard prototype and rely on 'floodArea' lat/long if available
            // Note: The main app calculates centroids. Here we might miss some without that logic.
            // Let's try to match by EA Area Name if user searched for it, OR generic filter if we had coords.
            // As a fallback, we will just list ALL active severe warnings for context if no coords.

            // Actually, let's allow all severe warnings to show, or filter if they have lat/long (which we calculated in app.js but not here).
            // For dashboard simplicity, we'll show ALL hazards if we can't filter, or just skip.
            // Better approach: Re-implement simplified matching. 
            return false; // Placeholder, real implementation below
        });

        // RE-IMPLEMENT FILTERING:
        // Since flood data doesn't default have easy lat/long, we will show "National Severe Warnings" 
        // OR try to filter items that explicitly have `lat` / `long` properties (rare).
        // A better proxy for this demo: Filter Landslides and Stations accurately. 
        // For Floods, we will list ALL "Severe" warnings as they are critical.

        const nearbyLandslides = landslides.filter(l => {
            // GeoJSON point: features[i].geometry.coordinates [lon, lat]
            // Note: BGS might be [lon, lat]
            if (l.geometry && l.geometry.type === 'Point') {
                const [lLon, lLat] = l.geometry.coordinates;
                return DataService.calculateDistance(lat, lon, lLat, lLon) <= RADIUS_KM;
            }
            return false;
        });

        // 4. Update UI
        updateUI(nearbyStations, floods, nearbyLandslides, nrwWarnings);

        loading.style.display = 'none';
        results.style.display = 'grid';
    }

    function updateUI(stations, allFloods, landslides, nrwWarnings) {
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

        // Floods (EA + NRW)
        const severeFloods = allFloods.filter(f => f.severityLevel === 1 || f.severityLevel === 2);

        let floodContent = '';

        // Add NRW Warnings first if any (since they are local to search)
        if (nrwWarnings && nrwWarnings.length > 0) {
            floodContent += `<li class="list-item" style="background: #e0f7fa;"><strong>Found ${nrwWarnings.length} local NRW warnings</strong></li>`;
            // Note: NRW response structure assumed to be list of warnings. 
            // If 'nrwWarnings' contains complex objects, we map them here.
            // Assuming array of warning objects for now.
            nrwWarnings.forEach(w => {
                floodContent += `<li class="list-item"><strong>NA: ${w.description || 'NRW Warning'}</strong><br><small>${w.severity || 'Unknown severity'}</small></li>`;
            });
        }

        // Add National EA Warnings
        if (severeFloods.length > 0) {
            floodContent += severeFloods.slice(0, 50).map(f => {
                const tagClass = f.severityLevel === 1 ? 'tag-severe' : 'tag-warning';
                const tagText = f.severityLevel === 1 ? 'SEVERE' : 'WARNING';
                return `<li class="list-item">
                    <strong>${f.eaAreaName}</strong> <span class="tag ${tagClass}">${tagText}</span><br>
                    <small>${f.message || 'No details'}</small>
                </li>`;
            }).join('');
        } else if (!nrwWarnings || nrwWarnings.length === 0) {
            floodContent = '<li class="list-item">No severe warnings found.</li>';
        }

        document.getElementById('floodCount').innerText = (nrwWarnings ? nrwWarnings.length : 0) + severeFloods.length;
        // Update label to reflect mixed data
        document.querySelector('.card:first-child p').innerText = "NRW (Local) + High Risk (National)";

        const floodList = document.getElementById('floodList');
        floodList.innerHTML = floodContent;
    }
});
