(function() {

    function loadMapApi() {
        let api_key = loadApiKey();
        console.log("loading map");
        let map = new Microsoft.Maps.Map('#map-view', 
            { 
                credentials: api_key,
            }
        );
        map.setView({
            mapTypeId: Microsoft.Maps.MapTypeId.aerial,
            center: new Microsoft.Maps.Location(35.027222, -111.0225),
            zoom: 15
        });
    }

    async function getJsonRequest(url) {
        try {
            let response = await fetch(url);
            if (response.ok) {
                let data = await response.json();
                return data;
            }
        throw new Error('Request failed');
        } catch(error) {
            // do something with error
        }
    }

    function loadApiKey() {
        let api_key = document.getElementById("api-field").value;
        return api_key;
    }

    function reverseGeoCode( sessionId ) {
        let address_string = document.getElementById("address_input").value;

        // using unstructured url: see https://msdn.microsoft.com/en-us/library/ff701711.aspx
        let url = "http://dev.virtualearth.net/REST/v1/Locations/" + address_string + "&key=" + sessionId;

        // get response
        let data = getJsonRequest(url);

        let obj = JSON.parse(data);

        let cords = obj.resourceSets.resources.point.coordinates;

        let cords_string = cords[0] + "," + cord[1];
        
        // assuming jQuery is already imported by index.html
        $("address-geocode")
            .val(cords_string);
    }

    $(document).ready(function () {
        $("#api-button")
            .click(function() {
                loadMapApi();
            });

        $("#reverse-button")
            .click(function() {
                Microsoft.Maps.Map.getCredentials(reverseGeoCode);
            });

    });

})();
