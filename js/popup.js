/** global: chrome */
/** global: browser */
let activeTab;
let pageHtml;
var convertableApps = {}, convertableUrls = [];

const func = (tabs) => {
  (chrome || browser).runtime.sendMessage({
    id: 'get_apps',
    tab: tabs[0],
    source: 'popup.js',
  }, (response) => {
    activeTab = tabs[0].id;
    pageHtml = response.html;
    // Store external for use on click
    convertableApps = response.convertable_apps;
    convertableUrls = response.tracked_urls;
    replaceDomWhenReady(appsToDomTemplate(response));
  });
};

browser.tabs.query({ active: true, currentWindow: true })
  .then(func)
  .catch(console.error);

$(function() {
   /**
   * Handles click event on </> buttons for code conversion
   */
  $('.detected__app-convert').click(function(e) {
	  e.preventDefault();
	  e.stopPropagation();
	  convertApp($(this).data('type'));
	  console.log("Converting code for: " + $(this).data('type'))
  });

  /**
   * Create tooltips for categories and technologies
   */
  $('.container').tooltip({
    tooltipClass: "custom-ui-tooltip",
    position: { my: "right center", collision: "fit"},
    content: function() {
      htmlResult = ""
      if ($(this).hasClass("detected__app")) {
        title = $(this).find(".detected__app-name").text()
        description = $(this).attr('data_tooltip_left')
        version = $(this).find(".detected__app-version").text()
        img = $(this).find(".detected__app-icon").attr('src')
        htmlResult ="<img class='tooltip_image' src="+ img +">" +
                    "<span class='tooltip_title'>" + title + " " + version + "</span>"+
                    "<p class='tooltip_description'>"+description+"</p>"
      }
      else if ($(this).hasClass("question-mark")) {
        title = $(this).siblings(".detected__category-link").text()
        description = $(this).attr('data_tooltip_left')
        reference = $(this).attr('data_tooltip_reference')
        htmlResult = "<span class='tooltip_title'>"+title+"</span>"+
                     "<p class='tooltip_description'>"+description+"</p>"
        if (reference != "null"){
          htmlResult += "<div class='tooltip_footer'><a target='_blank' href='"+reference+"'><button class='tooltip_button'>Reference</button></a></div>"  
        }    
      }
      return htmlResult
    },
    items: '.tooltip',
    show: null, // show immediately
    open: function(event, ui) {
        if (typeof(event.originalEvent) === 'undefined'){
            return false;
        }
        
        var $id = $(ui.tooltip).attr('id');
        
        // close any lingering tooltips
        $('div.ui-tooltip').not('#' + $id).remove();
        
    },
    close: function(event, ui) {
        ui.tooltip.hover(function() {
            $(this).stop(true).fadeTo(400, 1); 
        }, function() {
            $(this).fadeOut(400, function() {
                $(this).remove();
            });
        });
    }
  });  
});

function convertApp(app) {
  
	var template, content, matches = [];
	console.log(typeof convertableApps[app].regex);
	// Loop through regexes
	var expressions = typeof convertableApps[app].regex === "string" ? [convertableApps[app].regex] : convertableApps[app].regex;
	// Check for matches on the first regex
	for (var i = 0; i < expressions.length; i++) {
		// Check for data on each regex
		var regex = new RegExp(expressions[i], ["i"]);
		// Find pattern in every URL
		for (url in convertableUrls) {
			 result = regex.exec(url);
			 // Set the template only once
			 if (result !== null) {
				 if (!template) {
					 content = convertableApps[app].content;
					 template = convertableApps[app].template;
				 }
				 // Add our result to the matches list
         matches.push(result);
         console.log("found a match in a URL");
				 break;	// stop once we find a match
		 	 }
		}
		// Find pattern in the HTML (on 0 matches)
		if (matches.length < 1) {
      // Check for matches on the first regex
      console.log(pageHtml)
			result = regex.exec(pageHtml);
			console.log(result);
			// Set the template only once
			if (result !== null) {
				if (!template) {
					content = convertableApps[app].content;
					template = convertableApps[app].template;
				}
				// Add our result to the matches list
        matches.push(result);
        console.log("found a match in the HTML");
				break;	// stop once we find a match
		 	}
		}		
	}
	console.log(matches);
	if (template && matches) {
		/*
		console.log("Found a match in: " + url);
		console.log(html);
		console.log(matches);
		console.log(renderAppConversionHtml(html, matches));
		*/
		var html = content ? '<p class="converted-content">' + content + '</p>' : '';
			html += '<pre>' + renderAppConversionHtml(template, matches) + '</pre>';
			// DEBUG
			// html += '<p class="converted-match">Match found in: ' + url + '</p>';
		$('.converter').html(html);
	} else {
		alert('No matches found');
	}
}

