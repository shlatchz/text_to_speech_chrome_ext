var apis = {
			  textToSpeech: {
				// Enter your Watson Text To Speech API credentials here.
			        auth: { username: "{user-name}", password: "{password}" },
				tokenURI: "stream.watsonplatform.net/authorization/api/v1/token",
				mainURI: "stream.watsonplatform.net/text-to-speech/api"
			  },
			  translate: {
				// Enter your Watson Translate API credentials here.
				auth: { username: "{user-name}", password: "{password}"},
				mainURI: "gateway.watsonplatform.net/language-translator/api/v2/"
			  },
			};
// Identified language must have confidence above threshold.
var confidenceThresh = 0.8;
// Supported languages.
var audioTypes = [ { lang: "German", code: "de", voice: "de-DE_BirgitVoice" }, 
				   { lang: "English", code: "en", voice: "en-US_AllisonVoice" }, 
				   { lang: "Spanish", code: "es", voice: "es-ES_LauraVoice" }, 
				   { lang: "French", code: "fr", voice: "fr-FR_ReneeVoice" }, 
				   { lang: "Italian", code: "it", voice: "it-IT_FrancescaVoice" }, 
				   { lang: "Japanese", code: "ja", voice: "ja-JP_EmiVoice" }, 
				   { lang: "Portuguese", code: "pt", voice: "pt-BR_IsabelaVoice" }];

function textToSpeech(data) {
	var options = {
		input: data.selectionText,
		srcLanguage: data.menuItemId
	};
	var ttsCred = btoa(apis.textToSpeech.auth.username + ":" + apis.textToSpeech.auth.password);
	var transCred = btoa(apis.translate.auth.username + ":" + apis.translate.auth.password);
	function handleErr(error) {
		console.error(error);
	}
	// Read selected input using selected voice.
	function readInput(options, successCallback, errorCallback) {
		options.cred = ttsCred;
		// Get token for text-to-speech.
		getToken(options, function (token) {
			options.token = token;
			// Get audio of text-to-speech conversion.
			getAudioStream(options, function (audio) {
				// Play audio.
				var player = new Audio(window.URL.createObjectURL(audio));
				player.play();
			}, errorCallback);
		}, errorCallback);
	}
	// Find language in supported languages and read input in that language.
	function verifyAndReadInput(options, errorCallback) {
		var foundVoice = audioTypes[1].voice;
		// Check if language supported by Text To Speech.
		audioTypes.forEach(function(elem) {
			if (elem.code === options.srcLanguage) {
				foundVoice = elem.voice;
			}
		});
		options.voice = foundVoice;
		readInput(options, errorCallback);
	}
	// Identify language and return it.
	function identifyAndReadInput(options, successCallback, errorCallback) {
		options.cred = transCred;
		identifyLanguage(options, function (code) {
			options.srcLanguage = code;
			successCallback(options, errorCallback);
		}, function (error) {
			if (error === "NOT_FOUND") {
				var foundVoice = audioTypes[1].voice;
				options.voice = foundVoice;
				readInput(options, errorCallback);
			}
			else {
				errorCallback(error);
			}
		});
	}
	// Translate input from given language to english and read input in english.
	function translateAndReadInput(options, errorCallback) {
		options.cred = transCred;
		translateLanguage(options, function (newInput) {
			var voice = audioTypes[1].voice;
			options.input = newInput;
			options.voice = voice;
			readInput(options, errorCallback);
		}, function (error) {
			if (error === "NOT_FOUND") {
				identifyAndReadInput(options, verifyAndReadInput, errorCallback);
			}
			else {
				errorCallback(error);
			}
		});
	}
	// Read input in text's language.
	if (data.menuItemId === "tts_read") {
		identifyAndReadInput(options, verifyAndReadInput, handleErr);
	// Translate input to english and read it.
	} else if (data.menuItemId === "tts_trans") {
		identifyAndReadInput(options, translateAndReadInput, handleErr);
	// Translate input using given source language and then read it.
	} else {
		translateAndReadInput(options, handleErr);
	}
};

