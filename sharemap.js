//$(document).ready(function(){
// $('.header').height($(window).height());
// 
//})
// Javascript File for Pantry Map
// 3/3/20 Working

/*                        */
/*          MAIN          */
/*                        */

    // Initialize map centered on Philadelphia
    var map = L.map('map', {
        center: [39.982996, -75.169090],
        zoom: 12,
        zoomControl: false,
        scrollWheelZoom: false
    });

    // Set max and min zoom
    map.options.minZoom = 9; // zoom out
    map.options.maxZoom = 18; // zoom in

    // Add separate Zoom control on bottom right
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    
    // Load tile layer
    var CartoDB_Voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 18
    });
    
    CartoDB_Voyager.addTo(map);


//    // Add HQ Marker
//    var hq = L.marker([40.006166, -75.177615], {
//    // icon: hq_icon,
//        onEachFeature: onEachFeatureHQ
//    }).addTo(map);

    // Temporary constants set for testing of current location
    // Remove when final version is implemented
    var CURRENT_LOC = [40.006166, -75.177615];
    var CURRENT_LATLNG = L.latLng(CURRENT_LOC);

    // Global variables
    var hasCircle = 0;
    var chosenAddy = [];
        
    // Create new feature group to hold toggled data
    var dataLayer = new L.featureGroup();

    // Load layers initially with no filter
    initialLayers();
        
     
    // Allow the use of the .remove() function later
    if (!('remove' in Element.prototype)) {
      Element.prototype.remove = function() {
        if (this.parentNode) {
          this.parentNode.removeChild(this);
        }
      };
    }