function renderAppConversionHtml(html, matches) {
	//
	return html.replace(new RegExp('\\{0}\\}', 'g'), matches[0])
		.replace(new RegExp('<', 'g'), '&lt;');
}

function replaceDomWhenReady(dom) {
  if (/complete|interactive|loaded/.test(document.readyState)) {
    replaceDom(dom);

  } else {
    document.addEventListener('DOMContentLoaded', () => {
      replaceDom(dom);
    });
  }
}

function replaceDom(domTemplate) {
  const container = document.getElementsByClassName('container')[0];

  container.appendChild(jsonToDOM(domTemplate, document, {}));

  const nodes = document.querySelectorAll('[data-i18n]');

  Array.prototype.forEach.call(nodes, (node) => {
    node.childNodes[0].nodeValue = browser.i18n.getMessage(node.dataset.i18n);
  });
}

function appsToDomTemplate(response) {
  
  let amp_supported_template = [];
  let amp_work_around_template = [];
  let amp_not_supported_template = [];
  //Default template is empty
  let template = [
      'div', {
        class: 'empty',
      },
      [
        'span', {
          class: 'empty__text',
        },
        browser.i18n.getMessage('noAppsDetected'),
      ],
    ];
  //Control what categories of apps we will use
  // let approved_categories = [1,5,6,10,11,32,36,41,42,52];
  let approved_categories = [1,5,6,10,11,12,16,18,32,36,41,42,52,59]; //Original set
  

  if (response.tabCache && Object.keys(response.tabCache.detected).length > 0) {
    const categories = {};

    // Group apps by category
    for (const appName in response.tabCache.detected) {
      response.apps[appName].cats.forEach((cat) => {
        if (approved_categories.includes(cat)){
          categories[cat] = categories[cat] || { apps: [] };
          categories[cat].apps[appName] = appName;
        }
      });
    }

    //Check if we have any relevant technologies
    if (Object.keys(categories).length > 0) {

      for (const cat in categories) {
        const amp_supported_apps = [];
        const amp_work_around_apps = [];
        const amp_not_supported_apps = [];

        for (const appName in categories[cat].apps) {
          const confidence = response.tabCache.detected[appName].confidenceTotal;
          const version = response.tabCache.detected[appName].version;
          if(isAMPSupported(appName, response.supported_apps)){
            convertable = isAMPConvertable(appName, response.convertable_apps);
        // console.log(convertable);			
            amp_supported_apps.push(
              [
                    'a', {
                  class: 'detected__app',
                  target: '_blank',
                  href: `${response.apps[appName].website}`,
                }, [
                  'img', {
                    class: 'detected__app-icon',
                    src: `${locateIcon(appName, response.apps)}` ,
                  },
                ], [
                  'span', {
                    class: 'detected__app-name',
                  },
                  appName,
                ], version ? [
                  'span', {
                    class: 'detected__app-version',
                  },
                  version,
                ] : null, confidence < 100 ? [
                  'span', {
                    class: 'detected__app-confidence',
                  },
                  `${confidence}% sure`,
                ] : null, convertable ? [
                'span', {
                    class: 'detected__app-convert',
            title: 'Convert to AMP HTML',
              "data-type": appName
                  }, 
          '</>'
                ] : null
        ]
            );
          } else if(isAMPIncompatible(appName, response.incompatible_apps)){
            amp_not_supported_apps.push(
              [
                'a', {
                  class: `${technologyHasTooltip(appName, response.tech_tooltips) ? 'tooltip':''} detected__app`,
                  data_tooltip_left: `${technologyHasTooltip(appName, response.tech_tooltips) ? response.tech_tooltips[appName]:''}`,
                  target: '_blank',
                  href: `${response.apps[appName].website}`,
                }, [
                  'img', {
                    class: 'detected__app-icon',
                    src: `${locateIcon(appName, response.apps)}` ,
                  },
                ], [
                  'span', {
                    class: 'detected__app-name',
                  },
                  appName,
                ], version ? [
                  'span', {
                    class: 'detected__app-version',
                  },
                  version,
                ] : null, confidence < 100 ? [
                  'span', {
                    class: 'detected__app-confidence',
                  },
                  `${confidence}% sure`,
                ] : null,
              ],
            );
          } else {
            amp_work_around_apps.push(
              [
                'a', {
                  class: `${technologyHasTooltip(appName, response.tech_tooltips) ? 'tooltip':''} detected__app`,
                  data_tooltip_left: `${technologyHasTooltip(appName, response.tech_tooltips) ? response.tech_tooltips[appName]:''}`,
                  target: '_blank',
                  href: `${response.apps[appName].website}`,
                }, [
                  'img', {
                    class: 'detected__app-icon',
                    src: `${locateIcon(appName, response.apps)}` ,
                  },
                ], [
                  'span', {
                    class: 'detected__app-name',
                  },
                  appName,
                ], version ? [
                  'span', {
                    class: 'detected__app-version',
                  },
                  version,
                ] : null, confidence < 100 ? [
                  'span', {
                    class: 'detected__app-confidence',
                  },
                  `${confidence}% sure`,
                ] : null,
              ],
            );
          }
        }
        if(amp_supported_apps.length != 0){
          amp_supported_template.push(
              [
                'div', {
                  class: 'detected__category',
                }, [
                  'div', {
                    class: 'detected__category-name',
                  }, [
                    'a', {
                      class: 'detected__category-link',
                      target: '_blank',
                      href: `https://www.wappalyzer.com/categories/${response.categories[cat].name}`,
                    },
                    browser.i18n.getMessage(`categoryName${cat}`),
                  ],
                ], [
                  'div', {
                    class: 'detected__apps',
                  },
                  amp_supported_apps,
                ],
              ],
            );
        }
        if(amp_work_around_apps.length != 0){
          amp_work_around_template.push(
              [
                'div', {
                  class: 'detected__category',
                }, [
                  'div', {
                    class: 'detected__category-name',
                  }, [
                    'a', {
                      class: 'detected__category-link',
                      target: '_blank',
                      href: `https://www.wappalyzer.com/categories/${response.categories[cat].name}`,
                    },
                    browser.i18n.getMessage(`categoryName${cat}`),
                  ], [
                    'span', {
                      class: `${categoryHasTooltip(cat, response.conv_cat_tooltips) ? 'tooltip question-mark':'no-tooltip'}`,
                      data_tooltip_left: `${categoryHasTooltip(cat, response.conv_cat_tooltips) ? response.conv_cat_tooltips[cat]["content"]:''}`,
                      data_tooltip_reference: `${categoryHasTooltip(cat, response.conv_cat_tooltips) ? response.conv_cat_tooltips[cat]["reference"]:''}`
                    },
                    "    (?)"
                  ]
                ], [
                  'div', {
                    class: 'detected__apps',
                  },
                  amp_work_around_apps,
                ],
              ],
            );
        }
        if(amp_not_supported_apps.length != 0){
          amp_not_supported_template.push(
              [
                'div', {
                  class: 'detected__category',
                }, [
                  'div', {
                    class: 'detected__category-name',
                  }, [
                    'a', {
                      class: 'detected__category-link',
                      target: '_blank',
                      href: `https://www.wappalyzer.com/categories/${response.categories[cat].name}`,
                    },
                    browser.i18n.getMessage(`categoryName${cat}`),
                  ], [
                    [
                      'span', {
                        class: `${categoryHasTooltip(cat, response.incom_cat_tooltips) ? 'tooltip question-mark':'no-tooltip'}`,
                        data_tooltip_left: `${categoryHasTooltip(cat, response.incom_cat_tooltips) ? response.incom_cat_tooltips[cat]:''}`,
                      },
                      "    (?)"
                    ]
                  ],
                ], [
                  'div', {
                    class: 'detected__apps',
                  },
                  amp_not_supported_apps,
                ],
              ],
            );
        }
      }
      
      //Change template when we have detected apps that are AMP relevant
      template = [
            [
              'div', {
                class: 'amp_supported card',
              },
              amp_supported_template,
            ],
            [
              'div', {
                class: 'amp_work_around card',
              },
              amp_work_around_template,
            ],
            [
              'div', {
                class: 'amp_not_supported card',
              },
              amp_not_supported_template,
            ]
          ];
    }
  }
  return template;
}


