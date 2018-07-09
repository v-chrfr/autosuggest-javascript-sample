// Chris French, Microsoft Bing Maps Autosuggest API Tool
// MIT License
// v-chrfr@microsoft.com

(function ()
{
	const query_bar = document.getElementById('partial-query');
	const blocks = document.getElementById('partial-blocks');
	const USER_FOCUS = { title: "User", color: 'red', latitude: null, longitude: null };
	const ENTITY_FOCUS = { title: "Selected", color: 'green', latitude: null, longitude: null };

	/* Entity prototype for Autosuggest Results */
	function Entity(data)
	{
		this.longitude = -1;
		this.latitude = -1;
		this.index = -1;
		this.entity_type = data.__type;

		switch (data.__type)
		{
			case "Address":
				this.label = data.address.addressLine + ", " + data.address.locality;
				this.address = data.address.formattedAddress;
				break;
			case "LocalBusiness":
				this.label = data.name;
				this.address = data.address.formattedAddress;
				break;
			case "Place":
				let state = data.address.adminDistrict;
				let county = data.address.adminDistrict2;
				let city = data.address.locality;
				let region = data.address.countryRegion;
				let middle = [city, county, state, region].filter(e => e != undefined);
				this.label = [city, state].filter(e => e != undefined && e != '').join(', ') || data.address.formatedAddress;
				this.address = middle.join(', ');
				break;
			default:
				this.label = 'error';
				this.address = 'error';
				break;
		}
	}

	function GetFocus(entity, type)
	{
		let focus = (type == 'user') ? USER_FOCUS : ENTITY_FOCUS;
		focus.latitude = entity.latitude;
		focus.longitude = entity.longitude;
		focus.text = entity.index;
		return focus;
	}

	function SetFocus(entity, type)
	{
		let focus = GetFocus(entity, type);
		sessionStorage.setItem(type, JSON.stringify(focus));
	}

	let ClearFocus = () => { sessionStorage.setItem('focus', JSON.stringify(null)); };

    /*
      
      User Location UI
      
    */

	// Base functions

	function GetCords()
	{
		let cord_string = document.getElementById('address-geocode').value;
		return cord_string.split(",").map(Number);
	}

	function LocateUserOnMap()
	{
		let cords = GetCords();
		if (cords.length == 2)
		{
			Promise.resolve(USER_FOCUS)
				.then(function (user)
				{
					user.latitude = cords[0];
					user.longitude = cords[1];
					return user;
				})
				.then(user => SetFocus(user, 'user'));
		}
		else
		{
			console.log('no user selected: ' + String(cords));
		}
	}

	function GetUserLocation()
	{
		let loc = document.getElementById('address-geocode').value;
		let rad = document.getElementById('radius-input').value;
		return loc + "," + rad;
	}

	// Use HTML5 Geolocation to get User Location -- available in Modern Browsers
	function SetUserLocationByIP()
	{
		if (navigator.geolocation)
		{
			console.log('navigator loaded');
			navigator.geolocation.getCurrentPosition(function (position)
			{
				let cord_string = [position.coords.latitude, position.coords.longitude].join(',');
				sessionStorage.setItem('store-address-geocode', cord_string);
				document.getElementById('address-geocode').setAttribute('value', cord_string);
			}, (e) => { alert(e.text); }, { maximumAge: Infinity, timeout: 5000 });
		}
		else
		{
			alert("HTM5 Geolocation is not supported by this browser.");
		}
	}

    /*
      
      Reverse API Call Functions 
      
    */

	function ReverseUserAddress()
	{
		let api_key = loadApiKey();
		let address_string = document.getElementById('address-input').value;
		sessionStorage.setItem('store-address-input', address_string);
		let url = encodeURI("http://dev.virtualearth.net/REST/v1/Locations?query=" + address_string + "&key=" + api_key);
		console.log('calling user reverse');
		CallRestService(url, SaveUserCoordsCallback);
	}

	function ReverseEntityAddress(api_key, entity)
	{
		let address_string = entity.address;
		let url = encodeURI("http://dev.virtualearth.net/REST/v1/Locations?query=" + address_string + "&key=" + api_key);
		let partial_SaveEntityCallback = SaveEntityCallback.bind(null, entity);
		partial_SaveEntityCallback.name = 'callback' + parseInt(entity.index);
		CallRestService(url, partial_SaveEntityCallback);
	}

	// Helper Reverse API Functions

	function ReadCoordsFromJSON(data)
	{
		let obj = JSON.parse(data);
		return obj.resourceSets[0].resources[0].point.coordinates;
	}

	function SaveUserCoordsCallback(data)
	{
		Promise.resolve(data)
			.then(ReadCoordsFromJSON)
			.then(function (coords)
			{
				sessionStorage.setItem('store-address-geocode', coords[0] + "," + coords[1]);
			})
			.then(() => location.reload(true));
	}

	function SaveEntityCallback(entity, data)
	{
		Promise.resolve(data)
			.then(ReadCoordsFromJSON)
			.then(function (coords)
			{
				entity.latitude = coords[0];
				entity.longitude = coords[1];
				return entity;
			})
			.then(entity => ListStoreAdd('entity-list', entity));
	}

    /* 
       
       Autosuggest API Call Functions 
       
    */

	function SaveJsonResponseAsLink(url)
	{
		let save_data_link = document.getElementById('save-data-link');
		let a = document.createElement('a');
		a.href = url;
		a.innerHTML = 'Link to JSON response';
		a.target = "_blank";
		save_data_link.appendChild(a);
	}

	function AutoSuggestCallBack(data)
	{
		try
		{
			let api_key = loadApiKey();
			let obj = JSON.parse(data);
			Promise.resolve(obj)
				.then(obj => obj.resourceSets[0].resources[0].value)
				.then(list => list.map(entity_data => new Entity(entity_data)))
				.then(function (entities)
				{
					for (let i = 0; i < entities.length; i++)
					{
						let entity = entities[i];
						entity.index = i + 1;
						ReverseEntityAddress(api_key, entity);
					}
				})
				.then(() => location.reload(true));
		} catch (e)
		{
			alert(e);
		}
	}

	function CallAutosuggestService(partial_query, api_key)
	{
		let max_results = "10";
		let entity_types_allowed = GetEntitityTypesSelected();
		let query = encodeURIComponent(partial_query);
		let head = "http://dev.virtualearth.net/REST/v1/Autosuggest?query=";
		let user_location = "&userLocation=" + GetUserLocation();
		let max_result_string = "&maxResults=" + max_results;
		let entity_type_string = "&includeEntityTypes=" + entity_types_allowed;
		let culture = "&culture=en-US";
		let key_string = "&key=" + api_key;
		let request = head + query + user_location + max_result_string + entity_type_string + culture + key_string;
		sessionStorage.setItem('response-url', request);
		CallRestService(request, AutoSuggestCallBack);
	}

	// Helper functions 

	// Simple REST AXAJ call

	function CallRestService(request, callback)
	{
		var r = new XMLHttpRequest();
		if ('withCredentials' in r)
		{
			r.open("GET", request, false);
			r.onreadystatechange = function ()
			{
				if (r.readyState == 4 && r.status >= 200 && r.status < 400)
				{
					callback(r.responseText);
				}
				else
				{
					alert('Bad request: ' + r.responseText);
				}
			}
		}
		r.send();
	}

	/*
	// Async with JSONP

	function CallRestService(request, callback) {
		let script = document.createElement('script');
		script.src = request + '&jsonp=' + callback.name;
		script.async = true;
		document.body.appendChild(script);
	}
	*/

	let loadApiKey = () => { return document.getElementById('api-input').value; };
	let Arrayify = (obj) => { return (obj == null) ? JSON.stringify([]) : obj; };

	function LoadListStore(name)
	{
		let obj_string = sessionStorage.getItem(name);
		return JSON.parse(Arrayify(obj_string));
	}

	function ListStoreReset(name)
	{
		sessionStorage.setItem(name, JSON.stringify([]));
	}

	function ListStoreAdd(name, add)
	{
		let obj = LoadListStore(name);
		obj.push(add);
		sessionStorage.setItem(name, JSON.stringify(obj));
	}

	function ListStoreSet(name, entities)
	{
		sessionStorage.setItem(name, JSON.stringify(entities));
	}

	/* 
	
       UI views and models
       
    */

	// Get from check boxes, set the entity types parameter
	function GetEntitityTypesSelected()
	{
		var ret = [];
		for (var i = 1; i < 4; i++)
		{
			let entity_box_name = 'entitybox' + String(i);
			let box = document.getElementById(entity_box_name);
			if (box.checked)
			{
				let val = box.value;
				sessionStorage.setItem('store-' + entity_box_name, true);
				ret.push(val);
			}
		}
		return (ret == []) ? "Business" : ret.join(',');
	}

	function CreateHTML(html, dom, class_names)
	{
		let span = document.createElement(dom);
		span.className = 'badge ' + class_names;
		span.innerHTML = html;
		return span;
	}

	let ClearCards = () => { document.getElementById('card-container').innerHTML = ''; };

	function LoadCards(entities)
	{
		entities.forEach(CreateCard);
		return entities;
	}

	function CreateCardHeaderTitle(entity)
	{
		let header = document.createElement('div');
		header.className = 'col-7 type-label btn btn-light';
		header.addEventListener('mousedown', () => { SetFocus(entity, 'focus'); });
		header.addEventListener('mouseup', () => { location.reload(true); });
		header.innerHTML = entity.label;
		return header;
	}

	function CreateCardHeader(entity, type_badge, entity_badge)
	{
		let children = document.createElement('div');
		children.className = 'card-header row';
		children.style.width = '100%';
		children_container = document.createDocumentFragment();
		children_container.appendChild(CreateCardHeaderTitle(entity));
		children_container.appendChild(type_badge).appendChild(entity_badge);
		children.appendChild(children_container);
		return children;
	}

	function CreateCardContent(entity)
	{
		let content = document.createElement('div');
		content.className = 'card-body';
		content.innerHTML = entity.address;
		return content;
	}

	function CreateCard(entity)
	{
		var entity_badge = CreateHTML(entity.index, 'span', 'float-right btn type-index badge-info');
		var type_badge = CreateHTML(entity.entity_type, 'div', 'col-5 float-right type-badge badge-secondary');
		var card = document.createElement('div');
		card.className = 'card';
		card.appendChild(CreateCardHeader(entity, type_badge, entity_badge));
		card.appendChild(CreateCardContent(entity));
		document.getElementById('card-container').appendChild(card);
	}

	function LoadPage()
	{
		console.log('Loading Page');

		let api_key = loadApiKey();

		for (let i = 0, option = document.createElement('option'); i <= 2; i += 0.5)
		{
			option.innerHTML = String(i);
			document.getElementById('radius-input').appendChild(option);
		}

		// session storage ids
		var storage_pairs = [
			["address-geocode", 'store-address-geocode'],
			["api-input", 'store-api-input'],
			["address-input", 'store-address-input'],
			["radius-input", 'store-radius-input'],
			["partial-query", 'store-partial-query']
		];

		var storage_checkbox_pairs = [
			["entitybox1", 'store-entitybox1'],
			["entitybox2", 'store-entitybox2'],
			["entitybox3", 'store-entitybox3']
		];

		// load stored values
		storage_pairs.forEach(function (pair)
		{
			let item_str = sessionStorage.getItem(pair[1]);
			if (item_str != null)
			{
				document.getElementById(pair[0]).setAttribute("value", item_str);
			}
		});

		let old_query = sessionStorage.getItem('store-partial-query') || '(none)';
		document.getElementById('query-text').innerHTML = old_query;

		//load checkbox values
		storage_checkbox_pairs.forEach(function (pair)
		{
			let val = sessionStorage.getItem(pair[1]);
			document.getElementById(pair[0]).checked = (val == 'true') ? true : false;
		});

		let radius = document.getElementById('radius-input').value;
		sessionStorage.setItem("store-radius-input", radius);

		let response_url = sessionStorage.getItem('response-url');
		if (response_url != null)
		{
			SaveJsonResponseAsLink(response_url);
		}

		// UI interactions
		document.getElementById('user-loc-button').addEventListener('mousedown', () => { SetUserLocationByIP(); });
		document.getElementById('reverse-button').addEventListener('mousedown', () => { ReverseUserAddress(); });
		document.getElementById('api-button').onclick = () => { sessionStorage.setItem("store-api-input", loadApiKey()); };
		document.getElementById('address-geocode').addEventListener('change', () => location.reload(true));
		document.getElementById('radius-input').addEventListener('change', () => { sessionStorage.setItem("store-radius-input", this.value); });
	}

	let BuildBlock = function (entity)
	{
		let block = document.createElement('div');
		block.className = 'btn btn-light';
		block.id = entity.index;
		block.innerHTML = entity.label;
		block.addEventListener('mousedown', () => { SetFocus(entity, 'focus'); });
		block.addEventListener('mouseup', () => { location.reload(true); });
		return block;
	};

	let UpdateAutoListUI = function ()
	{
		if (blocks.innerHTML == '')
		{
			let children_container = document.createDocumentFragment();
			Promise.resolve(children_container)
				.then(function (child)
				{
					let entities = LoadListStore('entity-list');
					for (let i = 0; i < entities.length; i++)
					{
						let block = BuildBlock(entities[i]);
						child.appendChild(block);
					}
					return child;
				})
				.then(child => blocks.appendChild(child));
		}
		blocks.style.display = "block";
	};

	let ClearBlocks = function (query)
	{
		blocks.innerHTML = '';
		blocks.style.display = "none";
		return query;
	};

	let LoadAutoCompleteUI = function ()
	{
		console.log('Loading AC UI');

		let onChange = function ()
		{
			let query = query_bar.value;
			ListStoreReset('entity-list');
			Promise.resolve(query)
				.then(ClearBlocks)
				.then(function (query)
				{
					blocks.innerHTML = '';
					let old_query = sessionStorage.getItem('store-partial-query');
					if (query != '' && old_query != query)
					{
						sessionStorage.setItem('store-partial-query', query);
						console.log('Calling Autosuggest');
						let api_key = loadApiKey();
						CallAutosuggestService(query, api_key);
					}
				})
				.then(ClearFocus);
		};

		query_bar.addEventListener('change', onChange);
		// query_bar.addEventListener('upkey', onChange);
		query_bar.addEventListener('focus', UpdateAutoListUI);
		query_bar.addEventListener('onblur', () => { blocks.style.display = "none"; });
	};

	document.addEventListener('DOMContentLoaded', function ()
	{
		Promise.resolve(null)
			.then(LoadAutoCompleteUI)
			.then(LoadPage)
			.then(ClearCards)
			.then(() => LoadListStore('entity-list'))
			.then(LoadCards)
			.then(LocateUserOnMap)
			.then(RenderMap);
	});
})();
