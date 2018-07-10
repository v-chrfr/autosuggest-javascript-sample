// Chris French
// v-chrfr@microsoft.com
// MIT License

(function ()
{
    var secret_api_key = "***ENTER_YOUR_API_KEY_HERE***";

    // Use HTML5 Geolocation to get User Location -- available in Modern Browsers
    function getLocation()
    {
        let cords = sessionStorage.getItem('cords')
        if (cords == null)
        {
            if (navigator.geolocation)
            {
                navigator.geolocation.getCurrentPosition(setPosition);
            } 
            else
            {
                alert("HTML5 Geolocation is not supported by this browser.");
            }
        }
    }

    // Save the User Location for this Session
    function setPosition(position)
    {
        let cords = [position.coords.latitude, position.coords.longitude].map(String).join(',');
        sessionStorage.setItem('cords', cords);
    }

    // Define a Prototype for Address Data Entities
    function AddressEntity(data)
    {
        /* Possible Address Entity Data Fields in JSON response

            - houseNumber
            - streetName
            - addressLine
            - locality
            - adminDistrict
            - adminDistrict2
            - countryRegion
            - countryRegionIso2
            - neighborhood
            - postalCode
            - formattedAddress
        */
        this.street_address = data.address.addressLine,
            this.city = data.address.locality,
            this.state = data.address.adminDistrict;
        this.zip = data.address.postalCode;

        // the JQuery Autosuggest UI library uses this field to render a list of suggestions in the browser UI
        this.label = [this.street_address, this.city, this.state, this.zip].filter(o => o != undefined).join(", ");
    }

    // Create the URI to pass to Autosuggest API and call the Bing Maps REST API Autosuggest service
    function callAutoSuggestService(partial_query, api_key)
    {
        let cords = sessionStorage.getItem('cords');
        if (cords != null) 
        {
            let max_results = "10";
            let query = encodeURIComponent(partial_query);
            let head = "http://dev.virtualearth.net/REST/v1/Autosuggest?query=";
            let user_location = "&userLocation=" + cords;
            let max_result_string = "&maxResults=" + max_results;
            let entity_type_string = "&includeEntityTypes=Address";

            // Change this parameter, and add `userRegion` and `cultureFilter` to optimize Autosuggest API for non-US businesses
            let culture = "&culture=en-US";

            let key_string = "&key=" + api_key;
            let request = head + query + user_location + max_result_string + entity_type_string + culture + key_string;

            CallRestService(request, AutoSuggestCallBack);
        }
    }

    // Make REST call and send response to callback function
    function CallRestService(request, callback)
    {
        var r = new XMLHttpRequest();
        r.open("GET", request, false);
        r.send();
        callback(r.responseText);
    }

    // Save the returned entries for this Session
    function SaveEntities(entities)
    {
        let save_string = JSON.stringify(entities);
        sessionStorage.setItem('entities', save_string);
    }

    // Load stored entries during this session
    function LoadEntities()
    {
        let string_entities = sessionStorage.getItem('entities');
        if (string_entities != null)
        {
            return JSON.parse(string_entities);
        }
        return [];
    }

    // Format JSON response data and create and store Address Entities
    function AutoSuggestCallBack(data)
    {
        try
        {
            let obj = JSON.parse(data);
            Promise.resolve(obj)
                .then(obj => obj.resourceSets[0].resources[0].value)
                .then(data_list => data_list.map(data => new AddressEntity(data)))
                .then(SaveEntities);
        } catch (e)
        {
            alert(e);
        }
    }

    // Update UI with Address information
    function UpdateUIData(entity)
    {
        $('#inputCity').val(entity.city);
        $('#inputState').val(entity.state);
        $('#inputAddress').val(entity.street_address);
        $('#inputZip').val(entity.zip);
    }

    $(document).ready(function ()
    {
        getLocation();

        // Use JQuery Autosuggest UI and call Bing Maps REST Autosuggest API
        $("#search-form").autocomplete({
            source: function (request, response)
            {
                Promise.resolve(request.term)
                    .then(function (query)
                    {
                        callAutoSuggestService(query, secret_api_key);
                    })
                    .then(function ()
                    {
                        let entities = LoadEntities();
                        Promise.resolve(entities).then(response);
                    });
            },
            minLength: 1,
            select: function (event, ui)
            {
                UpdateUIData(ui.item);
            }
        });
    });
})();