/**
 * TODO (alwalton@): get list of supported ads/analytics programatically
 * Check if vendor is in supported list of vendor names
 * @param {string} vendorName - name of vendor
 * @return {boolean}
 */
function isAMPSupported(appName, supported_array) {
  console.log("testing AMP support for " + appName);
  return supported_array.includes(appName);
}

function isAMPConvertable(appName, convertable_array) {
    console.log("testing AMP convertability for " + appName);
    return convertable_array.hasOwnProperty(appName);
}

function isAMPIncompatible(appName, incompatible_array) {
  console.log("testing AMP incompatibility for " + appName);
  return incompatible_array.includes(appName);
}

function categoryHasTooltip(category, categoryTooltipArray) {
  console.log("check for tooltip for " + category);
  return categoryTooltipArray.hasOwnProperty(category);
}

function technologyHasTooltip(technology, technologyTooltipArray) {
  console.log("check for tooltip for " + technology);
  return technologyTooltipArray.hasOwnProperty(technology);
}

function locateIcon(appName, app_array) {
  if ("extended" in app_array[appName] || app_array[appName].icon.slice(-4) === ".svg"){
    return "/images/icons/" + app_array[appName].icon;
  } else {
    return "https://raw.githubusercontent.com/AliasIO/Wappalyzer/master/src/icons/" + app_array[appName].icon;
  }
}

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-58015925-3']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();