function callWatsonAPI(options, successCallback, errorCallback) {
	fetch(options.uri, {
		method: options.method,
		headers: {
			"Authorization": "Basic " + options.cred,
			"Content-Type" : options.reqType,
			"Accept": options.respType
		},
		body: options.body
	}).then(function (response) {
		if (response.status === 200 || response.status === 206) {
			if (options.respType === "application/json") {
				response.json().then(successCallback);
			}
			else {
				response.text().then(successCallback);
			}
		}
		else if (response.status === 403) {
			errorCallback("FORBIDDEN");
		}
		else if (response.status === 404) {
			errorCallback("NOT_FOUND");
		}
		else {
			errorCallback("FAILED");
		}
	});
}

function getToken(options, successCallback, errorCallback) {
	options.method = "GET";
	options.reqType = "text/plain";
	options.respType = "text/plain";
	options.uri = "https://" + apis.textToSpeech.tokenURI + "?url=" + "https://" + apis.textToSpeech.mainURI;
	delete options.body;
	callWatsonAPI(options, successCallback, errorCallback);
}

function identifyLanguage(options, successCallback, errorCallback) {
	var formData = new FormData();
	formData.append("data", options.input);
	options.method = "POST";
	options.reqType = "text/plain";
	options.respType = "application/json";
	options.body = formData;
	options.uri = "https://" + apis.translate.mainURI + "identify";
	callWatsonAPI(options, function (resp) {
		var languages = resp.languages;
		// Languages found.
		if (languages.length > 0) {
			var bestLang = languages[0];
			var found = false;
			// Check if found language passes confidence threshold.
			if (bestLang.confidence >= confidenceThresh) {
				// Check if supported by Text To Speech.
				audioTypes.forEach(function(elem) {
					if (elem.code === bestLang.language) {
						successCallback(elem.code);
						found = true;
					}
				});
			}
		}
		if (!found) {
			errorCallback("NOT_FOUND");
		}
	}, errorCallback);
}

function translateLanguage(options, successCallback, errorCallback) {
	var oldInput = options.input;
	var jsonData = {
		"text": oldInput,
		"source": options.srcLanguage,
		"target": "en"
	}
	options.method = "POST";
	options.reqType = "application/json",
	options.respType = "application/json";
	options.body = JSON.stringify(jsonData);
	options.uri = "https://" + apis.translate.mainURI + "translate";
	callWatsonAPI(options, function (resp) {
		var translations = resp.translations;
		// Translations found.
		if (translations.length > 0) {
			var newInput = translations[0].translation;
			if (newInput !== oldInput) {
				successCallback(newInput);
			}
			else {
				errorCallback("NOT_FOUND");
			}
		}
		else {
			errorCallback("NOT_FOUND");
		}
	}, errorCallback);
}

function getAudioStream(options, successCallback, errorCallback) {
	var format = 'audio/ogg;codecs=opus';
	var uri = "wss://" + apis.textToSpeech.mainURI + "/v1/synthesize?voice=" + options.voice + "&watson-token=" + options.token;

	var websocket = new WebSocket(uri);
	websocket.onopen = onOpen;
	websocket.onclose = onClose;
	websocket.onmessage = onMessage;
	websocket.onerror = onError;

	function onOpen(evt) {
	  var message = {
		text: options.input,
		accept: format
	  };
	  websocket.send(JSON.stringify(message));
	}

	var audioParts = [];
	var finalAudio;

	function onMessage(evt) {
	  if (typeof evt.data === 'string') {
		//console.log('Received string message: ', evt.data)
	  } else {
		audioParts.push(evt.data);
	  }
	}

	function onClose(evt) {
	  finalAudio = new Blob(audioParts, {type: format});
	  successCallback(finalAudio);
	}

	function onError(evt) {
	  console.error('WebSocket error', evt);
	  errorCallback("FAILED");
	}
}

chrome.contextMenus.create({
  title: "Read",
  contexts:["selection"],
  id: "tts_read",
  onclick: textToSpeech
});
chrome.contextMenus.create({
  title: "Translate",
  contexts:["selection"],
  id: "tts_trans",
  onclick: textToSpeech
});
chrome.contextMenus.create({
  title: "Translate From...",
  contexts:["selection"],
  id: "tts_trans_from"
});
audioTypes.forEach(function (elem, index) {
	if (elem.code !== "en") {
		chrome.contextMenus.create({
		  title: elem.lang,
		  id: elem.code,
		  parentId: "tts_trans_from",
		  contexts:["selection"],
		  onclick: textToSpeech
		});
	}
});
