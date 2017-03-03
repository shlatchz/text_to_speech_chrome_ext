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
var confidenceThresh = 0.8;
// Supported languages.
var audioTypes = [ { lang: "German", code: "de", voice: "de-DE_BirgitVoice" }, 
				   { lang: "English", code: "en", voice: "en-US_AllisonVoice" }, 
				   { lang: "Spanish", code: "es", voice: "es-ES_LauraVoice" }, 
				   { lang: "French", code: "fr", voice: "fr-FR_ReneeVoice" }, 
				   { lang: "Italian", code: "it", voice: "it-IT_FrancescaVoice" }, 
				   { lang: "Japanese", code: "ja", voice: "ja-JP_EmiVoice" }, 
				   { lang: "Portuguese", code: "pt", voice: "pt-BR_IsabelaVoice" }];

function textToSpeech(data){
	var input = data.selectionText;
	var srcLanguage = data.menuItemId;
	var ttsCred = btoa(apis.textToSpeech.auth.username + ":" + apis.textToSpeech.auth.password);
	var transCred = btoa(apis.translate.auth.username + ":" + apis.translate.auth.password);
	function handleErr(error) {
		console.error(error);
	}
	// Read selected input using selected voice.
	function readInput(input, voice, successCallback, errorCallback) {
		getToken(ttsCred, function (token) {
			getAudioStream(token, input, voice, function (audio) {
				var player = new Audio(window.URL.createObjectURL(audio));
				player.play();
			}, errorCallback);
		}, errorCallback);
	}
	// Identify language and read input in that language.
	function identifyAndReadInput(input, errorCallback) {
		identifyLanguage(transCred, input, function (code) {
			var foundVoice = audioTypes[1].voice;
			// Check if supported by Text To Speech.
			audioTypes.forEach(function(elem) {
				if (elem.code === code) {
					foundVoice = elem.voice;
				}
			});
			readInput(input, foundVoice, errorCallback);
		}, function (error) {
			if (error === "NOT_FOUND") {
				var foundVoice = audioTypes[1].voice;
				readInput(input, foundVoice, errorCallback);
			}
			else {
				errorCallback(error);
			}
		});
	}
	// Read input in text's language.
	if (data.menuItemId === "tts_read") {
		identifyAndReadInput(input, handleErr);
	// Translate input to english and read it.
	} else if (data.menuItemId === "tts_trans") {
		identifyLanguage(transCred, input, function (code) {
			translateLanguage(transCred, input, code, function (newInput) {
				var voice = audioTypes[1].voice;
				readInput(newInput, voice, handleErr);
			}, function (error) {
				if (error === "NOT_FOUND") {
					identifyAndReadInput(input, handleErr);
				}
				else {
					handleErr(error);
				}
			});
		}, function (error) {
			if (error === "NOT_FOUND") {
				var voice = audioTypes[1].voice;
				readInput(input, voice, handleErr);
			}
			else {
				handleErr(error);
			}
		});
	// Translate input using given source language and then read it.
	} else {
		translateLanguage(transCred, input, srcLanguage, function (newInput) {
			var voice = audioTypes[1].voice;
			readInput(newInput, voice, handleErr);
		}, function (error) {
			if (error === "NOT_FOUND") {
				identifyAndReadInput(input, handleErr);
			}
			else {
				handleErr(error);
			}
		});
	}
};

function getToken(cred, successCallback, errorCallback) {
	var fetchURI = "https://" + apis.textToSpeech.tokenURI + "?url=" + "https://" + apis.textToSpeech.mainURI;
	
	fetch(fetchURI, {
		method: "GET",
		headers: {
			"Authorization": "Basic " + cred
		}
	}).then(function (response) {
		if (response.status === 200 || response.status === 206) {
			response.text().then(successCallback);
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

function identifyLanguage(cred, input, successCallback, errorCallback) {
	var fetchURI = "https://" + apis.translate.mainURI + "identify";
	var form = new FormData();
	form.append("data", input);
	
	fetch(fetchURI, {
		method: "POST",
		headers: {
			"Authorization": "Basic " + cred,
			"Content-Type" : "text/plain",
			"Accept": "application/json"
		},
		body: form
	}).then(function (response) {
		if (response.status === 200 || response.status === 206) {
			response.json().then(function (resp) {
				var languages = resp.languages;
				// Languages found.
				if (languages.length > 0) {
					var bestLang = languages[0];
					console.dir(bestLang);
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
			});
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

function translateLanguage(cred, input, src, successCallback, errorCallback) {
	var fetchURI = "https://" + apis.translate.mainURI + "translate";
	var data = {
		"text": input,
		"source": src,
		"target": "en"
	}
	
	fetch(fetchURI, {
		method: "POST",
		headers: {
			"Authorization": "Basic " + cred,
			"Content-Type" : "application/json",
			"Accept": "application/json"
		},
		body: JSON.stringify(data)
	}).then(function (response) {
		if (response.status === 200 || response.status === 206) {
			response.json().then(function (resp) {
				var translations = resp.translations;
				// Translations found.
				if (translations.length > 0) {
					var newInput = translations[0].translation;
					if (newInput !== input) {
						successCallback(newInput);
					}
					else {
						errorCallback("NOT_FOUND");
					}
				}
				else {
					errorCallback("NOT_FOUND");
				}
			});
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

function getAudioStream(token, input, voice, successCallback, errorCallback) {
	var format = 'audio/ogg;codecs=opus';

	var wsURI = "wss://" + apis.textToSpeech.mainURI + "/v1/synthesize?voice=" + voice + "&watson-token=" + token;

	var websocket = new WebSocket(wsURI);
	websocket.onopen = onOpen;
	websocket.onclose = onClose;
	websocket.onmessage = onMessage;
	websocket.onerror = onError;

	function onOpen(evt) {
	  var message = {
		text: input,
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