/*                        */
/*      FUNCTIONS         */
/*                        */


    // Loads initial map layers
    function initialLayers(){
        
        // Clear layers from feature group
        dataLayer.clearLayers();

        // Create geojson of pantries
        var pantryLayer = L.geoJson(pantries, {
            pointToLayer: function(feature,latlng) {
                return L.circleMarker(latlng);
            },
            style: pantry_style,
            onEachFeature: onEachFeaturePantry
        }).addTo(dataLayer);
        
        
        dataLayer.addTo(map);
    }    

    // grabs input from the form: radius and site type
    function processFormData(){
        
        // take radius input from DOM
        var inputRadius = document.getElementById('num_radius');
        var rad = parseFloat(inputRadius.value);
        

        // get address input from DOM
        var uStreet = document.getElementById('geo_add').value;
        var uCity = document.getElementById('geo_city').value;
        var uState = "PA";
        var uZip = document.getElementById('geo_zip').value;
            
        
        var inAdd = uStreet + " " + uCity + " " + uState + " " + uZip;
        var addFormat = uStreet + "<br>" + uCity + ", " + uState + " " + uZip;
        
        // json request using address input
        $.getJSON('http://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + inAdd, function(data) {

            // initialize key value pairs
            var itemsK = [];
            var itemsV = [];
            
            $.each(data, function(key, val) {
                
                itemsK.push(key);
                itemsV.push(val);  

            });

            if(itemsV.length == 0){
                 var listings = document.getElementById('listings');
                 listings.innerHTML = "Invalid Address - Try again";
            }else{
                chosenAddy = [];
                chosenAddy.push(parseFloat(itemsV[0].lat));
                chosenAddy.push(parseFloat(itemsV[0].lon));

                
                //apply filter radius when reloading layers
                reloadLayers(rad, chosenAddy, addFormat);
            }
            
        });

    }


    // Clears form input on a button click
    function clearInput(){
        document.getElementById('num_radius').value = '1';
        document.getElementById('geo_add').value = '';
        document.getElementById('geo_city').value = '';
        document.getElementById('geo_zip').value = '';
    }

    function resetMap(){
        clearInput();
        initialLayers();
        var listings = document.getElementById('listings');
        listings.innerHTML = "";
        map.setView([39.982996, -75.169090], 12);
        if (hasCircle == 1) {
            map.removeLayer(circle);
            hasCircle = 0;
       }
    }

    // Reloads map layers based on search radius and address
    // Loads a marker at the search location with a popup
    function reloadLayers(rad, uloc, add){
        
        // set current layer to pantries
        // could implement layer choice at later point
        var lay = pantries;
        
        // clear layer group
        dataLayer.clearLayers();
        
        // Create latlng of currrent location
        var ulatlng = L.latLng(uloc);
        
        
        // Add marker of current search location and open popup
        L.marker(ulatlng).addTo(dataLayer).bindPopup("<b>Search location: </b><br>" + add).openPopup();
        
        // compute current search distance for each feature
        // given the radius rad
        lay.features.forEach(function(site, i) {
            // get coordinates of feature
                var feat_lat = site.properties.latitude;
                var feat_lon = site.properties.longitude;
                var feat_coords = L.latLng([feat_lat, feat_lon]);
                var distBetween = (ulatlng.distanceTo(feat_coords)*0.00062137);
            site.properties.dist = distBetween;
            site.properties.dist_id = i;
          });
        

        // sort the geojson
        sites_sort = (lay.features).sort(sortGeojson);
        
        // filter the geojson
        sites_within = sites_sort.filter(function(site){
            return site.properties.dist < rad;
        });
        
        // choose where to send the reloaded layer
        
        if(lay.name == "corona_pantries"){
            var pantryLayer = L.geoJson(sites_within, {
            pointToLayer: function(feature,latlng) {
                return L.circleMarker(latlng);
            },
            style: pantry_style,
            onEachFeature: onEachFeaturePantry
            }).addTo(dataLayer);
            
        }else{
            // reserved for addition of other layers
        }
        

        dataLayer.addTo(map);
        
         // zoom to current featureGroup bounds - dataLayer
        map.fitBounds(dataLayer.getBounds());


        // build the location list from the current sites within radius
        buildLocationList(sites_within);
    }


    function buildLocationList(data) {

      // grab the listings and set to blank
      var all = document.getElementById('listings');
      all.innerHTML = "";
    
      // remove circles on new search
      if (hasCircle == 1) {
            map.removeLayer(circle);
            hasCircle = 0;
      }
      
        
      if(data.length==0){
          var listings = document.getElementById('listings');
          listings.innerHTML = "No Search Results Found!";
      }
      else{  
        
          data.forEach(function(site, i){
            // get site properties
            var prop = site.properties;

            // add new listings section
            var listings = document.getElementById('listings');


            var listing = listings.appendChild(document.createElement('div'));
            /* Assign a unique `id` to the listing. */
            listing.id = "listing-" + prop.dist_id;
            /* Assign the `item` class to each listing for styling. */
            listing.className = 'item';

            /* Add the link to the individual listing created above. */
            var link = listing.appendChild(document.createElement('a'));
            link.href = '#';
            link.className = 'title';
            link.id = "link-" + prop.dist_id;
            link.innerHTML = '<b>' + prop.pantry_name + '</b>';

            /* Add details to the individual listing. */
            var details = listing.appendChild(document.createElement('div'));
            details.innerHTML = prop.address + " <br>" + 
                                prop.city + ", " + 
                                prop.state + " " + 
                                prop.zip + "<br><b>" +
                                prop.dist.toFixed(2) + ' Miles Away</b>';



            link.addEventListener('click', function(e){
                // remove all existing circles
                if (hasCircle == 1) {
                    map.removeLayer(circle);
                    hasCircle = 0;
                }

                // remove all popups
                map.closePopup();
                
                // yellow circle
                circle = new L.circleMarker([prop.latitude,prop.longitude], {
                    color: 'yellow',
                    fillColor: 'yellow',
                    radius: 12,           
                    weight: 1,
                    stroke: 5,
                    fillOpacity: .7,
                    opacity: .7,
                }).addTo(map).bringToBack();
                
                hasCircle = 1;

                flyToSite(site);

                
            
                
                /* Highlight listing in sidebar */
                  var activeItem = document.getElementsByClassName('active');


                  e.stopPropagation();
                  if (activeItem[0]) {
                    activeItem[0].classList.remove('active');
                  }
                  var listingA = document.getElementById('listing-' + site.properties.dist_id);

                  listingA.classList.add('active');
                  
                });

              });
          
            }
        }
        
        
    // Sorts the geojson according to distance from the search location
    function sortGeojson(a,b,prop) {
      return (a.properties.dist < b.properties.dist) ? -1 : ((a.properties.dist > b.properties.dist) ? 1 : 0);
    }
        
     
    // On each feature function definitions for pantries
    function onEachFeaturePantry(feature, layer) {
        
                var props = feature.properties;

                var displayText = (   
                                '<b>' + props.pantry_name + '</b><br>' + props.address + '<br>' + props.city + ', ' + props.state + ' ' + props.zip + 
                                '<br><br><b>Phone Number:<br></b>' + props.display_phone
                                );
                
                layer.bindPopup(displayText);
                
                layer.on({
                    mouseover: highlightFeature,
                    mouseout: resetHighlight,
                    click: displayInfo
                });      
    }
    

    // define sites layer style
    function pantry_style() {
        return {
            color: 'black',
            fillColor: '#D5652A',
            radius: 6.5,           
            weight: 1,
            stroke: 1,
            fillOpacity: .6,
            opacity: .6,
        };
    }


    // Highlight feature
    function highlightFeature(e) {
        var layer = e.target;
        layer.setStyle({
            fillOpacity: 1,
            opacity: 1,
            color: 'yellow'
        });
        
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
        
    }

    
    // Reset the highlight of a feature
    function resetHighlight(e){
        var layer = e.target;

        layer.setStyle({
            fillOpacity: .8,
            opacity: .8,
            color: 'black'
        });
        
    }

      
    // zoom + display popup for pantry site
    // displays pantry site info on click
    function displayInfo(e){
        
        var layer = e.target;
        
        layer.setStyle({
            fillOpacity: 1,
            opacity: 1,
            color: 'red'
        });
        
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }

        layer.openPopup();
    }
        
    // Fly to currently selected feature
    // Called in the BuildLocationList function: links allow flying to features
    function flyToSite(currentFeature) {
        
      map.flyTo(
        [currentFeature.properties.latitude, currentFeature.properties.longitude],
        15
      );
    }
