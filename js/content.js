/** global: browser */
/** global: XMLSerializer */

if (typeof browser !== 'undefined' && typeof document.body !== 'undefined') {
  try {
    sendMessage('init', {});

    // HTML
    let html = new XMLSerializer().serializeToString(document).split('\n');

    html = html
      .slice(0, 1000).concat(html.slice(html.length - 1000))
      .map(line => line.substring(0, 1000))
      .join('\n');

    // Scripts
    const scripts = Array.prototype.slice
      .apply(document.scripts)
      .filter(script => script.src)
      .map(script => script.src)
      .filter(script => script.indexOf('data:text/javascript;') !== 0);

    sendMessage('analyze', { html, scripts });

    // JavaScript variables
    const script = document.createElement('script');

    script.onload = () => {
      const onMessage = (event) => {
        if (event.data.id !== 'js') {
          return;
        }

        removeEventListener('message', onMessage);

        sendMessage('analyze', { js: event.data.js });

        script.remove();
      };

      addEventListener('message', onMessage);

      sendMessage('get_js_patterns', {}, (response) => {
        if (response) {
          postMessage({
            id: 'patterns',
            patterns: response.patterns,
          }, '*');
        }
      });
    };

    script.setAttribute('src', browser.extension.getURL('js/inject.js'));

    $('div.title-container').tooltip({
      content: 'Loading…',
      show: null, // show immediately
      open: function(event, ui)
      {
          if (typeof(event.originalEvent) === 'undefined')
          {
              return false;
          }
      
          var $id = $(ui.tooltip).attr('id');
      
          // close any lingering tooltips
          $('div.ui-tooltip').not('#' + $id).remove();
          
          // ajax function to pull in data and add it to the tooltip goes here
      },
      close: function(event, ui)
      {
          ui.tooltip.hover(function()
          {
              $(this).stop(true).fadeTo(400, 1); 
          },
          function()
          {
              $(this).fadeOut('400', function()
              {
                  $(this).remove();
              });
          });
      }
    });

    document.body.appendChild(script);
  } catch (e) {
    sendMessage('log', e);
  }

}

function sendMessage(id, subject, callback) {
  (chrome || browser).runtime.sendMessage({
    id,
    subject,
    source: 'content.js',
  }, callback || (() => {}));
}

// https://stackoverflow.com/a/44774834
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/executeScript#Return_value
undefined;
