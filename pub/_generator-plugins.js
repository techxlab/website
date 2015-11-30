(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * jqueryview.js
 *
 * pub-pager nav handler for jquery single-page-app views
 * listens for 'nav', 'loaded', and 'updatedText' events
 * emits 'update-view' when content has been replaced
 *
 * minimize html replacements by looking for attributes
 * data-render-layout
 * data-render-page
 * data-render-html
 *
 * copyright 2015, Jurgen Leschner - github.com/jldec - MIT license
**/

module.exports = function(generator) {

  var opts = generator.opts;
  var u = generator.util;
  var lang = generator.handlebars.pageLang;
  var log = opts.log;

  // if there is no data-render-layout attribute, updateLayout does nothing
  var $layout = $('[data-render-layout]');

  // cache last page - TODO - find lastPage using location on startup
  var lastPage = null;

  var view = {
    start: start, // call start() after views are created
    stop: stop    // call stop() before views are deleted
  };

  return view;

  function start() {
    generator.on('nav', updatePage);         // SPA click
    generator.on('loaded', reloadPage);      // full reload after structural edit
    generator.on('updatedText', updateHtml); // editor update
  }

  function stop() {
    generator.off('nav', updatePage);
    generator.off('loaded', reloadPage);
    generator.off('updatedText', updateHtml);
  }

  function reloadPage() {
    if (!lastPage) return;
    if (!$layout.length) { updatePage(lastPage); }
    else { updateLayout(lastPage); }
  }

  function updatePage(page) {
    if (layoutChanged(page)) return updateLayout(page);
    var $page = $('[data-render-page]');
    if (!$page.length) return log('jqueryview cannot update page ' + path);
    generator.emit('before-update-view', $page);
    $page.replaceWith(generator.renderPage(page));
    generator.emit('after-update-view', $page);
    lastPage = page;
  }

  function updateLayout(page) {
    if (!page || !$layout.length) return;
    var layout = generator.layoutTemplate(page);
    generator.emit('before-update-view', $layout);
    $layout.replaceWith(generator.renderLayout(page));
    generator.emit('after-update-view', $layout);
    lastPage = page;
  }

  // return true if new layout is different from current page layout
  function layoutChanged(page) {
    if (!$layout.length) return false;
    if (!lastPage || lastPage.fixlayout || lang(lastPage) !== lang(page)) return true;
    var currentlayout = $layout.attr('data-render-layout') || 'main-layout';
    var newlayout = generator.layoutTemplate(page);
    return (newlayout !== currentlayout);
  }

  // this won't work if the href of a fragment is edited
  function updateHtml(href) {
    var fragment = generator.fragment$[href];
    if (!fragment) return log('jqueryview cannot find fragment: ' + href);

    var $html = $('[data-render-html="' + href + '"]');
    if (!$html.length) return log('jqueryview cannot update html for fragment: ' + href);

    generator.emit('before-update-view', $html);
    $html.replaceWith(generator.renderHtml(fragment));
    generator.emit('after-update-view', $html);
  }

}

},{}],2:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":3}],3:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":4}],4:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],5:[function(require,module,exports){
(function (process){
  /* globals require, module */

  'use strict';

  /**
   * Module dependencies.
   */

  var pathtoRegexp = require('path-to-regexp');

  /**
   * Module exports.
   */

  module.exports = page;

  /**
   * Detect click event
   */
  var clickEvent = ('undefined' !== typeof document) && document.ontouchstart ? 'touchstart' : 'click';

  /**
   * To work properly with the URL
   * history.location generated polyfill in https://github.com/devote/HTML5-History-API
   */

  var location = ('undefined' !== typeof window) && (window.history.location || window.location);

  /**
   * Perform initial dispatch.
   */

  var dispatch = true;


  /**
   * Decode URL components (query string, pathname, hash).
   * Accommodates both regular percent encoding and x-www-form-urlencoded format.
   */
  var decodeURLComponents = true;

  /**
   * Base path.
   */

  var base = '';

  /**
   * Running flag.
   */

  var running;

  /**
   * HashBang option
   */

  var hashbang = false;

  /**
   * Previous context, for capturing
   * page exit events.
   */

  var prevContext;

  /**
   * Register `path` with callback `fn()`,
   * or route `path`, or redirection,
   * or `page.start()`.
   *
   *   page(fn);
   *   page('*', fn);
   *   page('/user/:id', load, user);
   *   page('/user/' + user.id, { some: 'thing' });
   *   page('/user/' + user.id);
   *   page('/from', '/to')
   *   page();
   *
   * @param {String|Function} path
   * @param {Function} fn...
   * @api public
   */

  function page(path, fn) {
    // <callback>
    if ('function' === typeof path) {
      return page('*', path);
    }

    // route <path> to <callback ...>
    if ('function' === typeof fn) {
      var route = new Route(path);
      for (var i = 1; i < arguments.length; ++i) {
        page.callbacks.push(route.middleware(arguments[i]));
      }
      // show <path> with [state]
    } else if ('string' === typeof path) {
      page['string' === typeof fn ? 'redirect' : 'show'](path, fn);
      // start [options]
    } else {
      page.start(path);
    }
  }

  /**
   * Callback functions.
   */

  page.callbacks = [];
  page.exits = [];

  /**
   * Current path being processed
   * @type {String}
   */
  page.current = '';

  /**
   * Number of pages navigated to.
   * @type {number}
   *
   *     page.len == 0;
   *     page('/login');
   *     page.len == 1;
   */

  page.len = 0;

  /**
   * Get or set basepath to `path`.
   *
   * @param {String} path
   * @api public
   */

  page.base = function(path) {
    if (0 === arguments.length) return base;
    base = path;
  };

  /**
   * Bind with the given `options`.
   *
   * Options:
   *
   *    - `click` bind to click events [true]
   *    - `popstate` bind to popstate [true]
   *    - `dispatch` perform initial dispatch [true]
   *
   * @param {Object} options
   * @api public
   */

  page.start = function(options) {
    options = options || {};
    if (running) return;
    running = true;
    if (false === options.dispatch) dispatch = false;
    if (false === options.decodeURLComponents) decodeURLComponents = false;
    if (false !== options.popstate) window.addEventListener('popstate', onpopstate, false);
    if (false !== options.click) {
      document.addEventListener(clickEvent, onclick, false);
    }
    if (true === options.hashbang) hashbang = true;
    if (!dispatch) return;
    var url = (hashbang && ~location.hash.indexOf('#!')) ? location.hash.substr(2) + location.search : location.pathname + location.search + location.hash;
    page.replace(url, null, true, dispatch);
  };

  /**
   * Unbind click and popstate event handlers.
   *
   * @api public
   */

  page.stop = function() {
    if (!running) return;
    page.current = '';
    page.len = 0;
    running = false;
    document.removeEventListener(clickEvent, onclick, false);
    window.removeEventListener('popstate', onpopstate, false);
  };

  /**
   * Show `path` with optional `state` object.
   *
   * @param {String} path
   * @param {Object} state
   * @param {Boolean} dispatch
   * @return {Context}
   * @api public
   */

  page.show = function(path, state, dispatch, push) {
    var ctx = new Context(path, state);
    page.current = ctx.path;
    if (false !== dispatch) page.dispatch(ctx);
    if (false !== ctx.handled && false !== push) ctx.pushState();
    return ctx;
  };

  /**
   * Goes back in the history
   * Back should always let the current route push state and then go back.
   *
   * @param {String} path - fallback path to go back if no more history exists, if undefined defaults to page.base
   * @param {Object} [state]
   * @api public
   */

  page.back = function(path, state) {
    if (page.len > 0) {
      // this may need more testing to see if all browsers
      // wait for the next tick to go back in history
      history.back();
      page.len--;
    } else if (path) {
      setTimeout(function() {
        page.show(path, state);
      });
    }else{
      setTimeout(function() {
        page.show(base, state);
      });
    }
  };


  /**
   * Register route to redirect from one path to other
   * or just redirect to another route
   *
   * @param {String} from - if param 'to' is undefined redirects to 'from'
   * @param {String} [to]
   * @api public
   */
  page.redirect = function(from, to) {
    // Define route from a path to another
    if ('string' === typeof from && 'string' === typeof to) {
      page(from, function(e) {
        setTimeout(function() {
          page.replace(to);
        }, 0);
      });
    }

    // Wait for the push state and replace it with another
    if ('string' === typeof from && 'undefined' === typeof to) {
      setTimeout(function() {
        page.replace(from);
      }, 0);
    }
  };

  /**
   * Replace `path` with optional `state` object.
   *
   * @param {String} path
   * @param {Object} state
   * @return {Context}
   * @api public
   */


  page.replace = function(path, state, init, dispatch) {
    var ctx = new Context(path, state);
    page.current = ctx.path;
    ctx.init = init;
    ctx.save(); // save before dispatching, which may redirect
    if (false !== dispatch) page.dispatch(ctx);
    return ctx;
  };

  /**
   * Dispatch the given `ctx`.
   *
   * @param {Object} ctx
   * @api private
   */

  page.dispatch = function(ctx) {
    var prev = prevContext,
      i = 0,
      j = 0;

    prevContext = ctx;

    function nextExit() {
      var fn = page.exits[j++];
      if (!fn) return nextEnter();
      fn(prev, nextExit);
    }

    function nextEnter() {
      var fn = page.callbacks[i++];

      if (ctx.path !== page.current) {
        ctx.handled = false;
        return;
      }
      if (!fn) return unhandled(ctx);
      fn(ctx, nextEnter);
    }

    if (prev) {
      nextExit();
    } else {
      nextEnter();
    }
  };

  /**
   * Unhandled `ctx`. When it's not the initial
   * popstate then redirect. If you wish to handle
   * 404s on your own use `page('*', callback)`.
   *
   * @param {Context} ctx
   * @api private
   */

  function unhandled(ctx) {
    if (ctx.handled) return;
    var current;

    if (hashbang) {
      current = base + location.hash.replace('#!', '');
    } else {
      current = location.pathname + location.search;
    }

    if (current === ctx.canonicalPath) return;
    page.stop();
    ctx.handled = false;
    location.href = ctx.canonicalPath;
  }

  /**
   * Register an exit route on `path` with
   * callback `fn()`, which will be called
   * on the previous context when a new
   * page is visited.
   */
  page.exit = function(path, fn) {
    if (typeof path === 'function') {
      return page.exit('*', path);
    }

    var route = new Route(path);
    for (var i = 1; i < arguments.length; ++i) {
      page.exits.push(route.middleware(arguments[i]));
    }
  };

  /**
   * Remove URL encoding from the given `str`.
   * Accommodates whitespace in both x-www-form-urlencoded
   * and regular percent-encoded form.
   *
   * @param {str} URL component to decode
   */
  function decodeURLEncodedURIComponent(val) {
    if (typeof val !== 'string') { return val; }
    return decodeURLComponents ? decodeURIComponent(val.replace(/\+/g, ' ')) : val;
  }

  /**
   * Initialize a new "request" `Context`
   * with the given `path` and optional initial `state`.
   *
   * @param {String} path
   * @param {Object} state
   * @api public
   */

  function Context(path, state) {
    if ('/' === path[0] && 0 !== path.indexOf(base)) path = base + (hashbang ? '#!' : '') + path;
    var i = path.indexOf('?');

    this.canonicalPath = path;
    this.path = path.replace(base, '') || '/';
    if (hashbang) this.path = this.path.replace('#!', '') || '/';

    this.title = document.title;
    this.state = state || {};
    this.state.path = path;
    this.querystring = ~i ? decodeURLEncodedURIComponent(path.slice(i + 1)) : '';
    this.pathname = decodeURLEncodedURIComponent(~i ? path.slice(0, i) : path);
    this.params = {};

    // fragment
    this.hash = '';
    if (!hashbang) {
      if (!~this.path.indexOf('#')) return;
      var parts = this.path.split('#');
      this.path = parts[0];
      this.hash = decodeURLEncodedURIComponent(parts[1]) || '';
      this.querystring = this.querystring.split('#')[0];
    }
  }

  /**
   * Expose `Context`.
   */

  page.Context = Context;

  /**
   * Push state.
   *
   * @api private
   */

  Context.prototype.pushState = function() {
    page.len++;
    history.pushState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
  };

  /**
   * Save the context state.
   *
   * @api public
   */

  Context.prototype.save = function() {
    history.replaceState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
  };

  /**
   * Initialize `Route` with the given HTTP `path`,
   * and an array of `callbacks` and `options`.
   *
   * Options:
   *
   *   - `sensitive`    enable case-sensitive routes
   *   - `strict`       enable strict matching for trailing slashes
   *
   * @param {String} path
   * @param {Object} options.
   * @api private
   */

  function Route(path, options) {
    options = options || {};
    this.path = (path === '*') ? '(.*)' : path;
    this.method = 'GET';
    this.regexp = pathtoRegexp(this.path,
      this.keys = [],
      options.sensitive,
      options.strict);
  }

  /**
   * Expose `Route`.
   */

  page.Route = Route;

  /**
   * Return route middleware with
   * the given callback `fn()`.
   *
   * @param {Function} fn
   * @return {Function}
   * @api public
   */

  Route.prototype.middleware = function(fn) {
    var self = this;
    return function(ctx, next) {
      if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
      next();
    };
  };

  /**
   * Check if this route matches `path`, if so
   * populate `params`.
   *
   * @param {String} path
   * @param {Object} params
   * @return {Boolean}
   * @api private
   */

  Route.prototype.match = function(path, params) {
    var keys = this.keys,
      qsIndex = path.indexOf('?'),
      pathname = ~qsIndex ? path.slice(0, qsIndex) : path,
      m = this.regexp.exec(decodeURIComponent(pathname));

    if (!m) return false;

    for (var i = 1, len = m.length; i < len; ++i) {
      var key = keys[i - 1];
      var val = decodeURLEncodedURIComponent(m[i]);
      if (val !== undefined || !(hasOwnProperty.call(params, key.name))) {
        params[key.name] = val;
      }
    }

    return true;
  };


  /**
   * Handle "populate" events.
   */

  var onpopstate = (function () {
    var loaded = false;
    if ('undefined' === typeof window) {
      return;
    }
    if (document.readyState === 'complete') {
      loaded = true;
    } else {
      window.addEventListener('load', function() {
        setTimeout(function() {
          loaded = true;
        }, 0);
      });
    }
    return function onpopstate(e) {
      if (!loaded) return;
      if (e.state) {
        var path = e.state.path;
        page.replace(path, e.state);
      } else {
        page.show(location.pathname + location.hash, undefined, undefined, false);
      }
    };
  })();
  /**
   * Handle "click" events.
   */

  function onclick(e) {

    if (1 !== which(e)) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.defaultPrevented) return;



    // ensure link
    var el = e.target;
    while (el && 'A' !== el.nodeName) el = el.parentNode;
    if (!el || 'A' !== el.nodeName) return;



    // Ignore if tag has
    // 1. "download" attribute
    // 2. rel="external" attribute
    if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') return;

    // ensure non-hash for the same path
    var link = el.getAttribute('href');
    if (!hashbang && el.pathname === location.pathname && (el.hash || '#' === link)) return;



    // Check for mailto: in the href
    if (link && link.indexOf('mailto:') > -1) return;

    // check target
    if (el.target) return;

    // x-origin
    if (!sameOrigin(el.href)) return;



    // rebuild path
    var path = el.pathname + el.search + (el.hash || '');

    // strip leading "/[drive letter]:" on NW.js on Windows
    if (typeof process !== 'undefined' && path.match(/^\/[a-zA-Z]:\//)) {
      path = path.replace(/^\/[a-zA-Z]:\//, '/');
    }

    // same page
    var orig = path;

    if (path.indexOf(base) === 0) {
      path = path.substr(base.length);
    }

    if (hashbang) path = path.replace('#!', '');

    if (base && orig === path) return;

    e.preventDefault();
    page.show(orig);
  }

  /**
   * Event button.
   */

  function which(e) {
    e = e || window.event;
    return null === e.which ? e.button : e.which;
  }

  /**
   * Check if `href` is the same origin.
   */

  function sameOrigin(href) {
    var origin = location.protocol + '//' + location.hostname;
    if (location.port) origin += ':' + location.port;
    return (href && (0 === href.indexOf(origin)));
  }

  page.sameOrigin = sameOrigin;

}).call(this,require('_process'))

},{"_process":12,"path-to-regexp":6}],6:[function(require,module,exports){
var isarray = require('isarray')

/**
 * Expose `pathToRegexp`.
 */
module.exports = pathToRegexp
module.exports.parse = parse
module.exports.compile = compile
module.exports.tokensToFunction = tokensToFunction
module.exports.tokensToRegExp = tokensToRegExp

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^()])+)\\))?|\\(((?:\\\\.|[^()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g')

/**
 * Parse a string for the raw tokens.
 *
 * @param  {String} str
 * @return {Array}
 */
function parse (str) {
  var tokens = []
  var key = 0
  var index = 0
  var path = ''
  var res

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0]
    var escaped = res[1]
    var offset = res.index
    path += str.slice(index, offset)
    index = offset + m.length

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1]
      continue
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path)
      path = ''
    }

    var prefix = res[2]
    var name = res[3]
    var capture = res[4]
    var group = res[5]
    var suffix = res[6]
    var asterisk = res[7]

    var repeat = suffix === '+' || suffix === '*'
    var optional = suffix === '?' || suffix === '*'
    var delimiter = prefix || '/'
    var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?')

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      pattern: escapeGroup(pattern)
    })
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index)
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path)
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {String}   str
 * @return {Function}
 */
function compile (str) {
  return tokensToFunction(parse(str))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length)

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^' + tokens[i].pattern + '$')
    }
  }

  return function (obj) {
    var path = ''
    var data = obj || {}

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]

      if (typeof token === 'string') {
        path += token

        continue
      }

      var value = data[token.name]
      var segment

      if (value == null) {
        if (token.optional) {
          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received "' + value + '"')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encodeURIComponent(value[j])

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment
        }

        continue
      }

      segment = encodeURIComponent(value)

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {String} str
 * @return {String}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {String}
 */
function flags (options) {
  return options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {RegExp} path
 * @param  {Array}  keys
 * @return {RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g)

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        pattern: null
      })
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {Array}  path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = []

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source)
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options))

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {String} path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function stringToRegexp (path, keys, options) {
  var tokens = parse(path)
  var re = tokensToRegExp(tokens, options)

  // Attach keys back to the regexp.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] !== 'string') {
      keys.push(tokens[i])
    }
  }

  return attachKeys(re, keys)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {Array}  tokens
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function tokensToRegExp (tokens, options) {
  options = options || {}

  var strict = options.strict
  var end = options.end !== false
  var route = ''
  var lastToken = tokens[tokens.length - 1]
  var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken)

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]

    if (typeof token === 'string') {
      route += escapeString(token)
    } else {
      var prefix = escapeString(token.prefix)
      var capture = token.pattern

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*'
      }

      if (token.optional) {
        if (prefix) {
          capture = '(?:' + prefix + '(' + capture + '))?'
        } else {
          capture = '(' + capture + ')?'
        }
      } else {
        capture = prefix + '(' + capture + ')'
      }

      route += capture
    }
  }

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
  }

  if (end) {
    route += '$'
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithSlash ? '' : '(?=\\/|$)'
  }

  return new RegExp('^' + route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 [keys]
 * @param  {Object}                [options]
 * @return {RegExp}
 */
function pathToRegexp (path, keys, options) {
  keys = keys || []

  if (!isarray(keys)) {
    options = keys
    keys = []
  } else if (!options) {
    options = {}
  }

  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys, options)
  }

  if (isarray(path)) {
    return arrayToRegexp(path, keys, options)
  }

  return stringToRegexp(path, keys, options)
}

},{"isarray":7}],7:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],8:[function(require,module,exports){
/*
 * pub pager.js generator-plugin
 *
 * client-side router (visionmedia/page) plugin for pub-generator
 * translates click events for intra-site links to generator.nav events
 * generator.nav events are then handled by jqueryview
 *
 * initialize by calling pager = generator.initPager();
 * pager.page will be set to the current page object, maintained after each nav
 *
 * NOTE: uses history.pushState, which doesn't work in older browers
 * copyright 2015, Jurgen Leschner - github.com/jldec - MIT license
 *
*/
var debug = require('debug')('pub:pager');
var qs = require('querystring');

module.exports = function(generator) {

  // mixin
  generator.initPager = function initPager() {

    var u = generator.util;
    var opts = generator.opts;
    var log = opts.log;

    // bind jqueryview
    var jqv = require('./jqueryview')(generator);
    jqv.start();

    // https://github.com/visionmedia/page.js
    var pager = require('page');

    // initialize with current page
    var href = u.get(pubRef, 'href', location.pathname)
    pager.page = generator.page$[href];
    debug('init ' + decodeURI(location) + (pager.page ? ' (ok)' : ' (undefined page)'));

    pager('*', function(ctx, next) {
      var path = ctx.path;

      // strip origin from fq urls
      path = u.unPrefix(path, opts.appUrl);

      // strip static root (see /server/client/init-opts.js)
      path = u.unPrefix(path, opts.staticRoot);

      var page = generator.findPage(path);

      if (!page) {
        log('pager miss', path);
        return next();
      }

      pager.page = page;

      // simulate server-side request
      generator.req = { query: u.parseUrlParams('?' + ctx.querystring) };

      // update view in DOM
      debug('nav ' + decodeURI(path));
      generator.emit('nav', page);
    });

    // start pager
    pager( { decodeURLComponents:false, dispatch:false } ); // auto-dispatch loses hash.

    return pager;
  };
}

},{"./jqueryview":1,"debug":2,"page":5,"querystring":15}],9:[function(require,module,exports){
module.exports = function(generator) {

var u = generator.util;
var hb = generator.handlebars;

// map icon name -> glyph html hex
// keys cannot contain regexp special chars
var glyphMap = {
'500px':'26e',
'adjust':'042',
'adn':'170',
'align-center':'037',
'align-justify':'039',
'align-left':'036',
'align-right':'038',
'amazon':'270',
'ambulance':'0f9',
'anchor':'13d',
'android':'17b',
'angellist':'209',
'angle-double-down':'103',
'angle-double-left':'100',
'angle-double-right':'101',
'angle-double-up':'102',
'angle-down':'107',
'angle-left':'104',
'angle-right':'105',
'angle-up':'106',
'apple':'179',
'archive':'187',
'area-chart':'1fe',
'arrow-circle-down':'0ab',
'arrow-circle-left':'0a8',
'arrow-circle-o-down':'01a',
'arrow-circle-o-left':'190',
'arrow-circle-o-right':'18e',
'arrow-circle-o-up':'01b',
'arrow-circle-right':'0a9',
'arrow-circle-up':'0aa',
'arrow-down':'063',
'arrow-left':'060',
'arrow-right':'061',
'arrow-up':'062',
'arrows':'047',
'arrows-alt':'0b2',
'arrows-h':'07e',
'arrows-v':'07d',
'asterisk':'069',
'at':'1fa',
'automobile':'1b9',
'backward':'04a',
'balance-scale':'24e',
'ban':'05e',
'bank':'19c',
'bar-chart':'080',
'bar-chart-o':'080',
'barcode':'02a',
'bars':'0c9',
'battery-0':'244',
'battery-1':'243',
'battery-2':'242',
'battery-3':'241',
'battery-4':'240',
'battery-empty':'244',
'battery-full':'240',
'battery-half':'242',
'battery-quarter':'243',
'battery-three-quarters':'241',
'bed':'236',
'beer':'0fc',
'behance':'1b4',
'behance-square':'1b5',
'bell':'0f3',
'bell-o':'0a2',
'bell-slash':'1f6',
'bell-slash-o':'1f7',
'bicycle':'206',
'binoculars':'1e5',
'birthday-cake':'1fd',
'bitbucket':'171',
'bitbucket-square':'172',
'bitcoin':'15a',
'black-tie':'27e',
'bold':'032',
'bolt':'0e7',
'bomb':'1e2',
'book':'02d',
'bookmark':'02e',
'bookmark-o':'097',
'briefcase':'0b1',
'btc':'15a',
'bug':'188',
'building':'1ad',
'building-o':'0f7',
'bullhorn':'0a1',
'bullseye':'140',
'bus':'207',
'buysellads':'20d',
'cab':'1ba',
'calculator':'1ec',
'calendar':'073',
'calendar-check-o':'274',
'calendar-minus-o':'272',
'calendar-o':'133',
'calendar-plus-o':'271',
'calendar-times-o':'273',
'camera':'030',
'camera-retro':'083',
'car':'1b9',
'caret-down':'0d7',
'caret-left':'0d9',
'caret-right':'0da',
'caret-square-o-down':'150',
'caret-square-o-left':'191',
'caret-square-o-right':'152',
'caret-square-o-up':'151',
'caret-up':'0d8',
'cart-arrow-down':'218',
'cart-plus':'217',
'cc':'20a',
'cc-amex':'1f3',
'cc-diners-club':'24c',
'cc-discover':'1f2',
'cc-jcb':'24b',
'cc-mastercard':'1f1',
'cc-paypal':'1f4',
'cc-stripe':'1f5',
'cc-visa':'1f0',
'certificate':'0a3',
'chain':'0c1',
'chain-broken':'127',
'check':'00c',
'check-circle':'058',
'check-circle-o':'05d',
'check-square':'14a',
'check-square-o':'046',
'chevron-circle-down':'13a',
'chevron-circle-left':'137',
'chevron-circle-right':'138',
'chevron-circle-up':'139',
'chevron-down':'078',
'chevron-left':'053',
'chevron-right':'054',
'chevron-up':'077',
'child':'1ae',
'chrome':'268',
'circle':'111',
'circle-o':'10c',
'circle-o-notch':'1ce',
'circle-thin':'1db',
'clipboard':'0ea',
'clock-o':'017',
'clone':'24d',
'close':'00d',
'cloud':'0c2',
'cloud-download':'0ed',
'cloud-upload':'0ee',
'cny':'157',
'code':'121',
'code-fork':'126',
'codepen':'1cb',
'coffee':'0f4',
'cog':'013',
'cogs':'085',
'columns':'0db',
'comment':'075',
'comment-o':'0e5',
'commenting':'27a',
'commenting-o':'27b',
'comments':'086',
'comments-o':'0e6',
'compass':'14e',
'compress':'066',
'connectdevelop':'20e',
'contao':'26d',
'copy':'0c5',
'copyright':'1f9',
'creative-commons':'25e',
'credit-card':'09d',
'crop':'125',
'crosshairs':'05b',
'css3':'13c',
'cube':'1b2',
'cubes':'1b3',
'cut':'0c4',
'cutlery':'0f5',
'dashboard':'0e4',
'dashcube':'210',
'database':'1c0',
'dedent':'03b',
'delicious':'1a5',
'desktop':'108',
'deviantart':'1bd',
'diamond':'219',
'digg':'1a6',
'dollar':'155',
'dot-circle-o':'192',
'download':'019',
'dribbble':'17d',
'dropbox':'16b',
'drupal':'1a9',
'edit':'044',
'eject':'052',
'ellipsis-h':'141',
'ellipsis-v':'142',
'empire':'1d1',
'envelope':'0e0',
'envelope-o':'003',
'envelope-square':'199',
'eraser':'12d',
'eur':'153',
'euro':'153',
'exchange':'0ec',
'exclamation':'12a',
'exclamation-circle':'06a',
'exclamation-triangle':'071',
'expand':'065',
'expeditedssl':'23e',
'external-link':'08e',
'external-link-square':'14c',
'eye':'06e',
'eye-slash':'070',
'eyedropper':'1fb',
'facebook':'09a',
'facebook-f':'09a',
'facebook-official':'230',
'facebook-square':'082',
'fast-backward':'049',
'fast-forward':'050',
'fax':'1ac',
'feed':'09e',
'female':'182',
'fighter-jet':'0fb',
'file':'15b',
'file-archive-o':'1c6',
'file-audio-o':'1c7',
'file-code-o':'1c9',
'file-excel-o':'1c3',
'file-image-o':'1c5',
'file-movie-o':'1c8',
'file-o':'016',
'file-pdf-o':'1c1',
'file-photo-o':'1c5',
'file-picture-o':'1c5',
'file-powerpoint-o':'1c4',
'file-sound-o':'1c7',
'file-text':'15c',
'file-text-o':'0f6',
'file-video-o':'1c8',
'file-word-o':'1c2',
'file-zip-o':'1c6',
'files-o':'0c5',
'film':'008',
'filter':'0b0',
'fire':'06d',
'fire-extinguisher':'134',
'firefox':'269',
'flag':'024',
'flag-checkered':'11e',
'flag-o':'11d',
'flash':'0e7',
'flask':'0c3',
'flickr':'16e',
'floppy-o':'0c7',
'folder':'07b',
'folder-o':'114',
'folder-open':'07c',
'folder-open-o':'115',
'font':'031',
'fonticons':'280',
'forumbee':'211',
'forward':'04e',
'foursquare':'180',
'frown-o':'119',
'futbol-o':'1e3',
'gamepad':'11b',
'gavel':'0e3',
'gbp':'154',
'ge':'1d1',
'gear':'013',
'gears':'085',
'genderless':'22d',
'get-pocket':'265',
'gg':'260',
'gg-circle':'261',
'gift':'06b',
'git':'1d3',
'git-square':'1d2',
'github':'09b',
'github-alt':'113',
'github-square':'092',
'gittip':'184',
'glass':'000',
'globe':'0ac',
'google':'1a0',
'google-plus':'0d5',
'google-plus-square':'0d4',
'google-wallet':'1ee',
'graduation-cap':'19d',
'gratipay':'184',
'group':'0c0',
'h-square':'0fd',
'hacker-news':'1d4',
'hand-grab-o':'255',
'hand-lizard-o':'258',
'hand-o-down':'0a7',
'hand-o-left':'0a5',
'hand-o-right':'0a4',
'hand-o-up':'0a6',
'hand-paper-o':'256',
'hand-peace-o':'25b',
'hand-pointer-o':'25a',
'hand-rock-o':'255',
'hand-scissors-o':'257',
'hand-spock-o':'259',
'hand-stop-o':'256',
'hdd-o':'0a0',
'header':'1dc',
'headphones':'025',
'heart':'004',
'heart-o':'08a',
'heartbeat':'21e',
'history':'1da',
'home':'015',
'hospital-o':'0f8',
'hotel':'236',
'hourglass':'254',
'hourglass-1':'251',
'hourglass-2':'252',
'hourglass-3':'253',
'hourglass-end':'253',
'hourglass-half':'252',
'hourglass-o':'250',
'hourglass-start':'251',
'houzz':'27c',
'html5':'13b',
'i-cursor':'246',
'ils':'20b',
'image':'03e',
'inbox':'01c',
'indent':'03c',
'industry':'275',
'info':'129',
'info-circle':'05a',
'inr':'156',
'instagram':'16d',
'institution':'19c',
'internet-explorer':'26b',
'intersex':'224',
'ioxhost':'208',
'italic':'033',
'joomla':'1aa',
'jpy':'157',
'jsfiddle':'1cc',
'key':'084',
'keyboard-o':'11c',
'krw':'159',
'language':'1ab',
'laptop':'109',
'lastfm':'202',
'lastfm-square':'203',
'leaf':'06c',
'leanpub':'212',
'legal':'0e3',
'lemon-o':'094',
'level-down':'149',
'level-up':'148',
'life-bouy':'1cd',
'life-buoy':'1cd',
'life-ring':'1cd',
'life-saver':'1cd',
'lightbulb-o':'0eb',
'line-chart':'201',
'link':'0c1',
'linkedin':'0e1',
'linkedin-square':'08c',
'linux':'17c',
'list':'03a',
'list-alt':'022',
'list-ol':'0cb',
'list-ul':'0ca',
'location-arrow':'124',
'lock':'023',
'long-arrow-down':'175',
'long-arrow-left':'177',
'long-arrow-right':'178',
'long-arrow-up':'176',
'magic':'0d0',
'magnet':'076',
'mail-forward':'064',
'mail-reply':'112',
'mail-reply-all':'122',
'male':'183',
'map':'279',
'map-marker':'041',
'map-o':'278',
'map-pin':'276',
'map-signs':'277',
'mars':'222',
'mars-double':'227',
'mars-stroke':'229',
'mars-stroke-h':'22b',
'mars-stroke-v':'22a',
'maxcdn':'136',
'meanpath':'20c',
'medium':'23a',
'medkit':'0fa',
'meh-o':'11a',
'mercury':'223',
'microphone':'130',
'microphone-slash':'131',
'minus':'068',
'minus-circle':'056',
'minus-square':'146',
'minus-square-o':'147',
'mobile':'10b',
'mobile-phone':'10b',
'money':'0d6',
'moon-o':'186',
'mortar-board':'19d',
'motorcycle':'21c',
'mouse-pointer':'245',
'music':'001',
'navicon':'0c9',
'neuter':'22c',
'newspaper-o':'1ea',
'object-group':'247',
'object-ungroup':'248',
'odnoklassniki':'263',
'odnoklassniki-square':'264',
'opencart':'23d',
'openid':'19b',
'opera':'26a',
'optin-monster':'23c',
'outdent':'03b',
'pagelines':'18c',
'paint-brush':'1fc',
'paper-plane':'1d8',
'paper-plane-o':'1d9',
'paperclip':'0c6',
'paragraph':'1dd',
'paste':'0ea',
'pause':'04c',
'paw':'1b0',
'paypal':'1ed',
'pencil':'040',
'pencil-square':'14b',
'pencil-square-o':'044',
'phone':'095',
'phone-square':'098',
'photo':'03e',
'picture-o':'03e',
'pie-chart':'200',
'pied-piper':'1a7',
'pied-piper-alt':'1a8',
'pinterest':'0d2',
'pinterest-p':'231',
'pinterest-square':'0d3',
'plane':'072',
'play':'04b',
'play-circle':'144',
'play-circle-o':'01d',
'plug':'1e6',
'plus':'067',
'plus-circle':'055',
'plus-square':'0fe',
'plus-square-o':'196',
'power-off':'011',
'print':'02f',
'puzzle-piece':'12e',
'qq':'1d6',
'qrcode':'029',
'question':'128',
'question-circle':'059',
'quote-left':'10d',
'quote-right':'10e',
'ra':'1d0',
'random':'074',
'rebel':'1d0',
'recycle':'1b8',
'reddit':'1a1',
'reddit-square':'1a2',
'refresh':'021',
'registered':'25d',
'remove':'00d',
'renren':'18b',
'reorder':'0c9',
'repeat':'01e',
'reply':'112',
'reply-all':'122',
'retweet':'079',
'rmb':'157',
'road':'018',
'rocket':'135',
'rotate-left':'0e2',
'rotate-right':'01e',
'rouble':'158',
'rss':'09e',
'rss-square':'143',
'rub':'158',
'ruble':'158',
'rupee':'156',
'safari':'267',
'save':'0c7',
'scissors':'0c4',
'search':'002',
'search-minus':'010',
'search-plus':'00e',
'sellsy':'213',
'send':'1d8',
'send-o':'1d9',
'server':'233',
'share':'064',
'share-alt':'1e0',
'share-alt-square':'1e1',
'share-square':'14d',
'share-square-o':'045',
'shekel':'20b',
'sheqel':'20b',
'shield':'132',
'ship':'21a',
'shirtsinbulk':'214',
'shopping-cart':'07a',
'sign-in':'090',
'sign-out':'08b',
'signal':'012',
'simplybuilt':'215',
'sitemap':'0e8',
'skyatlas':'216',
'skype':'17e',
'slack':'198',
'sliders':'1de',
'slideshare':'1e7',
'smile-o':'118',
'soccer-ball-o':'1e3',
'sort':'0dc',
'sort-alpha-asc':'15d',
'sort-alpha-desc':'15e',
'sort-amount-asc':'160',
'sort-amount-desc':'161',
'sort-asc':'0de',
'sort-desc':'0dd',
'sort-down':'0dd',
'sort-numeric-asc':'162',
'sort-numeric-desc':'163',
'sort-up':'0de',
'soundcloud':'1be',
'space-shuttle':'197',
'spinner':'110',
'spoon':'1b1',
'spotify':'1bc',
'square':'0c8',
'square-o':'096',
'stack-exchange':'18d',
'stack-overflow':'16c',
'star':'005',
'star-half':'089',
'star-half-empty':'123',
'star-half-full':'123',
'star-half-o':'123',
'star-o':'006',
'steam':'1b6',
'steam-square':'1b7',
'step-backward':'048',
'step-forward':'051',
'stethoscope':'0f1',
'sticky-note':'249',
'sticky-note-o':'24a',
'stop':'04d',
'street-view':'21d',
'strikethrough':'0cc',
'stumbleupon':'1a4',
'stumbleupon-circle':'1a3',
'subscript':'12c',
'subway':'239',
'suitcase':'0f2',
'sun-o':'185',
'superscript':'12b',
'support':'1cd',
'table':'0ce',
'tablet':'10a',
'tachometer':'0e4',
'tag':'02b',
'tags':'02c',
'tasks':'0ae',
'taxi':'1ba',
'television':'26c',
'tencent-weibo':'1d5',
'terminal':'120',
'text-height':'034',
'text-width':'035',
'th':'00a',
'th-large':'009',
'th-list':'00b',
'thumb-tack':'08d',
'thumbs-down':'165',
'thumbs-o-down':'088',
'thumbs-o-up':'087',
'thumbs-up':'164',
'ticket':'145',
'times':'00d',
'times-circle':'057',
'times-circle-o':'05c',
'tint':'043',
'toggle-down':'150',
'toggle-left':'191',
'toggle-off':'204',
'toggle-on':'205',
'toggle-right':'152',
'toggle-up':'151',
'trademark':'25c',
'train':'238',
'transgender':'224',
'transgender-alt':'225',
'trash':'1f8',
'trash-o':'014',
'tree':'1bb',
'trello':'181',
'tripadvisor':'262',
'trophy':'091',
'truck':'0d1',
'try':'195',
'tty':'1e4',
'tumblr':'173',
'tumblr-square':'174',
'turkish-lira':'195',
'tv':'26c',
'twitch':'1e8',
'twitter':'099',
'twitter-square':'081',
'umbrella':'0e9',
'underline':'0cd',
'undo':'0e2',
'university':'19c',
'unlink':'127',
'unlock':'09c',
'unlock-alt':'13e',
'unsorted':'0dc',
'upload':'093',
'usd':'155',
'user':'007',
'user-md':'0f0',
'user-plus':'234',
'user-secret':'21b',
'user-times':'235',
'users':'0c0',
'venus':'221',
'venus-double':'226',
'venus-mars':'228',
'viacoin':'237',
'video-camera':'03d',
'vimeo':'27d',
'vimeo-square':'194',
'vine':'1ca',
'vk':'189',
'volume-down':'027',
'volume-off':'026',
'volume-up':'028',
'warning':'071',
'wechat':'1d7',
'weibo':'18a',
'weixin':'1d7',
'whatsapp':'232',
'wheelchair':'193',
'wifi':'1eb',
'wikipedia-w':'266',
'windows':'17a',
'won':'159',
'wordpress':'19a',
'wrench':'0ad',
'xing':'168',
'xing-square':'169',
'y-combinator':'23b',
'y-combinator-square':'1d4',
'yahoo':'19e',
'yc':'23b',
'yc-square':'1d4',
'yelp':'1e9',
'yen':'157',
'youtube':'167',
'youtube-play':'16a',
'youtube-square':'166'
};

function sGlyph(s) {
  return '&#xf' + s + ';'
}

// lookup glyph given name
hb.registerHelper('faGlyph', function(name, frame) {
  var glyph = glyphMap[name];
  return glyph ? sGlyph(glyph) : '';
});

// get icon html for a name - xtra classes optional
hb.registerHelper('faIcon', function(name, xtra, frame) {
  return iconHtml(name, hb.hbp(xtra));
});

// block helper over all {name: glyph:}
hb.registerHelper('eachFa', function(frame) {
  return u.map(glyphMap, function(glyph, name) {
    return frame.fn({ name:name, glyph:sGlyph(glyph) });
  }).join('');
});

// get html for name, with optional extra classes
function iconHtml(name, xtra) {
  var glyph = glyphMap[name];
  if (!glyph) return;
  var xtra = xtra ? (' fa-' + xtra.split(/\s/).join(' fa-')) : '';
  return '<span class="fa' + xtra + '">' + sGlyph(glyph) + '</span>';
}

// test for !glyphMapkey class1 class2 class3 ...
var re = new RegExp('^!(' + u.keys(glyphMap).join('|') + ')(?:\\s+(.+)|$)');

// mutate marked renderer to customize .em html
var renderer = generator.renderer;
var renderEm = renderer.em;
renderer.em = function em(text) {
  var match;
  if (match = u.str(text).match(re)) return iconHtml(match[1], match[2]);
  return renderEm.call(this, text);
}

}

},{}],10:[function(require,module,exports){
module.exports = function(generator) {
  var u = generator.util;
  var opts = generator.opts;
  var log = opts.log;
  var hb = generator.handlebars;

  if (/\/\/localhost/.test(opts.appUrl)) {
    log('WARNING: pub-pkg-seo sitemap using appUrl %s', opts.appUrl);
  }

  hb.registerHelper('metaSeo', function(frame) {
    if (opts.noRobots) {
      return '<meta name="robots" content="noindex, nofollow">';
    }
  });

}

},{}],11:[function(require,module,exports){
require("pub-pager")(generator);
require("/Users/hello/pub/website/pub-generator-plugin.js")(generator);
require("/Users/hello/pub/server/node_modules/pub-pkg-font-awesome/generator-plugin.js")(generator);
require("/Users/hello/pub/server/node_modules/pub-pkg-seo/generator-plugin.js")(generator);

},{"/Users/hello/pub/server/node_modules/pub-pkg-font-awesome/generator-plugin.js":9,"/Users/hello/pub/server/node_modules/pub-pkg-seo/generator-plugin.js":10,"/Users/hello/pub/website/pub-generator-plugin.js":16,"pub-pager":8}],12:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],13:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],14:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],15:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":13,"./encode":14}],16:[function(require,module,exports){
module.exports = function(generator) {

  var opts = generator.opts;
  var log = opts.log;
  var hb = generator.handlebars;
  var u = generator.util;
  var debug = generator.debug;

  // pre-compute results for each find-solutions page
  generator.on('load', function() {
    var resultList = u(generator.templatePages$['solution'])
      .reject('nopublish')
      .sortBy('created')
      .reverse()
      .value();

    u.each(generator.templatePages$['solutions'], function(page) {

      if (!page.searchCategory) {
        page.results = resultList;
      } else {
        var re = new RegExp('^' + u.escapeRegExp(page.searchCategory));
        page.results = u.filter(resultList, function(p) {
          return u.some(u.getaVals(p, 'category'), function(c) {
            return re.test(c)
          });
        });
      }
      // log('pre-computed:', page._href, page.results.length);
    });
  });

  // temporarily copied from generator/helpers.js
  // block-helper for fragments matching pattern
  // fragment pattern should start with #... or /page#...
  hb.registerHelper('eachFragment', function(pattern, frame) {
    var p = hb.hbp(pattern);
    frame = p ? frame : pattern;
    var rg = selectFragments(p, this);
    var map = u.map(rg, function(fragment, index) {
      frame.data.index = index;
      if (index === rg.length - 1) { frame.data.last = true; }
      return frame.fn(fragment, frame);
    });
    return map.join('');

    // lookup multiple fragments via href pattern match
    // works like resolve with a wildcard
    // careful using this without #
    function selectFragments(refpat, context) {
      refpat = refpat || '#';
      if (/^#/.test(refpat)) {
        refpat = '^' + u.escapeRegExp((context._href || '/') + refpat);
      }
      else {
        refpat = u.escapeRegExp(refpat);
      }
      var re = new RegExp(refpat);
      return u.filter(generator.fragments, function(fragment) { return re.test(fragment._href); });
    }
  });

  hb.registerHelper('eachSearchResults', function(frame) {
    var list = this.results;
    var txt = u.get(generator, 'req.query.q'); // leaky way to pass params
    if (txt) {
      debug('searching for: "%s"', txt);
      var re = u.grep(txt);
      list = u.filter(list, function(p) {
        return re.test(p._href) || re.test(p.name) || re.test(p.category) || re.test(p.tags) || re.test(p._txt);
      });
    }
    return u.map(list, function(page, idx) {
      frame.data.index = idx;
      return frame.fn(page, frame);
    }).join('');
  });

  hb.registerHelper('lastSearch', function() {
    return u.get(generator, 'req.query.q');
  });

  hb.registerHelper('icon', function(frame) {
    if (!this.icon) return '';
    return '<img src="' + hb.fixPath(this.icon) + '">';
  });

  // return either banner html or, failing that, page html
  hb.registerHelper('banner', function(frame) {
    var fragment = this['#banner'] || this;
    return generator.renderMarkdown(fragment._txt, hb.renderOpts());
  });

  // return solution summary if available, otherwise use main solution text
  hb.registerHelper('summary', function(frame) {
    var fragment = this['#summary'] || this;
    return generator.renderMarkdown(u.trunc(fragment._txt, 240), hb.renderOpts());
  });

  hb.registerHelper('eachSearchTag', function(frame) {
    if (!this.searchTags) return '';
    return u.map(this.searchTags.split(','), function(tag) {
      return frame.fn(u.trim(tag), frame);
    }).join('');
  });

 hb.registerHelper('category-icons', function(frame) {
   var cats = Array.isArray(this.category) ? this.category : [this.category];
   return cats.map(function (cat) {
     var path = hb.fixPath('/img/category-icons/' + cat + '.png');
     return '<img src="' + path + '" alt="' + cat + '">';
   }).join('');
 });

 hb.registerHelper('video-player', function(frame) {
   return this.video ? '<iframe src="' + hb.fixPath(this.video) + '" frameborder="0"></iframe>' : '';
 });

 hb.registerHelper('relPathHref', function(href, frame) {
   return u.relPath(href);
 });

}

},{}]},{},[11])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NlcnZlci9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS1taWRkbGV3YXJlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9wYWdlci9qcXVlcnl2aWV3LmpzIiwiLi4vcGFnZXIvbm9kZV9tb2R1bGVzL2RlYnVnL2Jyb3dzZXIuanMiLCIuLi9wYWdlci9ub2RlX21vZHVsZXMvZGVidWcvZGVidWcuanMiLCIuLi9wYWdlci9ub2RlX21vZHVsZXMvZGVidWcvbm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwiLi4vcGFnZXIvbm9kZV9tb2R1bGVzL3BhZ2UvaW5kZXguanMiLCIuLi9wYWdlci9ub2RlX21vZHVsZXMvcGFnZS9ub2RlX21vZHVsZXMvcGF0aC10by1yZWdleHAvaW5kZXguanMiLCIuLi9wYWdlci9ub2RlX21vZHVsZXMvcGFnZS9ub2RlX21vZHVsZXMvcGF0aC10by1yZWdleHAvbm9kZV9tb2R1bGVzL2lzYXJyYXkvaW5kZXguanMiLCIuLi9wYWdlci9wYWdlci5qcyIsIi4uL3BrZy1mb250LWF3ZXNvbWUvZ2VuZXJhdG9yLXBsdWdpbi5qcyIsIi4uL3BrZy1zZW8vZ2VuZXJhdG9yLXBsdWdpbi5qcyIsIi4uL3NlcnZlci9jbGllbnQvX2dlbmVyYXRvci1wbHVnaW5zLmpzIiwiLi4vc2VydmVyL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5LW1pZGRsZXdhcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi4uL3NlcnZlci9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS1taWRkbGV3YXJlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZGVjb2RlLmpzIiwiLi4vc2VydmVyL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5LW1pZGRsZXdhcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9lbmNvZGUuanMiLCIuLi9zZXJ2ZXIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnktbWlkZGxld2FyZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2luZGV4LmpzIiwicHViLWdlbmVyYXRvci1wbHVnaW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzbUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RZQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3Z0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICoganF1ZXJ5dmlldy5qc1xuICpcbiAqIHB1Yi1wYWdlciBuYXYgaGFuZGxlciBmb3IganF1ZXJ5IHNpbmdsZS1wYWdlLWFwcCB2aWV3c1xuICogbGlzdGVucyBmb3IgJ25hdicsICdsb2FkZWQnLCBhbmQgJ3VwZGF0ZWRUZXh0JyBldmVudHNcbiAqIGVtaXRzICd1cGRhdGUtdmlldycgd2hlbiBjb250ZW50IGhhcyBiZWVuIHJlcGxhY2VkXG4gKlxuICogbWluaW1pemUgaHRtbCByZXBsYWNlbWVudHMgYnkgbG9va2luZyBmb3IgYXR0cmlidXRlc1xuICogZGF0YS1yZW5kZXItbGF5b3V0XG4gKiBkYXRhLXJlbmRlci1wYWdlXG4gKiBkYXRhLXJlbmRlci1odG1sXG4gKlxuICogY29weXJpZ2h0IDIwMTUsIEp1cmdlbiBMZXNjaG5lciAtIGdpdGh1Yi5jb20vamxkZWMgLSBNSVQgbGljZW5zZVxuKiovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZ2VuZXJhdG9yKSB7XG5cbiAgdmFyIG9wdHMgPSBnZW5lcmF0b3Iub3B0cztcbiAgdmFyIHUgPSBnZW5lcmF0b3IudXRpbDtcbiAgdmFyIGxhbmcgPSBnZW5lcmF0b3IuaGFuZGxlYmFycy5wYWdlTGFuZztcbiAgdmFyIGxvZyA9IG9wdHMubG9nO1xuXG4gIC8vIGlmIHRoZXJlIGlzIG5vIGRhdGEtcmVuZGVyLWxheW91dCBhdHRyaWJ1dGUsIHVwZGF0ZUxheW91dCBkb2VzIG5vdGhpbmdcbiAgdmFyICRsYXlvdXQgPSAkKCdbZGF0YS1yZW5kZXItbGF5b3V0XScpO1xuXG4gIC8vIGNhY2hlIGxhc3QgcGFnZSAtIFRPRE8gLSBmaW5kIGxhc3RQYWdlIHVzaW5nIGxvY2F0aW9uIG9uIHN0YXJ0dXBcbiAgdmFyIGxhc3RQYWdlID0gbnVsbDtcblxuICB2YXIgdmlldyA9IHtcbiAgICBzdGFydDogc3RhcnQsIC8vIGNhbGwgc3RhcnQoKSBhZnRlciB2aWV3cyBhcmUgY3JlYXRlZFxuICAgIHN0b3A6IHN0b3AgICAgLy8gY2FsbCBzdG9wKCkgYmVmb3JlIHZpZXdzIGFyZSBkZWxldGVkXG4gIH07XG5cbiAgcmV0dXJuIHZpZXc7XG5cbiAgZnVuY3Rpb24gc3RhcnQoKSB7XG4gICAgZ2VuZXJhdG9yLm9uKCduYXYnLCB1cGRhdGVQYWdlKTsgICAgICAgICAvLyBTUEEgY2xpY2tcbiAgICBnZW5lcmF0b3Iub24oJ2xvYWRlZCcsIHJlbG9hZFBhZ2UpOyAgICAgIC8vIGZ1bGwgcmVsb2FkIGFmdGVyIHN0cnVjdHVyYWwgZWRpdFxuICAgIGdlbmVyYXRvci5vbigndXBkYXRlZFRleHQnLCB1cGRhdGVIdG1sKTsgLy8gZWRpdG9yIHVwZGF0ZVxuICB9XG5cbiAgZnVuY3Rpb24gc3RvcCgpIHtcbiAgICBnZW5lcmF0b3Iub2ZmKCduYXYnLCB1cGRhdGVQYWdlKTtcbiAgICBnZW5lcmF0b3Iub2ZmKCdsb2FkZWQnLCByZWxvYWRQYWdlKTtcbiAgICBnZW5lcmF0b3Iub2ZmKCd1cGRhdGVkVGV4dCcsIHVwZGF0ZUh0bWwpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVsb2FkUGFnZSgpIHtcbiAgICBpZiAoIWxhc3RQYWdlKSByZXR1cm47XG4gICAgaWYgKCEkbGF5b3V0Lmxlbmd0aCkgeyB1cGRhdGVQYWdlKGxhc3RQYWdlKTsgfVxuICAgIGVsc2UgeyB1cGRhdGVMYXlvdXQobGFzdFBhZ2UpOyB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVQYWdlKHBhZ2UpIHtcbiAgICBpZiAobGF5b3V0Q2hhbmdlZChwYWdlKSkgcmV0dXJuIHVwZGF0ZUxheW91dChwYWdlKTtcbiAgICB2YXIgJHBhZ2UgPSAkKCdbZGF0YS1yZW5kZXItcGFnZV0nKTtcbiAgICBpZiAoISRwYWdlLmxlbmd0aCkgcmV0dXJuIGxvZygnanF1ZXJ5dmlldyBjYW5ub3QgdXBkYXRlIHBhZ2UgJyArIHBhdGgpO1xuICAgIGdlbmVyYXRvci5lbWl0KCdiZWZvcmUtdXBkYXRlLXZpZXcnLCAkcGFnZSk7XG4gICAgJHBhZ2UucmVwbGFjZVdpdGgoZ2VuZXJhdG9yLnJlbmRlclBhZ2UocGFnZSkpO1xuICAgIGdlbmVyYXRvci5lbWl0KCdhZnRlci11cGRhdGUtdmlldycsICRwYWdlKTtcbiAgICBsYXN0UGFnZSA9IHBhZ2U7XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVMYXlvdXQocGFnZSkge1xuICAgIGlmICghcGFnZSB8fCAhJGxheW91dC5sZW5ndGgpIHJldHVybjtcbiAgICB2YXIgbGF5b3V0ID0gZ2VuZXJhdG9yLmxheW91dFRlbXBsYXRlKHBhZ2UpO1xuICAgIGdlbmVyYXRvci5lbWl0KCdiZWZvcmUtdXBkYXRlLXZpZXcnLCAkbGF5b3V0KTtcbiAgICAkbGF5b3V0LnJlcGxhY2VXaXRoKGdlbmVyYXRvci5yZW5kZXJMYXlvdXQocGFnZSkpO1xuICAgIGdlbmVyYXRvci5lbWl0KCdhZnRlci11cGRhdGUtdmlldycsICRsYXlvdXQpO1xuICAgIGxhc3RQYWdlID0gcGFnZTtcbiAgfVxuXG4gIC8vIHJldHVybiB0cnVlIGlmIG5ldyBsYXlvdXQgaXMgZGlmZmVyZW50IGZyb20gY3VycmVudCBwYWdlIGxheW91dFxuICBmdW5jdGlvbiBsYXlvdXRDaGFuZ2VkKHBhZ2UpIHtcbiAgICBpZiAoISRsYXlvdXQubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCFsYXN0UGFnZSB8fCBsYXN0UGFnZS5maXhsYXlvdXQgfHwgbGFuZyhsYXN0UGFnZSkgIT09IGxhbmcocGFnZSkpIHJldHVybiB0cnVlO1xuICAgIHZhciBjdXJyZW50bGF5b3V0ID0gJGxheW91dC5hdHRyKCdkYXRhLXJlbmRlci1sYXlvdXQnKSB8fCAnbWFpbi1sYXlvdXQnO1xuICAgIHZhciBuZXdsYXlvdXQgPSBnZW5lcmF0b3IubGF5b3V0VGVtcGxhdGUocGFnZSk7XG4gICAgcmV0dXJuIChuZXdsYXlvdXQgIT09IGN1cnJlbnRsYXlvdXQpO1xuICB9XG5cbiAgLy8gdGhpcyB3b24ndCB3b3JrIGlmIHRoZSBocmVmIG9mIGEgZnJhZ21lbnQgaXMgZWRpdGVkXG4gIGZ1bmN0aW9uIHVwZGF0ZUh0bWwoaHJlZikge1xuICAgIHZhciBmcmFnbWVudCA9IGdlbmVyYXRvci5mcmFnbWVudCRbaHJlZl07XG4gICAgaWYgKCFmcmFnbWVudCkgcmV0dXJuIGxvZygnanF1ZXJ5dmlldyBjYW5ub3QgZmluZCBmcmFnbWVudDogJyArIGhyZWYpO1xuXG4gICAgdmFyICRodG1sID0gJCgnW2RhdGEtcmVuZGVyLWh0bWw9XCInICsgaHJlZiArICdcIl0nKTtcbiAgICBpZiAoISRodG1sLmxlbmd0aCkgcmV0dXJuIGxvZygnanF1ZXJ5dmlldyBjYW5ub3QgdXBkYXRlIGh0bWwgZm9yIGZyYWdtZW50OiAnICsgaHJlZik7XG5cbiAgICBnZW5lcmF0b3IuZW1pdCgnYmVmb3JlLXVwZGF0ZS12aWV3JywgJGh0bWwpO1xuICAgICRodG1sLnJlcGxhY2VXaXRoKGdlbmVyYXRvci5yZW5kZXJIdG1sKGZyYWdtZW50KSk7XG4gICAgZ2VuZXJhdG9yLmVtaXQoJ2FmdGVyLXVwZGF0ZS12aWV3JywgJGh0bWwpO1xuICB9XG5cbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5leHBvcnRzLnN0b3JhZ2UgPSAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lXG4gICAgICAgICAgICAgICAmJiAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lLnN0b3JhZ2VcbiAgICAgICAgICAgICAgICAgID8gY2hyb21lLnN0b3JhZ2UubG9jYWxcbiAgICAgICAgICAgICAgICAgIDogbG9jYWxzdG9yYWdlKCk7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLmRlYnVnID0gbmFtZXNwYWNlcztcbiAgICB9XG4gIH0gY2F0Y2goZSkge31cbn1cblxuLyoqXG4gKiBMb2FkIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2FkKCkge1xuICB2YXIgcjtcbiAgdHJ5IHtcbiAgICByID0gZXhwb3J0cy5zdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuLyoqXG4gKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG4gKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cbiAqXG4gKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKXtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZTtcbiAgfSBjYXRjaCAoZSkge31cbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSAnJyArIHN0cjtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDAwMCkgcmV0dXJuO1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHN0cik7XG4gIGlmICghbWF0Y2gpIHJldHVybjtcbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3lycyc6XG4gICAgY2FzZSAneXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ2RheXMnOlxuICAgIGNhc2UgJ2RheSc6XG4gICAgY2FzZSAnZCc6XG4gICAgICByZXR1cm4gbiAqIGQ7XG4gICAgY2FzZSAnaG91cnMnOlxuICAgIGNhc2UgJ2hvdXInOlxuICAgIGNhc2UgJ2hycyc6XG4gICAgY2FzZSAnaHInOlxuICAgIGNhc2UgJ2gnOlxuICAgICAgcmV0dXJuIG4gKiBoO1xuICAgIGNhc2UgJ21pbnV0ZXMnOlxuICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgY2FzZSAnbWlucyc6XG4gICAgY2FzZSAnbWluJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3NlY3MnOlxuICAgIGNhc2UgJ3NlYyc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICBjYXNlICdtaWxsaXNlY29uZCc6XG4gICAgY2FzZSAnbXNlY3MnOlxuICAgIGNhc2UgJ21zZWMnOlxuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuIiwiICAvKiBnbG9iYWxzIHJlcXVpcmUsIG1vZHVsZSAqL1xuXG4gICd1c2Ugc3RyaWN0JztcblxuICAvKipcbiAgICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAgICovXG5cbiAgdmFyIHBhdGh0b1JlZ2V4cCA9IHJlcXVpcmUoJ3BhdGgtdG8tcmVnZXhwJyk7XG5cbiAgLyoqXG4gICAqIE1vZHVsZSBleHBvcnRzLlxuICAgKi9cblxuICBtb2R1bGUuZXhwb3J0cyA9IHBhZ2U7XG5cbiAgLyoqXG4gICAqIERldGVjdCBjbGljayBldmVudFxuICAgKi9cbiAgdmFyIGNsaWNrRXZlbnQgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkb2N1bWVudCkgJiYgZG9jdW1lbnQub250b3VjaHN0YXJ0ID8gJ3RvdWNoc3RhcnQnIDogJ2NsaWNrJztcblxuICAvKipcbiAgICogVG8gd29yayBwcm9wZXJseSB3aXRoIHRoZSBVUkxcbiAgICogaGlzdG9yeS5sb2NhdGlvbiBnZW5lcmF0ZWQgcG9seWZpbGwgaW4gaHR0cHM6Ly9naXRodWIuY29tL2Rldm90ZS9IVE1MNS1IaXN0b3J5LUFQSVxuICAgKi9cblxuICB2YXIgbG9jYXRpb24gPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiB3aW5kb3cpICYmICh3aW5kb3cuaGlzdG9yeS5sb2NhdGlvbiB8fCB3aW5kb3cubG9jYXRpb24pO1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtIGluaXRpYWwgZGlzcGF0Y2guXG4gICAqL1xuXG4gIHZhciBkaXNwYXRjaCA9IHRydWU7XG5cblxuICAvKipcbiAgICogRGVjb2RlIFVSTCBjb21wb25lbnRzIChxdWVyeSBzdHJpbmcsIHBhdGhuYW1lLCBoYXNoKS5cbiAgICogQWNjb21tb2RhdGVzIGJvdGggcmVndWxhciBwZXJjZW50IGVuY29kaW5nIGFuZCB4LXd3dy1mb3JtLXVybGVuY29kZWQgZm9ybWF0LlxuICAgKi9cbiAgdmFyIGRlY29kZVVSTENvbXBvbmVudHMgPSB0cnVlO1xuXG4gIC8qKlxuICAgKiBCYXNlIHBhdGguXG4gICAqL1xuXG4gIHZhciBiYXNlID0gJyc7XG5cbiAgLyoqXG4gICAqIFJ1bm5pbmcgZmxhZy5cbiAgICovXG5cbiAgdmFyIHJ1bm5pbmc7XG5cbiAgLyoqXG4gICAqIEhhc2hCYW5nIG9wdGlvblxuICAgKi9cblxuICB2YXIgaGFzaGJhbmcgPSBmYWxzZTtcblxuICAvKipcbiAgICogUHJldmlvdXMgY29udGV4dCwgZm9yIGNhcHR1cmluZ1xuICAgKiBwYWdlIGV4aXQgZXZlbnRzLlxuICAgKi9cblxuICB2YXIgcHJldkNvbnRleHQ7XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGBwYXRoYCB3aXRoIGNhbGxiYWNrIGBmbigpYCxcbiAgICogb3Igcm91dGUgYHBhdGhgLCBvciByZWRpcmVjdGlvbixcbiAgICogb3IgYHBhZ2Uuc3RhcnQoKWAuXG4gICAqXG4gICAqICAgcGFnZShmbik7XG4gICAqICAgcGFnZSgnKicsIGZuKTtcbiAgICogICBwYWdlKCcvdXNlci86aWQnLCBsb2FkLCB1c2VyKTtcbiAgICogICBwYWdlKCcvdXNlci8nICsgdXNlci5pZCwgeyBzb21lOiAndGhpbmcnIH0pO1xuICAgKiAgIHBhZ2UoJy91c2VyLycgKyB1c2VyLmlkKTtcbiAgICogICBwYWdlKCcvZnJvbScsICcvdG8nKVxuICAgKiAgIHBhZ2UoKTtcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8RnVuY3Rpb259IHBhdGhcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4uLi5cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gcGFnZShwYXRoLCBmbikge1xuICAgIC8vIDxjYWxsYmFjaz5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBhdGgpIHtcbiAgICAgIHJldHVybiBwYWdlKCcqJywgcGF0aCk7XG4gICAgfVxuXG4gICAgLy8gcm91dGUgPHBhdGg+IHRvIDxjYWxsYmFjayAuLi4+XG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmbikge1xuICAgICAgdmFyIHJvdXRlID0gbmV3IFJvdXRlKHBhdGgpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgcGFnZS5jYWxsYmFja3MucHVzaChyb3V0ZS5taWRkbGV3YXJlKGFyZ3VtZW50c1tpXSkpO1xuICAgICAgfVxuICAgICAgLy8gc2hvdyA8cGF0aD4gd2l0aCBbc3RhdGVdXG4gICAgfSBlbHNlIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIHBhdGgpIHtcbiAgICAgIHBhZ2VbJ3N0cmluZycgPT09IHR5cGVvZiBmbiA/ICdyZWRpcmVjdCcgOiAnc2hvdyddKHBhdGgsIGZuKTtcbiAgICAgIC8vIHN0YXJ0IFtvcHRpb25zXVxuICAgIH0gZWxzZSB7XG4gICAgICBwYWdlLnN0YXJ0KHBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayBmdW5jdGlvbnMuXG4gICAqL1xuXG4gIHBhZ2UuY2FsbGJhY2tzID0gW107XG4gIHBhZ2UuZXhpdHMgPSBbXTtcblxuICAvKipcbiAgICogQ3VycmVudCBwYXRoIGJlaW5nIHByb2Nlc3NlZFxuICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgKi9cbiAgcGFnZS5jdXJyZW50ID0gJyc7XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBwYWdlcyBuYXZpZ2F0ZWQgdG8uXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqXG4gICAqICAgICBwYWdlLmxlbiA9PSAwO1xuICAgKiAgICAgcGFnZSgnL2xvZ2luJyk7XG4gICAqICAgICBwYWdlLmxlbiA9PSAxO1xuICAgKi9cblxuICBwYWdlLmxlbiA9IDA7XG5cbiAgLyoqXG4gICAqIEdldCBvciBzZXQgYmFzZXBhdGggdG8gYHBhdGhgLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBwYWdlLmJhc2UgPSBmdW5jdGlvbihwYXRoKSB7XG4gICAgaWYgKDAgPT09IGFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBiYXNlO1xuICAgIGJhc2UgPSBwYXRoO1xuICB9O1xuXG4gIC8qKlxuICAgKiBCaW5kIHdpdGggdGhlIGdpdmVuIGBvcHRpb25zYC5cbiAgICpcbiAgICogT3B0aW9uczpcbiAgICpcbiAgICogICAgLSBgY2xpY2tgIGJpbmQgdG8gY2xpY2sgZXZlbnRzIFt0cnVlXVxuICAgKiAgICAtIGBwb3BzdGF0ZWAgYmluZCB0byBwb3BzdGF0ZSBbdHJ1ZV1cbiAgICogICAgLSBgZGlzcGF0Y2hgIHBlcmZvcm0gaW5pdGlhbCBkaXNwYXRjaCBbdHJ1ZV1cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgcGFnZS5zdGFydCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICBpZiAocnVubmluZykgcmV0dXJuO1xuICAgIHJ1bm5pbmcgPSB0cnVlO1xuICAgIGlmIChmYWxzZSA9PT0gb3B0aW9ucy5kaXNwYXRjaCkgZGlzcGF0Y2ggPSBmYWxzZTtcbiAgICBpZiAoZmFsc2UgPT09IG9wdGlvbnMuZGVjb2RlVVJMQ29tcG9uZW50cykgZGVjb2RlVVJMQ29tcG9uZW50cyA9IGZhbHNlO1xuICAgIGlmIChmYWxzZSAhPT0gb3B0aW9ucy5wb3BzdGF0ZSkgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgb25wb3BzdGF0ZSwgZmFsc2UpO1xuICAgIGlmIChmYWxzZSAhPT0gb3B0aW9ucy5jbGljaykge1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihjbGlja0V2ZW50LCBvbmNsaWNrLCBmYWxzZSk7XG4gICAgfVxuICAgIGlmICh0cnVlID09PSBvcHRpb25zLmhhc2hiYW5nKSBoYXNoYmFuZyA9IHRydWU7XG4gICAgaWYgKCFkaXNwYXRjaCkgcmV0dXJuO1xuICAgIHZhciB1cmwgPSAoaGFzaGJhbmcgJiYgfmxvY2F0aW9uLmhhc2guaW5kZXhPZignIyEnKSkgPyBsb2NhdGlvbi5oYXNoLnN1YnN0cigyKSArIGxvY2F0aW9uLnNlYXJjaCA6IGxvY2F0aW9uLnBhdGhuYW1lICsgbG9jYXRpb24uc2VhcmNoICsgbG9jYXRpb24uaGFzaDtcbiAgICBwYWdlLnJlcGxhY2UodXJsLCBudWxsLCB0cnVlLCBkaXNwYXRjaCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFVuYmluZCBjbGljayBhbmQgcG9wc3RhdGUgZXZlbnQgaGFuZGxlcnMuXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIHBhZ2Uuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghcnVubmluZykgcmV0dXJuO1xuICAgIHBhZ2UuY3VycmVudCA9ICcnO1xuICAgIHBhZ2UubGVuID0gMDtcbiAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihjbGlja0V2ZW50LCBvbmNsaWNrLCBmYWxzZSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgb25wb3BzdGF0ZSwgZmFsc2UpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTaG93IGBwYXRoYCB3aXRoIG9wdGlvbmFsIGBzdGF0ZWAgb2JqZWN0LlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge09iamVjdH0gc3RhdGVcbiAgICogQHBhcmFtIHtCb29sZWFufSBkaXNwYXRjaFxuICAgKiBAcmV0dXJuIHtDb250ZXh0fVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBwYWdlLnNob3cgPSBmdW5jdGlvbihwYXRoLCBzdGF0ZSwgZGlzcGF0Y2gsIHB1c2gpIHtcbiAgICB2YXIgY3R4ID0gbmV3IENvbnRleHQocGF0aCwgc3RhdGUpO1xuICAgIHBhZ2UuY3VycmVudCA9IGN0eC5wYXRoO1xuICAgIGlmIChmYWxzZSAhPT0gZGlzcGF0Y2gpIHBhZ2UuZGlzcGF0Y2goY3R4KTtcbiAgICBpZiAoZmFsc2UgIT09IGN0eC5oYW5kbGVkICYmIGZhbHNlICE9PSBwdXNoKSBjdHgucHVzaFN0YXRlKCk7XG4gICAgcmV0dXJuIGN0eDtcbiAgfTtcblxuICAvKipcbiAgICogR29lcyBiYWNrIGluIHRoZSBoaXN0b3J5XG4gICAqIEJhY2sgc2hvdWxkIGFsd2F5cyBsZXQgdGhlIGN1cnJlbnQgcm91dGUgcHVzaCBzdGF0ZSBhbmQgdGhlbiBnbyBiYWNrLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCAtIGZhbGxiYWNrIHBhdGggdG8gZ28gYmFjayBpZiBubyBtb3JlIGhpc3RvcnkgZXhpc3RzLCBpZiB1bmRlZmluZWQgZGVmYXVsdHMgdG8gcGFnZS5iYXNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbc3RhdGVdXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIHBhZ2UuYmFjayA9IGZ1bmN0aW9uKHBhdGgsIHN0YXRlKSB7XG4gICAgaWYgKHBhZ2UubGVuID4gMCkge1xuICAgICAgLy8gdGhpcyBtYXkgbmVlZCBtb3JlIHRlc3RpbmcgdG8gc2VlIGlmIGFsbCBicm93c2Vyc1xuICAgICAgLy8gd2FpdCBmb3IgdGhlIG5leHQgdGljayB0byBnbyBiYWNrIGluIGhpc3RvcnlcbiAgICAgIGhpc3RvcnkuYmFjaygpO1xuICAgICAgcGFnZS5sZW4tLTtcbiAgICB9IGVsc2UgaWYgKHBhdGgpIHtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHBhZ2Uuc2hvdyhwYXRoLCBzdGF0ZSk7XG4gICAgICB9KTtcbiAgICB9ZWxzZXtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHBhZ2Uuc2hvdyhiYXNlLCBzdGF0ZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cblxuICAvKipcbiAgICogUmVnaXN0ZXIgcm91dGUgdG8gcmVkaXJlY3QgZnJvbSBvbmUgcGF0aCB0byBvdGhlclxuICAgKiBvciBqdXN0IHJlZGlyZWN0IHRvIGFub3RoZXIgcm91dGVcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGZyb20gLSBpZiBwYXJhbSAndG8nIGlzIHVuZGVmaW5lZCByZWRpcmVjdHMgdG8gJ2Zyb20nXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbdG9dXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuICBwYWdlLnJlZGlyZWN0ID0gZnVuY3Rpb24oZnJvbSwgdG8pIHtcbiAgICAvLyBEZWZpbmUgcm91dGUgZnJvbSBhIHBhdGggdG8gYW5vdGhlclxuICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIGZyb20gJiYgJ3N0cmluZycgPT09IHR5cGVvZiB0bykge1xuICAgICAgcGFnZShmcm9tLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcGFnZS5yZXBsYWNlKHRvKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBXYWl0IGZvciB0aGUgcHVzaCBzdGF0ZSBhbmQgcmVwbGFjZSBpdCB3aXRoIGFub3RoZXJcbiAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBmcm9tICYmICd1bmRlZmluZWQnID09PSB0eXBlb2YgdG8pIHtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHBhZ2UucmVwbGFjZShmcm9tKTtcbiAgICAgIH0sIDApO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogUmVwbGFjZSBgcGF0aGAgd2l0aCBvcHRpb25hbCBgc3RhdGVgIG9iamVjdC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtPYmplY3R9IHN0YXRlXG4gICAqIEByZXR1cm4ge0NvbnRleHR9XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG5cbiAgcGFnZS5yZXBsYWNlID0gZnVuY3Rpb24ocGF0aCwgc3RhdGUsIGluaXQsIGRpc3BhdGNoKSB7XG4gICAgdmFyIGN0eCA9IG5ldyBDb250ZXh0KHBhdGgsIHN0YXRlKTtcbiAgICBwYWdlLmN1cnJlbnQgPSBjdHgucGF0aDtcbiAgICBjdHguaW5pdCA9IGluaXQ7XG4gICAgY3R4LnNhdmUoKTsgLy8gc2F2ZSBiZWZvcmUgZGlzcGF0Y2hpbmcsIHdoaWNoIG1heSByZWRpcmVjdFxuICAgIGlmIChmYWxzZSAhPT0gZGlzcGF0Y2gpIHBhZ2UuZGlzcGF0Y2goY3R4KTtcbiAgICByZXR1cm4gY3R4O1xuICB9O1xuXG4gIC8qKlxuICAgKiBEaXNwYXRjaCB0aGUgZ2l2ZW4gYGN0eGAuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjdHhcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIHBhZ2UuZGlzcGF0Y2ggPSBmdW5jdGlvbihjdHgpIHtcbiAgICB2YXIgcHJldiA9IHByZXZDb250ZXh0LFxuICAgICAgaSA9IDAsXG4gICAgICBqID0gMDtcblxuICAgIHByZXZDb250ZXh0ID0gY3R4O1xuXG4gICAgZnVuY3Rpb24gbmV4dEV4aXQoKSB7XG4gICAgICB2YXIgZm4gPSBwYWdlLmV4aXRzW2orK107XG4gICAgICBpZiAoIWZuKSByZXR1cm4gbmV4dEVudGVyKCk7XG4gICAgICBmbihwcmV2LCBuZXh0RXhpdCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbmV4dEVudGVyKCkge1xuICAgICAgdmFyIGZuID0gcGFnZS5jYWxsYmFja3NbaSsrXTtcblxuICAgICAgaWYgKGN0eC5wYXRoICE9PSBwYWdlLmN1cnJlbnQpIHtcbiAgICAgICAgY3R4LmhhbmRsZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCFmbikgcmV0dXJuIHVuaGFuZGxlZChjdHgpO1xuICAgICAgZm4oY3R4LCBuZXh0RW50ZXIpO1xuICAgIH1cblxuICAgIGlmIChwcmV2KSB7XG4gICAgICBuZXh0RXhpdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0RW50ZXIoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFVuaGFuZGxlZCBgY3R4YC4gV2hlbiBpdCdzIG5vdCB0aGUgaW5pdGlhbFxuICAgKiBwb3BzdGF0ZSB0aGVuIHJlZGlyZWN0LiBJZiB5b3Ugd2lzaCB0byBoYW5kbGVcbiAgICogNDA0cyBvbiB5b3VyIG93biB1c2UgYHBhZ2UoJyonLCBjYWxsYmFjaylgLlxuICAgKlxuICAgKiBAcGFyYW0ge0NvbnRleHR9IGN0eFxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgZnVuY3Rpb24gdW5oYW5kbGVkKGN0eCkge1xuICAgIGlmIChjdHguaGFuZGxlZCkgcmV0dXJuO1xuICAgIHZhciBjdXJyZW50O1xuXG4gICAgaWYgKGhhc2hiYW5nKSB7XG4gICAgICBjdXJyZW50ID0gYmFzZSArIGxvY2F0aW9uLmhhc2gucmVwbGFjZSgnIyEnLCAnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1cnJlbnQgPSBsb2NhdGlvbi5wYXRobmFtZSArIGxvY2F0aW9uLnNlYXJjaDtcbiAgICB9XG5cbiAgICBpZiAoY3VycmVudCA9PT0gY3R4LmNhbm9uaWNhbFBhdGgpIHJldHVybjtcbiAgICBwYWdlLnN0b3AoKTtcbiAgICBjdHguaGFuZGxlZCA9IGZhbHNlO1xuICAgIGxvY2F0aW9uLmhyZWYgPSBjdHguY2Fub25pY2FsUGF0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhbiBleGl0IHJvdXRlIG9uIGBwYXRoYCB3aXRoXG4gICAqIGNhbGxiYWNrIGBmbigpYCwgd2hpY2ggd2lsbCBiZSBjYWxsZWRcbiAgICogb24gdGhlIHByZXZpb3VzIGNvbnRleHQgd2hlbiBhIG5ld1xuICAgKiBwYWdlIGlzIHZpc2l0ZWQuXG4gICAqL1xuICBwYWdlLmV4aXQgPSBmdW5jdGlvbihwYXRoLCBmbikge1xuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIHBhZ2UuZXhpdCgnKicsIHBhdGgpO1xuICAgIH1cblxuICAgIHZhciByb3V0ZSA9IG5ldyBSb3V0ZShwYXRoKTtcbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgcGFnZS5leGl0cy5wdXNoKHJvdXRlLm1pZGRsZXdhcmUoYXJndW1lbnRzW2ldKSk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBSZW1vdmUgVVJMIGVuY29kaW5nIGZyb20gdGhlIGdpdmVuIGBzdHJgLlxuICAgKiBBY2NvbW1vZGF0ZXMgd2hpdGVzcGFjZSBpbiBib3RoIHgtd3d3LWZvcm0tdXJsZW5jb2RlZFxuICAgKiBhbmQgcmVndWxhciBwZXJjZW50LWVuY29kZWQgZm9ybS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJ9IFVSTCBjb21wb25lbnQgdG8gZGVjb2RlXG4gICAqL1xuICBmdW5jdGlvbiBkZWNvZGVVUkxFbmNvZGVkVVJJQ29tcG9uZW50KHZhbCkge1xuICAgIGlmICh0eXBlb2YgdmFsICE9PSAnc3RyaW5nJykgeyByZXR1cm4gdmFsOyB9XG4gICAgcmV0dXJuIGRlY29kZVVSTENvbXBvbmVudHMgPyBkZWNvZGVVUklDb21wb25lbnQodmFsLnJlcGxhY2UoL1xcKy9nLCAnICcpKSA6IHZhbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIGEgbmV3IFwicmVxdWVzdFwiIGBDb250ZXh0YFxuICAgKiB3aXRoIHRoZSBnaXZlbiBgcGF0aGAgYW5kIG9wdGlvbmFsIGluaXRpYWwgYHN0YXRlYC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtPYmplY3R9IHN0YXRlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIENvbnRleHQocGF0aCwgc3RhdGUpIHtcbiAgICBpZiAoJy8nID09PSBwYXRoWzBdICYmIDAgIT09IHBhdGguaW5kZXhPZihiYXNlKSkgcGF0aCA9IGJhc2UgKyAoaGFzaGJhbmcgPyAnIyEnIDogJycpICsgcGF0aDtcbiAgICB2YXIgaSA9IHBhdGguaW5kZXhPZignPycpO1xuXG4gICAgdGhpcy5jYW5vbmljYWxQYXRoID0gcGF0aDtcbiAgICB0aGlzLnBhdGggPSBwYXRoLnJlcGxhY2UoYmFzZSwgJycpIHx8ICcvJztcbiAgICBpZiAoaGFzaGJhbmcpIHRoaXMucGF0aCA9IHRoaXMucGF0aC5yZXBsYWNlKCcjIScsICcnKSB8fCAnLyc7XG5cbiAgICB0aGlzLnRpdGxlID0gZG9jdW1lbnQudGl0bGU7XG4gICAgdGhpcy5zdGF0ZSA9IHN0YXRlIHx8IHt9O1xuICAgIHRoaXMuc3RhdGUucGF0aCA9IHBhdGg7XG4gICAgdGhpcy5xdWVyeXN0cmluZyA9IH5pID8gZGVjb2RlVVJMRW5jb2RlZFVSSUNvbXBvbmVudChwYXRoLnNsaWNlKGkgKyAxKSkgOiAnJztcbiAgICB0aGlzLnBhdGhuYW1lID0gZGVjb2RlVVJMRW5jb2RlZFVSSUNvbXBvbmVudCh+aSA/IHBhdGguc2xpY2UoMCwgaSkgOiBwYXRoKTtcbiAgICB0aGlzLnBhcmFtcyA9IHt9O1xuXG4gICAgLy8gZnJhZ21lbnRcbiAgICB0aGlzLmhhc2ggPSAnJztcbiAgICBpZiAoIWhhc2hiYW5nKSB7XG4gICAgICBpZiAoIX50aGlzLnBhdGguaW5kZXhPZignIycpKSByZXR1cm47XG4gICAgICB2YXIgcGFydHMgPSB0aGlzLnBhdGguc3BsaXQoJyMnKTtcbiAgICAgIHRoaXMucGF0aCA9IHBhcnRzWzBdO1xuICAgICAgdGhpcy5oYXNoID0gZGVjb2RlVVJMRW5jb2RlZFVSSUNvbXBvbmVudChwYXJ0c1sxXSkgfHwgJyc7XG4gICAgICB0aGlzLnF1ZXJ5c3RyaW5nID0gdGhpcy5xdWVyeXN0cmluZy5zcGxpdCgnIycpWzBdO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHBvc2UgYENvbnRleHRgLlxuICAgKi9cblxuICBwYWdlLkNvbnRleHQgPSBDb250ZXh0O1xuXG4gIC8qKlxuICAgKiBQdXNoIHN0YXRlLlxuICAgKlxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgQ29udGV4dC5wcm90b3R5cGUucHVzaFN0YXRlID0gZnVuY3Rpb24oKSB7XG4gICAgcGFnZS5sZW4rKztcbiAgICBoaXN0b3J5LnB1c2hTdGF0ZSh0aGlzLnN0YXRlLCB0aGlzLnRpdGxlLCBoYXNoYmFuZyAmJiB0aGlzLnBhdGggIT09ICcvJyA/ICcjIScgKyB0aGlzLnBhdGggOiB0aGlzLmNhbm9uaWNhbFBhdGgpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTYXZlIHRoZSBjb250ZXh0IHN0YXRlLlxuICAgKlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBDb250ZXh0LnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oKSB7XG4gICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUodGhpcy5zdGF0ZSwgdGhpcy50aXRsZSwgaGFzaGJhbmcgJiYgdGhpcy5wYXRoICE9PSAnLycgPyAnIyEnICsgdGhpcy5wYXRoIDogdGhpcy5jYW5vbmljYWxQYXRoKTtcbiAgfTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSBgUm91dGVgIHdpdGggdGhlIGdpdmVuIEhUVFAgYHBhdGhgLFxuICAgKiBhbmQgYW4gYXJyYXkgb2YgYGNhbGxiYWNrc2AgYW5kIGBvcHRpb25zYC5cbiAgICpcbiAgICogT3B0aW9uczpcbiAgICpcbiAgICogICAtIGBzZW5zaXRpdmVgICAgIGVuYWJsZSBjYXNlLXNlbnNpdGl2ZSByb3V0ZXNcbiAgICogICAtIGBzdHJpY3RgICAgICAgIGVuYWJsZSBzdHJpY3QgbWF0Y2hpbmcgZm9yIHRyYWlsaW5nIHNsYXNoZXNcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBmdW5jdGlvbiBSb3V0ZShwYXRoLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdGhpcy5wYXRoID0gKHBhdGggPT09ICcqJykgPyAnKC4qKScgOiBwYXRoO1xuICAgIHRoaXMubWV0aG9kID0gJ0dFVCc7XG4gICAgdGhpcy5yZWdleHAgPSBwYXRodG9SZWdleHAodGhpcy5wYXRoLFxuICAgICAgdGhpcy5rZXlzID0gW10sXG4gICAgICBvcHRpb25zLnNlbnNpdGl2ZSxcbiAgICAgIG9wdGlvbnMuc3RyaWN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHBvc2UgYFJvdXRlYC5cbiAgICovXG5cbiAgcGFnZS5Sb3V0ZSA9IFJvdXRlO1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gcm91dGUgbWlkZGxld2FyZSB3aXRoXG4gICAqIHRoZSBnaXZlbiBjYWxsYmFjayBgZm4oKWAuXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBSb3V0ZS5wcm90b3R5cGUubWlkZGxld2FyZSA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBmdW5jdGlvbihjdHgsIG5leHQpIHtcbiAgICAgIGlmIChzZWxmLm1hdGNoKGN0eC5wYXRoLCBjdHgucGFyYW1zKSkgcmV0dXJuIGZuKGN0eCwgbmV4dCk7XG4gICAgICBuZXh0KCk7XG4gICAgfTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhpcyByb3V0ZSBtYXRjaGVzIGBwYXRoYCwgaWYgc29cbiAgICogcG9wdWxhdGUgYHBhcmFtc2AuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXNcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIFJvdXRlLnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uKHBhdGgsIHBhcmFtcykge1xuICAgIHZhciBrZXlzID0gdGhpcy5rZXlzLFxuICAgICAgcXNJbmRleCA9IHBhdGguaW5kZXhPZignPycpLFxuICAgICAgcGF0aG5hbWUgPSB+cXNJbmRleCA/IHBhdGguc2xpY2UoMCwgcXNJbmRleCkgOiBwYXRoLFxuICAgICAgbSA9IHRoaXMucmVnZXhwLmV4ZWMoZGVjb2RlVVJJQ29tcG9uZW50KHBhdGhuYW1lKSk7XG5cbiAgICBpZiAoIW0pIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAxLCBsZW4gPSBtLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICB2YXIga2V5ID0ga2V5c1tpIC0gMV07XG4gICAgICB2YXIgdmFsID0gZGVjb2RlVVJMRW5jb2RlZFVSSUNvbXBvbmVudChtW2ldKTtcbiAgICAgIGlmICh2YWwgIT09IHVuZGVmaW5lZCB8fCAhKGhhc093blByb3BlcnR5LmNhbGwocGFyYW1zLCBrZXkubmFtZSkpKSB7XG4gICAgICAgIHBhcmFtc1trZXkubmFtZV0gPSB2YWw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cblxuICAvKipcbiAgICogSGFuZGxlIFwicG9wdWxhdGVcIiBldmVudHMuXG4gICAqL1xuXG4gIHZhciBvbnBvcHN0YXRlID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9hZGVkID0gZmFsc2U7XG4gICAgaWYgKCd1bmRlZmluZWQnID09PSB0eXBlb2Ygd2luZG93KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnKSB7XG4gICAgICBsb2FkZWQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGxvYWRlZCA9IHRydWU7XG4gICAgICAgIH0sIDApO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbiBvbnBvcHN0YXRlKGUpIHtcbiAgICAgIGlmICghbG9hZGVkKSByZXR1cm47XG4gICAgICBpZiAoZS5zdGF0ZSkge1xuICAgICAgICB2YXIgcGF0aCA9IGUuc3RhdGUucGF0aDtcbiAgICAgICAgcGFnZS5yZXBsYWNlKHBhdGgsIGUuc3RhdGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFnZS5zaG93KGxvY2F0aW9uLnBhdGhuYW1lICsgbG9jYXRpb24uaGFzaCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpO1xuICAvKipcbiAgICogSGFuZGxlIFwiY2xpY2tcIiBldmVudHMuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIG9uY2xpY2soZSkge1xuXG4gICAgaWYgKDEgIT09IHdoaWNoKGUpKSByZXR1cm47XG5cbiAgICBpZiAoZS5tZXRhS2V5IHx8IGUuY3RybEtleSB8fCBlLnNoaWZ0S2V5KSByZXR1cm47XG4gICAgaWYgKGUuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuO1xuXG5cblxuICAgIC8vIGVuc3VyZSBsaW5rXG4gICAgdmFyIGVsID0gZS50YXJnZXQ7XG4gICAgd2hpbGUgKGVsICYmICdBJyAhPT0gZWwubm9kZU5hbWUpIGVsID0gZWwucGFyZW50Tm9kZTtcbiAgICBpZiAoIWVsIHx8ICdBJyAhPT0gZWwubm9kZU5hbWUpIHJldHVybjtcblxuXG5cbiAgICAvLyBJZ25vcmUgaWYgdGFnIGhhc1xuICAgIC8vIDEuIFwiZG93bmxvYWRcIiBhdHRyaWJ1dGVcbiAgICAvLyAyLiByZWw9XCJleHRlcm5hbFwiIGF0dHJpYnV0ZVxuICAgIGlmIChlbC5oYXNBdHRyaWJ1dGUoJ2Rvd25sb2FkJykgfHwgZWwuZ2V0QXR0cmlidXRlKCdyZWwnKSA9PT0gJ2V4dGVybmFsJykgcmV0dXJuO1xuXG4gICAgLy8gZW5zdXJlIG5vbi1oYXNoIGZvciB0aGUgc2FtZSBwYXRoXG4gICAgdmFyIGxpbmsgPSBlbC5nZXRBdHRyaWJ1dGUoJ2hyZWYnKTtcbiAgICBpZiAoIWhhc2hiYW5nICYmIGVsLnBhdGhuYW1lID09PSBsb2NhdGlvbi5wYXRobmFtZSAmJiAoZWwuaGFzaCB8fCAnIycgPT09IGxpbmspKSByZXR1cm47XG5cblxuXG4gICAgLy8gQ2hlY2sgZm9yIG1haWx0bzogaW4gdGhlIGhyZWZcbiAgICBpZiAobGluayAmJiBsaW5rLmluZGV4T2YoJ21haWx0bzonKSA+IC0xKSByZXR1cm47XG5cbiAgICAvLyBjaGVjayB0YXJnZXRcbiAgICBpZiAoZWwudGFyZ2V0KSByZXR1cm47XG5cbiAgICAvLyB4LW9yaWdpblxuICAgIGlmICghc2FtZU9yaWdpbihlbC5ocmVmKSkgcmV0dXJuO1xuXG5cblxuICAgIC8vIHJlYnVpbGQgcGF0aFxuICAgIHZhciBwYXRoID0gZWwucGF0aG5hbWUgKyBlbC5zZWFyY2ggKyAoZWwuaGFzaCB8fCAnJyk7XG5cbiAgICAvLyBzdHJpcCBsZWFkaW5nIFwiL1tkcml2ZSBsZXR0ZXJdOlwiIG9uIE5XLmpzIG9uIFdpbmRvd3NcbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHBhdGgubWF0Y2goL15cXC9bYS16QS1aXTpcXC8vKSkge1xuICAgICAgcGF0aCA9IHBhdGgucmVwbGFjZSgvXlxcL1thLXpBLVpdOlxcLy8sICcvJyk7XG4gICAgfVxuXG4gICAgLy8gc2FtZSBwYWdlXG4gICAgdmFyIG9yaWcgPSBwYXRoO1xuXG4gICAgaWYgKHBhdGguaW5kZXhPZihiYXNlKSA9PT0gMCkge1xuICAgICAgcGF0aCA9IHBhdGguc3Vic3RyKGJhc2UubGVuZ3RoKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzaGJhbmcpIHBhdGggPSBwYXRoLnJlcGxhY2UoJyMhJywgJycpO1xuXG4gICAgaWYgKGJhc2UgJiYgb3JpZyA9PT0gcGF0aCkgcmV0dXJuO1xuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHBhZ2Uuc2hvdyhvcmlnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmVudCBidXR0b24uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHdoaWNoKGUpIHtcbiAgICBlID0gZSB8fCB3aW5kb3cuZXZlbnQ7XG4gICAgcmV0dXJuIG51bGwgPT09IGUud2hpY2ggPyBlLmJ1dHRvbiA6IGUud2hpY2g7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgYGhyZWZgIGlzIHRoZSBzYW1lIG9yaWdpbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gc2FtZU9yaWdpbihocmVmKSB7XG4gICAgdmFyIG9yaWdpbiA9IGxvY2F0aW9uLnByb3RvY29sICsgJy8vJyArIGxvY2F0aW9uLmhvc3RuYW1lO1xuICAgIGlmIChsb2NhdGlvbi5wb3J0KSBvcmlnaW4gKz0gJzonICsgbG9jYXRpb24ucG9ydDtcbiAgICByZXR1cm4gKGhyZWYgJiYgKDAgPT09IGhyZWYuaW5kZXhPZihvcmlnaW4pKSk7XG4gIH1cblxuICBwYWdlLnNhbWVPcmlnaW4gPSBzYW1lT3JpZ2luO1xuIiwidmFyIGlzYXJyYXkgPSByZXF1aXJlKCdpc2FycmF5JylcblxuLyoqXG4gKiBFeHBvc2UgYHBhdGhUb1JlZ2V4cGAuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gcGF0aFRvUmVnZXhwXG5tb2R1bGUuZXhwb3J0cy5wYXJzZSA9IHBhcnNlXG5tb2R1bGUuZXhwb3J0cy5jb21waWxlID0gY29tcGlsZVxubW9kdWxlLmV4cG9ydHMudG9rZW5zVG9GdW5jdGlvbiA9IHRva2Vuc1RvRnVuY3Rpb25cbm1vZHVsZS5leHBvcnRzLnRva2Vuc1RvUmVnRXhwID0gdG9rZW5zVG9SZWdFeHBcblxuLyoqXG4gKiBUaGUgbWFpbiBwYXRoIG1hdGNoaW5nIHJlZ2V4cCB1dGlsaXR5LlxuICpcbiAqIEB0eXBlIHtSZWdFeHB9XG4gKi9cbnZhciBQQVRIX1JFR0VYUCA9IG5ldyBSZWdFeHAoW1xuICAvLyBNYXRjaCBlc2NhcGVkIGNoYXJhY3RlcnMgdGhhdCB3b3VsZCBvdGhlcndpc2UgYXBwZWFyIGluIGZ1dHVyZSBtYXRjaGVzLlxuICAvLyBUaGlzIGFsbG93cyB0aGUgdXNlciB0byBlc2NhcGUgc3BlY2lhbCBjaGFyYWN0ZXJzIHRoYXQgd29uJ3QgdHJhbnNmb3JtLlxuICAnKFxcXFxcXFxcLiknLFxuICAvLyBNYXRjaCBFeHByZXNzLXN0eWxlIHBhcmFtZXRlcnMgYW5kIHVuLW5hbWVkIHBhcmFtZXRlcnMgd2l0aCBhIHByZWZpeFxuICAvLyBhbmQgb3B0aW9uYWwgc3VmZml4ZXMuIE1hdGNoZXMgYXBwZWFyIGFzOlxuICAvL1xuICAvLyBcIi86dGVzdChcXFxcZCspP1wiID0+IFtcIi9cIiwgXCJ0ZXN0XCIsIFwiXFxkK1wiLCB1bmRlZmluZWQsIFwiP1wiLCB1bmRlZmluZWRdXG4gIC8vIFwiL3JvdXRlKFxcXFxkKylcIiAgPT4gW3VuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFwiXFxkK1wiLCB1bmRlZmluZWQsIHVuZGVmaW5lZF1cbiAgLy8gXCIvKlwiICAgICAgICAgICAgPT4gW1wiL1wiLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFwiKlwiXVxuICAnKFtcXFxcLy5dKT8oPzooPzpcXFxcOihcXFxcdyspKD86XFxcXCgoKD86XFxcXFxcXFwufFteKCldKSspXFxcXCkpP3xcXFxcKCgoPzpcXFxcXFxcXC58W14oKV0pKylcXFxcKSkoWysqP10pP3woXFxcXCopKSdcbl0uam9pbignfCcpLCAnZycpXG5cbi8qKlxuICogUGFyc2UgYSBzdHJpbmcgZm9yIHRoZSByYXcgdG9rZW5zLlxuICpcbiAqIEBwYXJhbSAge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gcGFyc2UgKHN0cikge1xuICB2YXIgdG9rZW5zID0gW11cbiAgdmFyIGtleSA9IDBcbiAgdmFyIGluZGV4ID0gMFxuICB2YXIgcGF0aCA9ICcnXG4gIHZhciByZXNcblxuICB3aGlsZSAoKHJlcyA9IFBBVEhfUkVHRVhQLmV4ZWMoc3RyKSkgIT0gbnVsbCkge1xuICAgIHZhciBtID0gcmVzWzBdXG4gICAgdmFyIGVzY2FwZWQgPSByZXNbMV1cbiAgICB2YXIgb2Zmc2V0ID0gcmVzLmluZGV4XG4gICAgcGF0aCArPSBzdHIuc2xpY2UoaW5kZXgsIG9mZnNldClcbiAgICBpbmRleCA9IG9mZnNldCArIG0ubGVuZ3RoXG5cbiAgICAvLyBJZ25vcmUgYWxyZWFkeSBlc2NhcGVkIHNlcXVlbmNlcy5cbiAgICBpZiAoZXNjYXBlZCkge1xuICAgICAgcGF0aCArPSBlc2NhcGVkWzFdXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIC8vIFB1c2ggdGhlIGN1cnJlbnQgcGF0aCBvbnRvIHRoZSB0b2tlbnMuXG4gICAgaWYgKHBhdGgpIHtcbiAgICAgIHRva2Vucy5wdXNoKHBhdGgpXG4gICAgICBwYXRoID0gJydcbiAgICB9XG5cbiAgICB2YXIgcHJlZml4ID0gcmVzWzJdXG4gICAgdmFyIG5hbWUgPSByZXNbM11cbiAgICB2YXIgY2FwdHVyZSA9IHJlc1s0XVxuICAgIHZhciBncm91cCA9IHJlc1s1XVxuICAgIHZhciBzdWZmaXggPSByZXNbNl1cbiAgICB2YXIgYXN0ZXJpc2sgPSByZXNbN11cblxuICAgIHZhciByZXBlYXQgPSBzdWZmaXggPT09ICcrJyB8fCBzdWZmaXggPT09ICcqJ1xuICAgIHZhciBvcHRpb25hbCA9IHN1ZmZpeCA9PT0gJz8nIHx8IHN1ZmZpeCA9PT0gJyonXG4gICAgdmFyIGRlbGltaXRlciA9IHByZWZpeCB8fCAnLydcbiAgICB2YXIgcGF0dGVybiA9IGNhcHR1cmUgfHwgZ3JvdXAgfHwgKGFzdGVyaXNrID8gJy4qJyA6ICdbXicgKyBkZWxpbWl0ZXIgKyAnXSs/JylcblxuICAgIHRva2Vucy5wdXNoKHtcbiAgICAgIG5hbWU6IG5hbWUgfHwga2V5KyssXG4gICAgICBwcmVmaXg6IHByZWZpeCB8fCAnJyxcbiAgICAgIGRlbGltaXRlcjogZGVsaW1pdGVyLFxuICAgICAgb3B0aW9uYWw6IG9wdGlvbmFsLFxuICAgICAgcmVwZWF0OiByZXBlYXQsXG4gICAgICBwYXR0ZXJuOiBlc2NhcGVHcm91cChwYXR0ZXJuKVxuICAgIH0pXG4gIH1cblxuICAvLyBNYXRjaCBhbnkgY2hhcmFjdGVycyBzdGlsbCByZW1haW5pbmcuXG4gIGlmIChpbmRleCA8IHN0ci5sZW5ndGgpIHtcbiAgICBwYXRoICs9IHN0ci5zdWJzdHIoaW5kZXgpXG4gIH1cblxuICAvLyBJZiB0aGUgcGF0aCBleGlzdHMsIHB1c2ggaXQgb250byB0aGUgZW5kLlxuICBpZiAocGF0aCkge1xuICAgIHRva2Vucy5wdXNoKHBhdGgpXG4gIH1cblxuICByZXR1cm4gdG9rZW5zXG59XG5cbi8qKlxuICogQ29tcGlsZSBhIHN0cmluZyB0byBhIHRlbXBsYXRlIGZ1bmN0aW9uIGZvciB0aGUgcGF0aC5cbiAqXG4gKiBAcGFyYW0gIHtTdHJpbmd9ICAgc3RyXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuZnVuY3Rpb24gY29tcGlsZSAoc3RyKSB7XG4gIHJldHVybiB0b2tlbnNUb0Z1bmN0aW9uKHBhcnNlKHN0cikpXG59XG5cbi8qKlxuICogRXhwb3NlIGEgbWV0aG9kIGZvciB0cmFuc2Zvcm1pbmcgdG9rZW5zIGludG8gdGhlIHBhdGggZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIHRva2Vuc1RvRnVuY3Rpb24gKHRva2Vucykge1xuICAvLyBDb21waWxlIGFsbCB0aGUgdG9rZW5zIGludG8gcmVnZXhwcy5cbiAgdmFyIG1hdGNoZXMgPSBuZXcgQXJyYXkodG9rZW5zLmxlbmd0aClcblxuICAvLyBDb21waWxlIGFsbCB0aGUgcGF0dGVybnMgYmVmb3JlIGNvbXBpbGF0aW9uLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0eXBlb2YgdG9rZW5zW2ldID09PSAnb2JqZWN0Jykge1xuICAgICAgbWF0Y2hlc1tpXSA9IG5ldyBSZWdFeHAoJ14nICsgdG9rZW5zW2ldLnBhdHRlcm4gKyAnJCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgcGF0aCA9ICcnXG4gICAgdmFyIGRhdGEgPSBvYmogfHwge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdG9rZW4gPSB0b2tlbnNbaV1cblxuICAgICAgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcGF0aCArPSB0b2tlblxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIHZhciB2YWx1ZSA9IGRhdGFbdG9rZW4ubmFtZV1cbiAgICAgIHZhciBzZWdtZW50XG5cbiAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICAgIGlmICh0b2tlbi5vcHRpb25hbCkge1xuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgXCInICsgdG9rZW4ubmFtZSArICdcIiB0byBiZSBkZWZpbmVkJylcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoaXNhcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgaWYgKCF0b2tlbi5yZXBlYXQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBcIicgKyB0b2tlbi5uYW1lICsgJ1wiIHRvIG5vdCByZXBlYXQsIGJ1dCByZWNlaXZlZCBcIicgKyB2YWx1ZSArICdcIicpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgaWYgKHRva2VuLm9wdGlvbmFsKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBcIicgKyB0b2tlbi5uYW1lICsgJ1wiIHRvIG5vdCBiZSBlbXB0eScpXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCB2YWx1ZS5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHNlZ21lbnQgPSBlbmNvZGVVUklDb21wb25lbnQodmFsdWVbal0pXG5cbiAgICAgICAgICBpZiAoIW1hdGNoZXNbaV0udGVzdChzZWdtZW50KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgYWxsIFwiJyArIHRva2VuLm5hbWUgKyAnXCIgdG8gbWF0Y2ggXCInICsgdG9rZW4ucGF0dGVybiArICdcIiwgYnV0IHJlY2VpdmVkIFwiJyArIHNlZ21lbnQgKyAnXCInKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHBhdGggKz0gKGogPT09IDAgPyB0b2tlbi5wcmVmaXggOiB0b2tlbi5kZWxpbWl0ZXIpICsgc2VnbWVudFxuICAgICAgICB9XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgc2VnbWVudCA9IGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSlcblxuICAgICAgaWYgKCFtYXRjaGVzW2ldLnRlc3Qoc2VnbWVudCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgXCInICsgdG9rZW4ubmFtZSArICdcIiB0byBtYXRjaCBcIicgKyB0b2tlbi5wYXR0ZXJuICsgJ1wiLCBidXQgcmVjZWl2ZWQgXCInICsgc2VnbWVudCArICdcIicpXG4gICAgICB9XG5cbiAgICAgIHBhdGggKz0gdG9rZW4ucHJlZml4ICsgc2VnbWVudFxuICAgIH1cblxuICAgIHJldHVybiBwYXRoXG4gIH1cbn1cblxuLyoqXG4gKiBFc2NhcGUgYSByZWd1bGFyIGV4cHJlc3Npb24gc3RyaW5nLlxuICpcbiAqIEBwYXJhbSAge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGVzY2FwZVN0cmluZyAoc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvKFsuKyo/PV4hOiR7fSgpW1xcXXxcXC9dKS9nLCAnXFxcXCQxJylcbn1cblxuLyoqXG4gKiBFc2NhcGUgdGhlIGNhcHR1cmluZyBncm91cCBieSBlc2NhcGluZyBzcGVjaWFsIGNoYXJhY3RlcnMgYW5kIG1lYW5pbmcuXG4gKlxuICogQHBhcmFtICB7U3RyaW5nfSBncm91cFxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5mdW5jdGlvbiBlc2NhcGVHcm91cCAoZ3JvdXApIHtcbiAgcmV0dXJuIGdyb3VwLnJlcGxhY2UoLyhbPSE6JFxcLygpXSkvZywgJ1xcXFwkMScpXG59XG5cbi8qKlxuICogQXR0YWNoIHRoZSBrZXlzIGFzIGEgcHJvcGVydHkgb2YgdGhlIHJlZ2V4cC5cbiAqXG4gKiBAcGFyYW0gIHtSZWdFeHB9IHJlXG4gKiBAcGFyYW0gIHtBcnJheX0gIGtleXNcbiAqIEByZXR1cm4ge1JlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gYXR0YWNoS2V5cyAocmUsIGtleXMpIHtcbiAgcmUua2V5cyA9IGtleXNcbiAgcmV0dXJuIHJlXG59XG5cbi8qKlxuICogR2V0IHRoZSBmbGFncyBmb3IgYSByZWdleHAgZnJvbSB0aGUgb3B0aW9ucy5cbiAqXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuZnVuY3Rpb24gZmxhZ3MgKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG9wdGlvbnMuc2Vuc2l0aXZlID8gJycgOiAnaSdcbn1cblxuLyoqXG4gKiBQdWxsIG91dCBrZXlzIGZyb20gYSByZWdleHAuXG4gKlxuICogQHBhcmFtICB7UmVnRXhwfSBwYXRoXG4gKiBAcGFyYW0gIHtBcnJheX0gIGtleXNcbiAqIEByZXR1cm4ge1JlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gcmVnZXhwVG9SZWdleHAgKHBhdGgsIGtleXMpIHtcbiAgLy8gVXNlIGEgbmVnYXRpdmUgbG9va2FoZWFkIHRvIG1hdGNoIG9ubHkgY2FwdHVyaW5nIGdyb3Vwcy5cbiAgdmFyIGdyb3VwcyA9IHBhdGguc291cmNlLm1hdGNoKC9cXCgoPyFcXD8pL2cpXG5cbiAgaWYgKGdyb3Vwcykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZ3JvdXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXlzLnB1c2goe1xuICAgICAgICBuYW1lOiBpLFxuICAgICAgICBwcmVmaXg6IG51bGwsXG4gICAgICAgIGRlbGltaXRlcjogbnVsbCxcbiAgICAgICAgb3B0aW9uYWw6IGZhbHNlLFxuICAgICAgICByZXBlYXQ6IGZhbHNlLFxuICAgICAgICBwYXR0ZXJuOiBudWxsXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhdHRhY2hLZXlzKHBhdGgsIGtleXMpXG59XG5cbi8qKlxuICogVHJhbnNmb3JtIGFuIGFycmF5IGludG8gYSByZWdleHAuXG4gKlxuICogQHBhcmFtICB7QXJyYXl9ICBwYXRoXG4gKiBAcGFyYW0gIHtBcnJheX0gIGtleXNcbiAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7UmVnRXhwfVxuICovXG5mdW5jdGlvbiBhcnJheVRvUmVnZXhwIChwYXRoLCBrZXlzLCBvcHRpb25zKSB7XG4gIHZhciBwYXJ0cyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgcGFydHMucHVzaChwYXRoVG9SZWdleHAocGF0aFtpXSwga2V5cywgb3B0aW9ucykuc291cmNlKVxuICB9XG5cbiAgdmFyIHJlZ2V4cCA9IG5ldyBSZWdFeHAoJyg/OicgKyBwYXJ0cy5qb2luKCd8JykgKyAnKScsIGZsYWdzKG9wdGlvbnMpKVxuXG4gIHJldHVybiBhdHRhY2hLZXlzKHJlZ2V4cCwga2V5cylcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBwYXRoIHJlZ2V4cCBmcm9tIHN0cmluZyBpbnB1dC5cbiAqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSAge0FycmF5fSAga2V5c1xuICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtSZWdFeHB9XG4gKi9cbmZ1bmN0aW9uIHN0cmluZ1RvUmVnZXhwIChwYXRoLCBrZXlzLCBvcHRpb25zKSB7XG4gIHZhciB0b2tlbnMgPSBwYXJzZShwYXRoKVxuICB2YXIgcmUgPSB0b2tlbnNUb1JlZ0V4cCh0b2tlbnMsIG9wdGlvbnMpXG5cbiAgLy8gQXR0YWNoIGtleXMgYmFjayB0byB0aGUgcmVnZXhwLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0eXBlb2YgdG9rZW5zW2ldICE9PSAnc3RyaW5nJykge1xuICAgICAga2V5cy5wdXNoKHRva2Vuc1tpXSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXR0YWNoS2V5cyhyZSwga2V5cylcbn1cblxuLyoqXG4gKiBFeHBvc2UgYSBmdW5jdGlvbiBmb3IgdGFraW5nIHRva2VucyBhbmQgcmV0dXJuaW5nIGEgUmVnRXhwLlxuICpcbiAqIEBwYXJhbSAge0FycmF5fSAgdG9rZW5zXG4gKiBAcGFyYW0gIHtBcnJheX0gIGtleXNcbiAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7UmVnRXhwfVxuICovXG5mdW5jdGlvbiB0b2tlbnNUb1JlZ0V4cCAodG9rZW5zLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cbiAgdmFyIHN0cmljdCA9IG9wdGlvbnMuc3RyaWN0XG4gIHZhciBlbmQgPSBvcHRpb25zLmVuZCAhPT0gZmFsc2VcbiAgdmFyIHJvdXRlID0gJydcbiAgdmFyIGxhc3RUb2tlbiA9IHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV1cbiAgdmFyIGVuZHNXaXRoU2xhc2ggPSB0eXBlb2YgbGFzdFRva2VuID09PSAnc3RyaW5nJyAmJiAvXFwvJC8udGVzdChsYXN0VG9rZW4pXG5cbiAgLy8gSXRlcmF0ZSBvdmVyIHRoZSB0b2tlbnMgYW5kIGNyZWF0ZSBvdXIgcmVnZXhwIHN0cmluZy5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgdG9rZW4gPSB0b2tlbnNbaV1cblxuICAgIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICByb3V0ZSArPSBlc2NhcGVTdHJpbmcodG9rZW4pXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBwcmVmaXggPSBlc2NhcGVTdHJpbmcodG9rZW4ucHJlZml4KVxuICAgICAgdmFyIGNhcHR1cmUgPSB0b2tlbi5wYXR0ZXJuXG5cbiAgICAgIGlmICh0b2tlbi5yZXBlYXQpIHtcbiAgICAgICAgY2FwdHVyZSArPSAnKD86JyArIHByZWZpeCArIGNhcHR1cmUgKyAnKSonXG4gICAgICB9XG5cbiAgICAgIGlmICh0b2tlbi5vcHRpb25hbCkge1xuICAgICAgICBpZiAocHJlZml4KSB7XG4gICAgICAgICAgY2FwdHVyZSA9ICcoPzonICsgcHJlZml4ICsgJygnICsgY2FwdHVyZSArICcpKT8nXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FwdHVyZSA9ICcoJyArIGNhcHR1cmUgKyAnKT8nXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhcHR1cmUgPSBwcmVmaXggKyAnKCcgKyBjYXB0dXJlICsgJyknXG4gICAgICB9XG5cbiAgICAgIHJvdXRlICs9IGNhcHR1cmVcbiAgICB9XG4gIH1cblxuICAvLyBJbiBub24tc3RyaWN0IG1vZGUgd2UgYWxsb3cgYSBzbGFzaCBhdCB0aGUgZW5kIG9mIG1hdGNoLiBJZiB0aGUgcGF0aCB0b1xuICAvLyBtYXRjaCBhbHJlYWR5IGVuZHMgd2l0aCBhIHNsYXNoLCB3ZSByZW1vdmUgaXQgZm9yIGNvbnNpc3RlbmN5LiBUaGUgc2xhc2hcbiAgLy8gaXMgdmFsaWQgYXQgdGhlIGVuZCBvZiBhIHBhdGggbWF0Y2gsIG5vdCBpbiB0aGUgbWlkZGxlLiBUaGlzIGlzIGltcG9ydGFudFxuICAvLyBpbiBub24tZW5kaW5nIG1vZGUsIHdoZXJlIFwiL3Rlc3QvXCIgc2hvdWxkbid0IG1hdGNoIFwiL3Rlc3QvL3JvdXRlXCIuXG4gIGlmICghc3RyaWN0KSB7XG4gICAgcm91dGUgPSAoZW5kc1dpdGhTbGFzaCA/IHJvdXRlLnNsaWNlKDAsIC0yKSA6IHJvdXRlKSArICcoPzpcXFxcLyg/PSQpKT8nXG4gIH1cblxuICBpZiAoZW5kKSB7XG4gICAgcm91dGUgKz0gJyQnXG4gIH0gZWxzZSB7XG4gICAgLy8gSW4gbm9uLWVuZGluZyBtb2RlLCB3ZSBuZWVkIHRoZSBjYXB0dXJpbmcgZ3JvdXBzIHRvIG1hdGNoIGFzIG11Y2ggYXNcbiAgICAvLyBwb3NzaWJsZSBieSB1c2luZyBhIHBvc2l0aXZlIGxvb2thaGVhZCB0byB0aGUgZW5kIG9yIG5leHQgcGF0aCBzZWdtZW50LlxuICAgIHJvdXRlICs9IHN0cmljdCAmJiBlbmRzV2l0aFNsYXNoID8gJycgOiAnKD89XFxcXC98JCknXG4gIH1cblxuICByZXR1cm4gbmV3IFJlZ0V4cCgnXicgKyByb3V0ZSwgZmxhZ3Mob3B0aW9ucykpXG59XG5cbi8qKlxuICogTm9ybWFsaXplIHRoZSBnaXZlbiBwYXRoIHN0cmluZywgcmV0dXJuaW5nIGEgcmVndWxhciBleHByZXNzaW9uLlxuICpcbiAqIEFuIGVtcHR5IGFycmF5IGNhbiBiZSBwYXNzZWQgaW4gZm9yIHRoZSBrZXlzLCB3aGljaCB3aWxsIGhvbGQgdGhlXG4gKiBwbGFjZWhvbGRlciBrZXkgZGVzY3JpcHRpb25zLiBGb3IgZXhhbXBsZSwgdXNpbmcgYC91c2VyLzppZGAsIGBrZXlzYCB3aWxsXG4gKiBjb250YWluIGBbeyBuYW1lOiAnaWQnLCBkZWxpbWl0ZXI6ICcvJywgb3B0aW9uYWw6IGZhbHNlLCByZXBlYXQ6IGZhbHNlIH1dYC5cbiAqXG4gKiBAcGFyYW0gIHsoU3RyaW5nfFJlZ0V4cHxBcnJheSl9IHBhdGhcbiAqIEBwYXJhbSAge0FycmF5fSAgICAgICAgICAgICAgICAgW2tleXNdXG4gKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgICAgICAgIFtvcHRpb25zXVxuICogQHJldHVybiB7UmVnRXhwfVxuICovXG5mdW5jdGlvbiBwYXRoVG9SZWdleHAgKHBhdGgsIGtleXMsIG9wdGlvbnMpIHtcbiAga2V5cyA9IGtleXMgfHwgW11cblxuICBpZiAoIWlzYXJyYXkoa2V5cykpIHtcbiAgICBvcHRpb25zID0ga2V5c1xuICAgIGtleXMgPSBbXVxuICB9IGVsc2UgaWYgKCFvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IHt9XG4gIH1cblxuICBpZiAocGF0aCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgIHJldHVybiByZWdleHBUb1JlZ2V4cChwYXRoLCBrZXlzLCBvcHRpb25zKVxuICB9XG5cbiAgaWYgKGlzYXJyYXkocGF0aCkpIHtcbiAgICByZXR1cm4gYXJyYXlUb1JlZ2V4cChwYXRoLCBrZXlzLCBvcHRpb25zKVxuICB9XG5cbiAgcmV0dXJuIHN0cmluZ1RvUmVnZXhwKHBhdGgsIGtleXMsIG9wdGlvbnMpXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIvKlxuICogcHViIHBhZ2VyLmpzIGdlbmVyYXRvci1wbHVnaW5cbiAqXG4gKiBjbGllbnQtc2lkZSByb3V0ZXIgKHZpc2lvbm1lZGlhL3BhZ2UpIHBsdWdpbiBmb3IgcHViLWdlbmVyYXRvclxuICogdHJhbnNsYXRlcyBjbGljayBldmVudHMgZm9yIGludHJhLXNpdGUgbGlua3MgdG8gZ2VuZXJhdG9yLm5hdiBldmVudHNcbiAqIGdlbmVyYXRvci5uYXYgZXZlbnRzIGFyZSB0aGVuIGhhbmRsZWQgYnkganF1ZXJ5dmlld1xuICpcbiAqIGluaXRpYWxpemUgYnkgY2FsbGluZyBwYWdlciA9IGdlbmVyYXRvci5pbml0UGFnZXIoKTtcbiAqIHBhZ2VyLnBhZ2Ugd2lsbCBiZSBzZXQgdG8gdGhlIGN1cnJlbnQgcGFnZSBvYmplY3QsIG1haW50YWluZWQgYWZ0ZXIgZWFjaCBuYXZcbiAqXG4gKiBOT1RFOiB1c2VzIGhpc3RvcnkucHVzaFN0YXRlLCB3aGljaCBkb2Vzbid0IHdvcmsgaW4gb2xkZXIgYnJvd2Vyc1xuICogY29weXJpZ2h0IDIwMTUsIEp1cmdlbiBMZXNjaG5lciAtIGdpdGh1Yi5jb20vamxkZWMgLSBNSVQgbGljZW5zZVxuICpcbiovXG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpKCdwdWI6cGFnZXInKTtcbnZhciBxcyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZ2VuZXJhdG9yKSB7XG5cbiAgLy8gbWl4aW5cbiAgZ2VuZXJhdG9yLmluaXRQYWdlciA9IGZ1bmN0aW9uIGluaXRQYWdlcigpIHtcblxuICAgIHZhciB1ID0gZ2VuZXJhdG9yLnV0aWw7XG4gICAgdmFyIG9wdHMgPSBnZW5lcmF0b3Iub3B0cztcbiAgICB2YXIgbG9nID0gb3B0cy5sb2c7XG5cbiAgICAvLyBiaW5kIGpxdWVyeXZpZXdcbiAgICB2YXIganF2ID0gcmVxdWlyZSgnLi9qcXVlcnl2aWV3JykoZ2VuZXJhdG9yKTtcbiAgICBqcXYuc3RhcnQoKTtcblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS92aXNpb25tZWRpYS9wYWdlLmpzXG4gICAgdmFyIHBhZ2VyID0gcmVxdWlyZSgncGFnZScpO1xuXG4gICAgLy8gaW5pdGlhbGl6ZSB3aXRoIGN1cnJlbnQgcGFnZVxuICAgIHZhciBocmVmID0gdS5nZXQocHViUmVmLCAnaHJlZicsIGxvY2F0aW9uLnBhdGhuYW1lKVxuICAgIHBhZ2VyLnBhZ2UgPSBnZW5lcmF0b3IucGFnZSRbaHJlZl07XG4gICAgZGVidWcoJ2luaXQgJyArIGRlY29kZVVSSShsb2NhdGlvbikgKyAocGFnZXIucGFnZSA/ICcgKG9rKScgOiAnICh1bmRlZmluZWQgcGFnZSknKSk7XG5cbiAgICBwYWdlcignKicsIGZ1bmN0aW9uKGN0eCwgbmV4dCkge1xuICAgICAgdmFyIHBhdGggPSBjdHgucGF0aDtcblxuICAgICAgLy8gc3RyaXAgb3JpZ2luIGZyb20gZnEgdXJsc1xuICAgICAgcGF0aCA9IHUudW5QcmVmaXgocGF0aCwgb3B0cy5hcHBVcmwpO1xuXG4gICAgICAvLyBzdHJpcCBzdGF0aWMgcm9vdCAoc2VlIC9zZXJ2ZXIvY2xpZW50L2luaXQtb3B0cy5qcylcbiAgICAgIHBhdGggPSB1LnVuUHJlZml4KHBhdGgsIG9wdHMuc3RhdGljUm9vdCk7XG5cbiAgICAgIHZhciBwYWdlID0gZ2VuZXJhdG9yLmZpbmRQYWdlKHBhdGgpO1xuXG4gICAgICBpZiAoIXBhZ2UpIHtcbiAgICAgICAgbG9nKCdwYWdlciBtaXNzJywgcGF0aCk7XG4gICAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgICB9XG5cbiAgICAgIHBhZ2VyLnBhZ2UgPSBwYWdlO1xuXG4gICAgICAvLyBzaW11bGF0ZSBzZXJ2ZXItc2lkZSByZXF1ZXN0XG4gICAgICBnZW5lcmF0b3IucmVxID0geyBxdWVyeTogdS5wYXJzZVVybFBhcmFtcygnPycgKyBjdHgucXVlcnlzdHJpbmcpIH07XG5cbiAgICAgIC8vIHVwZGF0ZSB2aWV3IGluIERPTVxuICAgICAgZGVidWcoJ25hdiAnICsgZGVjb2RlVVJJKHBhdGgpKTtcbiAgICAgIGdlbmVyYXRvci5lbWl0KCduYXYnLCBwYWdlKTtcbiAgICB9KTtcblxuICAgIC8vIHN0YXJ0IHBhZ2VyXG4gICAgcGFnZXIoIHsgZGVjb2RlVVJMQ29tcG9uZW50czpmYWxzZSwgZGlzcGF0Y2g6ZmFsc2UgfSApOyAvLyBhdXRvLWRpc3BhdGNoIGxvc2VzIGhhc2guXG5cbiAgICByZXR1cm4gcGFnZXI7XG4gIH07XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGdlbmVyYXRvcikge1xuXG52YXIgdSA9IGdlbmVyYXRvci51dGlsO1xudmFyIGhiID0gZ2VuZXJhdG9yLmhhbmRsZWJhcnM7XG5cbi8vIG1hcCBpY29uIG5hbWUgLT4gZ2x5cGggaHRtbCBoZXhcbi8vIGtleXMgY2Fubm90IGNvbnRhaW4gcmVnZXhwIHNwZWNpYWwgY2hhcnNcbnZhciBnbHlwaE1hcCA9IHtcbic1MDBweCc6JzI2ZScsXG4nYWRqdXN0JzonMDQyJyxcbidhZG4nOicxNzAnLFxuJ2FsaWduLWNlbnRlcic6JzAzNycsXG4nYWxpZ24tanVzdGlmeSc6JzAzOScsXG4nYWxpZ24tbGVmdCc6JzAzNicsXG4nYWxpZ24tcmlnaHQnOicwMzgnLFxuJ2FtYXpvbic6JzI3MCcsXG4nYW1idWxhbmNlJzonMGY5JyxcbidhbmNob3InOicxM2QnLFxuJ2FuZHJvaWQnOicxN2InLFxuJ2FuZ2VsbGlzdCc6JzIwOScsXG4nYW5nbGUtZG91YmxlLWRvd24nOicxMDMnLFxuJ2FuZ2xlLWRvdWJsZS1sZWZ0JzonMTAwJyxcbidhbmdsZS1kb3VibGUtcmlnaHQnOicxMDEnLFxuJ2FuZ2xlLWRvdWJsZS11cCc6JzEwMicsXG4nYW5nbGUtZG93bic6JzEwNycsXG4nYW5nbGUtbGVmdCc6JzEwNCcsXG4nYW5nbGUtcmlnaHQnOicxMDUnLFxuJ2FuZ2xlLXVwJzonMTA2JyxcbidhcHBsZSc6JzE3OScsXG4nYXJjaGl2ZSc6JzE4NycsXG4nYXJlYS1jaGFydCc6JzFmZScsXG4nYXJyb3ctY2lyY2xlLWRvd24nOicwYWInLFxuJ2Fycm93LWNpcmNsZS1sZWZ0JzonMGE4JyxcbidhcnJvdy1jaXJjbGUtby1kb3duJzonMDFhJyxcbidhcnJvdy1jaXJjbGUtby1sZWZ0JzonMTkwJyxcbidhcnJvdy1jaXJjbGUtby1yaWdodCc6JzE4ZScsXG4nYXJyb3ctY2lyY2xlLW8tdXAnOicwMWInLFxuJ2Fycm93LWNpcmNsZS1yaWdodCc6JzBhOScsXG4nYXJyb3ctY2lyY2xlLXVwJzonMGFhJyxcbidhcnJvdy1kb3duJzonMDYzJyxcbidhcnJvdy1sZWZ0JzonMDYwJyxcbidhcnJvdy1yaWdodCc6JzA2MScsXG4nYXJyb3ctdXAnOicwNjInLFxuJ2Fycm93cyc6JzA0NycsXG4nYXJyb3dzLWFsdCc6JzBiMicsXG4nYXJyb3dzLWgnOicwN2UnLFxuJ2Fycm93cy12JzonMDdkJyxcbidhc3Rlcmlzayc6JzA2OScsXG4nYXQnOicxZmEnLFxuJ2F1dG9tb2JpbGUnOicxYjknLFxuJ2JhY2t3YXJkJzonMDRhJyxcbidiYWxhbmNlLXNjYWxlJzonMjRlJyxcbidiYW4nOicwNWUnLFxuJ2JhbmsnOicxOWMnLFxuJ2Jhci1jaGFydCc6JzA4MCcsXG4nYmFyLWNoYXJ0LW8nOicwODAnLFxuJ2JhcmNvZGUnOicwMmEnLFxuJ2JhcnMnOicwYzknLFxuJ2JhdHRlcnktMCc6JzI0NCcsXG4nYmF0dGVyeS0xJzonMjQzJyxcbidiYXR0ZXJ5LTInOicyNDInLFxuJ2JhdHRlcnktMyc6JzI0MScsXG4nYmF0dGVyeS00JzonMjQwJyxcbidiYXR0ZXJ5LWVtcHR5JzonMjQ0JyxcbidiYXR0ZXJ5LWZ1bGwnOicyNDAnLFxuJ2JhdHRlcnktaGFsZic6JzI0MicsXG4nYmF0dGVyeS1xdWFydGVyJzonMjQzJyxcbidiYXR0ZXJ5LXRocmVlLXF1YXJ0ZXJzJzonMjQxJyxcbidiZWQnOicyMzYnLFxuJ2JlZXInOicwZmMnLFxuJ2JlaGFuY2UnOicxYjQnLFxuJ2JlaGFuY2Utc3F1YXJlJzonMWI1JyxcbidiZWxsJzonMGYzJyxcbidiZWxsLW8nOicwYTInLFxuJ2JlbGwtc2xhc2gnOicxZjYnLFxuJ2JlbGwtc2xhc2gtbyc6JzFmNycsXG4nYmljeWNsZSc6JzIwNicsXG4nYmlub2N1bGFycyc6JzFlNScsXG4nYmlydGhkYXktY2FrZSc6JzFmZCcsXG4nYml0YnVja2V0JzonMTcxJyxcbidiaXRidWNrZXQtc3F1YXJlJzonMTcyJyxcbidiaXRjb2luJzonMTVhJyxcbidibGFjay10aWUnOicyN2UnLFxuJ2JvbGQnOicwMzInLFxuJ2JvbHQnOicwZTcnLFxuJ2JvbWInOicxZTInLFxuJ2Jvb2snOicwMmQnLFxuJ2Jvb2ttYXJrJzonMDJlJyxcbidib29rbWFyay1vJzonMDk3JyxcbidicmllZmNhc2UnOicwYjEnLFxuJ2J0Yyc6JzE1YScsXG4nYnVnJzonMTg4JyxcbididWlsZGluZyc6JzFhZCcsXG4nYnVpbGRpbmctbyc6JzBmNycsXG4nYnVsbGhvcm4nOicwYTEnLFxuJ2J1bGxzZXllJzonMTQwJyxcbididXMnOicyMDcnLFxuJ2J1eXNlbGxhZHMnOicyMGQnLFxuJ2NhYic6JzFiYScsXG4nY2FsY3VsYXRvcic6JzFlYycsXG4nY2FsZW5kYXInOicwNzMnLFxuJ2NhbGVuZGFyLWNoZWNrLW8nOicyNzQnLFxuJ2NhbGVuZGFyLW1pbnVzLW8nOicyNzInLFxuJ2NhbGVuZGFyLW8nOicxMzMnLFxuJ2NhbGVuZGFyLXBsdXMtbyc6JzI3MScsXG4nY2FsZW5kYXItdGltZXMtbyc6JzI3MycsXG4nY2FtZXJhJzonMDMwJyxcbidjYW1lcmEtcmV0cm8nOicwODMnLFxuJ2Nhcic6JzFiOScsXG4nY2FyZXQtZG93bic6JzBkNycsXG4nY2FyZXQtbGVmdCc6JzBkOScsXG4nY2FyZXQtcmlnaHQnOicwZGEnLFxuJ2NhcmV0LXNxdWFyZS1vLWRvd24nOicxNTAnLFxuJ2NhcmV0LXNxdWFyZS1vLWxlZnQnOicxOTEnLFxuJ2NhcmV0LXNxdWFyZS1vLXJpZ2h0JzonMTUyJyxcbidjYXJldC1zcXVhcmUtby11cCc6JzE1MScsXG4nY2FyZXQtdXAnOicwZDgnLFxuJ2NhcnQtYXJyb3ctZG93bic6JzIxOCcsXG4nY2FydC1wbHVzJzonMjE3JyxcbidjYyc6JzIwYScsXG4nY2MtYW1leCc6JzFmMycsXG4nY2MtZGluZXJzLWNsdWInOicyNGMnLFxuJ2NjLWRpc2NvdmVyJzonMWYyJyxcbidjYy1qY2InOicyNGInLFxuJ2NjLW1hc3RlcmNhcmQnOicxZjEnLFxuJ2NjLXBheXBhbCc6JzFmNCcsXG4nY2Mtc3RyaXBlJzonMWY1JyxcbidjYy12aXNhJzonMWYwJyxcbidjZXJ0aWZpY2F0ZSc6JzBhMycsXG4nY2hhaW4nOicwYzEnLFxuJ2NoYWluLWJyb2tlbic6JzEyNycsXG4nY2hlY2snOicwMGMnLFxuJ2NoZWNrLWNpcmNsZSc6JzA1OCcsXG4nY2hlY2stY2lyY2xlLW8nOicwNWQnLFxuJ2NoZWNrLXNxdWFyZSc6JzE0YScsXG4nY2hlY2stc3F1YXJlLW8nOicwNDYnLFxuJ2NoZXZyb24tY2lyY2xlLWRvd24nOicxM2EnLFxuJ2NoZXZyb24tY2lyY2xlLWxlZnQnOicxMzcnLFxuJ2NoZXZyb24tY2lyY2xlLXJpZ2h0JzonMTM4JyxcbidjaGV2cm9uLWNpcmNsZS11cCc6JzEzOScsXG4nY2hldnJvbi1kb3duJzonMDc4JyxcbidjaGV2cm9uLWxlZnQnOicwNTMnLFxuJ2NoZXZyb24tcmlnaHQnOicwNTQnLFxuJ2NoZXZyb24tdXAnOicwNzcnLFxuJ2NoaWxkJzonMWFlJyxcbidjaHJvbWUnOicyNjgnLFxuJ2NpcmNsZSc6JzExMScsXG4nY2lyY2xlLW8nOicxMGMnLFxuJ2NpcmNsZS1vLW5vdGNoJzonMWNlJyxcbidjaXJjbGUtdGhpbic6JzFkYicsXG4nY2xpcGJvYXJkJzonMGVhJyxcbidjbG9jay1vJzonMDE3JyxcbidjbG9uZSc6JzI0ZCcsXG4nY2xvc2UnOicwMGQnLFxuJ2Nsb3VkJzonMGMyJyxcbidjbG91ZC1kb3dubG9hZCc6JzBlZCcsXG4nY2xvdWQtdXBsb2FkJzonMGVlJyxcbidjbnknOicxNTcnLFxuJ2NvZGUnOicxMjEnLFxuJ2NvZGUtZm9yayc6JzEyNicsXG4nY29kZXBlbic6JzFjYicsXG4nY29mZmVlJzonMGY0Jyxcbidjb2cnOicwMTMnLFxuJ2NvZ3MnOicwODUnLFxuJ2NvbHVtbnMnOicwZGInLFxuJ2NvbW1lbnQnOicwNzUnLFxuJ2NvbW1lbnQtbyc6JzBlNScsXG4nY29tbWVudGluZyc6JzI3YScsXG4nY29tbWVudGluZy1vJzonMjdiJyxcbidjb21tZW50cyc6JzA4NicsXG4nY29tbWVudHMtbyc6JzBlNicsXG4nY29tcGFzcyc6JzE0ZScsXG4nY29tcHJlc3MnOicwNjYnLFxuJ2Nvbm5lY3RkZXZlbG9wJzonMjBlJyxcbidjb250YW8nOicyNmQnLFxuJ2NvcHknOicwYzUnLFxuJ2NvcHlyaWdodCc6JzFmOScsXG4nY3JlYXRpdmUtY29tbW9ucyc6JzI1ZScsXG4nY3JlZGl0LWNhcmQnOicwOWQnLFxuJ2Nyb3AnOicxMjUnLFxuJ2Nyb3NzaGFpcnMnOicwNWInLFxuJ2NzczMnOicxM2MnLFxuJ2N1YmUnOicxYjInLFxuJ2N1YmVzJzonMWIzJyxcbidjdXQnOicwYzQnLFxuJ2N1dGxlcnknOicwZjUnLFxuJ2Rhc2hib2FyZCc6JzBlNCcsXG4nZGFzaGN1YmUnOicyMTAnLFxuJ2RhdGFiYXNlJzonMWMwJyxcbidkZWRlbnQnOicwM2InLFxuJ2RlbGljaW91cyc6JzFhNScsXG4nZGVza3RvcCc6JzEwOCcsXG4nZGV2aWFudGFydCc6JzFiZCcsXG4nZGlhbW9uZCc6JzIxOScsXG4nZGlnZyc6JzFhNicsXG4nZG9sbGFyJzonMTU1Jyxcbidkb3QtY2lyY2xlLW8nOicxOTInLFxuJ2Rvd25sb2FkJzonMDE5JyxcbidkcmliYmJsZSc6JzE3ZCcsXG4nZHJvcGJveCc6JzE2YicsXG4nZHJ1cGFsJzonMWE5JyxcbidlZGl0JzonMDQ0JyxcbidlamVjdCc6JzA1MicsXG4nZWxsaXBzaXMtaCc6JzE0MScsXG4nZWxsaXBzaXMtdic6JzE0MicsXG4nZW1waXJlJzonMWQxJyxcbidlbnZlbG9wZSc6JzBlMCcsXG4nZW52ZWxvcGUtbyc6JzAwMycsXG4nZW52ZWxvcGUtc3F1YXJlJzonMTk5JyxcbidlcmFzZXInOicxMmQnLFxuJ2V1cic6JzE1MycsXG4nZXVybyc6JzE1MycsXG4nZXhjaGFuZ2UnOicwZWMnLFxuJ2V4Y2xhbWF0aW9uJzonMTJhJyxcbidleGNsYW1hdGlvbi1jaXJjbGUnOicwNmEnLFxuJ2V4Y2xhbWF0aW9uLXRyaWFuZ2xlJzonMDcxJyxcbidleHBhbmQnOicwNjUnLFxuJ2V4cGVkaXRlZHNzbCc6JzIzZScsXG4nZXh0ZXJuYWwtbGluayc6JzA4ZScsXG4nZXh0ZXJuYWwtbGluay1zcXVhcmUnOicxNGMnLFxuJ2V5ZSc6JzA2ZScsXG4nZXllLXNsYXNoJzonMDcwJyxcbidleWVkcm9wcGVyJzonMWZiJyxcbidmYWNlYm9vayc6JzA5YScsXG4nZmFjZWJvb2stZic6JzA5YScsXG4nZmFjZWJvb2stb2ZmaWNpYWwnOicyMzAnLFxuJ2ZhY2Vib29rLXNxdWFyZSc6JzA4MicsXG4nZmFzdC1iYWNrd2FyZCc6JzA0OScsXG4nZmFzdC1mb3J3YXJkJzonMDUwJyxcbidmYXgnOicxYWMnLFxuJ2ZlZWQnOicwOWUnLFxuJ2ZlbWFsZSc6JzE4MicsXG4nZmlnaHRlci1qZXQnOicwZmInLFxuJ2ZpbGUnOicxNWInLFxuJ2ZpbGUtYXJjaGl2ZS1vJzonMWM2JyxcbidmaWxlLWF1ZGlvLW8nOicxYzcnLFxuJ2ZpbGUtY29kZS1vJzonMWM5JyxcbidmaWxlLWV4Y2VsLW8nOicxYzMnLFxuJ2ZpbGUtaW1hZ2Utbyc6JzFjNScsXG4nZmlsZS1tb3ZpZS1vJzonMWM4JyxcbidmaWxlLW8nOicwMTYnLFxuJ2ZpbGUtcGRmLW8nOicxYzEnLFxuJ2ZpbGUtcGhvdG8tbyc6JzFjNScsXG4nZmlsZS1waWN0dXJlLW8nOicxYzUnLFxuJ2ZpbGUtcG93ZXJwb2ludC1vJzonMWM0JyxcbidmaWxlLXNvdW5kLW8nOicxYzcnLFxuJ2ZpbGUtdGV4dCc6JzE1YycsXG4nZmlsZS10ZXh0LW8nOicwZjYnLFxuJ2ZpbGUtdmlkZW8tbyc6JzFjOCcsXG4nZmlsZS13b3JkLW8nOicxYzInLFxuJ2ZpbGUtemlwLW8nOicxYzYnLFxuJ2ZpbGVzLW8nOicwYzUnLFxuJ2ZpbG0nOicwMDgnLFxuJ2ZpbHRlcic6JzBiMCcsXG4nZmlyZSc6JzA2ZCcsXG4nZmlyZS1leHRpbmd1aXNoZXInOicxMzQnLFxuJ2ZpcmVmb3gnOicyNjknLFxuJ2ZsYWcnOicwMjQnLFxuJ2ZsYWctY2hlY2tlcmVkJzonMTFlJyxcbidmbGFnLW8nOicxMWQnLFxuJ2ZsYXNoJzonMGU3JyxcbidmbGFzayc6JzBjMycsXG4nZmxpY2tyJzonMTZlJyxcbidmbG9wcHktbyc6JzBjNycsXG4nZm9sZGVyJzonMDdiJyxcbidmb2xkZXItbyc6JzExNCcsXG4nZm9sZGVyLW9wZW4nOicwN2MnLFxuJ2ZvbGRlci1vcGVuLW8nOicxMTUnLFxuJ2ZvbnQnOicwMzEnLFxuJ2ZvbnRpY29ucyc6JzI4MCcsXG4nZm9ydW1iZWUnOicyMTEnLFxuJ2ZvcndhcmQnOicwNGUnLFxuJ2ZvdXJzcXVhcmUnOicxODAnLFxuJ2Zyb3duLW8nOicxMTknLFxuJ2Z1dGJvbC1vJzonMWUzJyxcbidnYW1lcGFkJzonMTFiJyxcbidnYXZlbCc6JzBlMycsXG4nZ2JwJzonMTU0JyxcbidnZSc6JzFkMScsXG4nZ2Vhcic6JzAxMycsXG4nZ2VhcnMnOicwODUnLFxuJ2dlbmRlcmxlc3MnOicyMmQnLFxuJ2dldC1wb2NrZXQnOicyNjUnLFxuJ2dnJzonMjYwJyxcbidnZy1jaXJjbGUnOicyNjEnLFxuJ2dpZnQnOicwNmInLFxuJ2dpdCc6JzFkMycsXG4nZ2l0LXNxdWFyZSc6JzFkMicsXG4nZ2l0aHViJzonMDliJyxcbidnaXRodWItYWx0JzonMTEzJyxcbidnaXRodWItc3F1YXJlJzonMDkyJyxcbidnaXR0aXAnOicxODQnLFxuJ2dsYXNzJzonMDAwJyxcbidnbG9iZSc6JzBhYycsXG4nZ29vZ2xlJzonMWEwJyxcbidnb29nbGUtcGx1cyc6JzBkNScsXG4nZ29vZ2xlLXBsdXMtc3F1YXJlJzonMGQ0Jyxcbidnb29nbGUtd2FsbGV0JzonMWVlJyxcbidncmFkdWF0aW9uLWNhcCc6JzE5ZCcsXG4nZ3JhdGlwYXknOicxODQnLFxuJ2dyb3VwJzonMGMwJyxcbidoLXNxdWFyZSc6JzBmZCcsXG4naGFja2VyLW5ld3MnOicxZDQnLFxuJ2hhbmQtZ3JhYi1vJzonMjU1JyxcbidoYW5kLWxpemFyZC1vJzonMjU4JyxcbidoYW5kLW8tZG93bic6JzBhNycsXG4naGFuZC1vLWxlZnQnOicwYTUnLFxuJ2hhbmQtby1yaWdodCc6JzBhNCcsXG4naGFuZC1vLXVwJzonMGE2JyxcbidoYW5kLXBhcGVyLW8nOicyNTYnLFxuJ2hhbmQtcGVhY2Utbyc6JzI1YicsXG4naGFuZC1wb2ludGVyLW8nOicyNWEnLFxuJ2hhbmQtcm9jay1vJzonMjU1JyxcbidoYW5kLXNjaXNzb3JzLW8nOicyNTcnLFxuJ2hhbmQtc3BvY2stbyc6JzI1OScsXG4naGFuZC1zdG9wLW8nOicyNTYnLFxuJ2hkZC1vJzonMGEwJyxcbidoZWFkZXInOicxZGMnLFxuJ2hlYWRwaG9uZXMnOicwMjUnLFxuJ2hlYXJ0JzonMDA0JyxcbidoZWFydC1vJzonMDhhJyxcbidoZWFydGJlYXQnOicyMWUnLFxuJ2hpc3RvcnknOicxZGEnLFxuJ2hvbWUnOicwMTUnLFxuJ2hvc3BpdGFsLW8nOicwZjgnLFxuJ2hvdGVsJzonMjM2Jyxcbidob3VyZ2xhc3MnOicyNTQnLFxuJ2hvdXJnbGFzcy0xJzonMjUxJyxcbidob3VyZ2xhc3MtMic6JzI1MicsXG4naG91cmdsYXNzLTMnOicyNTMnLFxuJ2hvdXJnbGFzcy1lbmQnOicyNTMnLFxuJ2hvdXJnbGFzcy1oYWxmJzonMjUyJyxcbidob3VyZ2xhc3Mtbyc6JzI1MCcsXG4naG91cmdsYXNzLXN0YXJ0JzonMjUxJyxcbidob3V6eic6JzI3YycsXG4naHRtbDUnOicxM2InLFxuJ2ktY3Vyc29yJzonMjQ2JyxcbidpbHMnOicyMGInLFxuJ2ltYWdlJzonMDNlJyxcbidpbmJveCc6JzAxYycsXG4naW5kZW50JzonMDNjJyxcbidpbmR1c3RyeSc6JzI3NScsXG4naW5mbyc6JzEyOScsXG4naW5mby1jaXJjbGUnOicwNWEnLFxuJ2lucic6JzE1NicsXG4naW5zdGFncmFtJzonMTZkJyxcbidpbnN0aXR1dGlvbic6JzE5YycsXG4naW50ZXJuZXQtZXhwbG9yZXInOicyNmInLFxuJ2ludGVyc2V4JzonMjI0Jyxcbidpb3hob3N0JzonMjA4JyxcbidpdGFsaWMnOicwMzMnLFxuJ2pvb21sYSc6JzFhYScsXG4nanB5JzonMTU3Jyxcbidqc2ZpZGRsZSc6JzFjYycsXG4na2V5JzonMDg0JyxcbidrZXlib2FyZC1vJzonMTFjJyxcbidrcncnOicxNTknLFxuJ2xhbmd1YWdlJzonMWFiJyxcbidsYXB0b3AnOicxMDknLFxuJ2xhc3RmbSc6JzIwMicsXG4nbGFzdGZtLXNxdWFyZSc6JzIwMycsXG4nbGVhZic6JzA2YycsXG4nbGVhbnB1Yic6JzIxMicsXG4nbGVnYWwnOicwZTMnLFxuJ2xlbW9uLW8nOicwOTQnLFxuJ2xldmVsLWRvd24nOicxNDknLFxuJ2xldmVsLXVwJzonMTQ4JyxcbidsaWZlLWJvdXknOicxY2QnLFxuJ2xpZmUtYnVveSc6JzFjZCcsXG4nbGlmZS1yaW5nJzonMWNkJyxcbidsaWZlLXNhdmVyJzonMWNkJyxcbidsaWdodGJ1bGItbyc6JzBlYicsXG4nbGluZS1jaGFydCc6JzIwMScsXG4nbGluayc6JzBjMScsXG4nbGlua2VkaW4nOicwZTEnLFxuJ2xpbmtlZGluLXNxdWFyZSc6JzA4YycsXG4nbGludXgnOicxN2MnLFxuJ2xpc3QnOicwM2EnLFxuJ2xpc3QtYWx0JzonMDIyJyxcbidsaXN0LW9sJzonMGNiJyxcbidsaXN0LXVsJzonMGNhJyxcbidsb2NhdGlvbi1hcnJvdyc6JzEyNCcsXG4nbG9jayc6JzAyMycsXG4nbG9uZy1hcnJvdy1kb3duJzonMTc1Jyxcbidsb25nLWFycm93LWxlZnQnOicxNzcnLFxuJ2xvbmctYXJyb3ctcmlnaHQnOicxNzgnLFxuJ2xvbmctYXJyb3ctdXAnOicxNzYnLFxuJ21hZ2ljJzonMGQwJyxcbidtYWduZXQnOicwNzYnLFxuJ21haWwtZm9yd2FyZCc6JzA2NCcsXG4nbWFpbC1yZXBseSc6JzExMicsXG4nbWFpbC1yZXBseS1hbGwnOicxMjInLFxuJ21hbGUnOicxODMnLFxuJ21hcCc6JzI3OScsXG4nbWFwLW1hcmtlcic6JzA0MScsXG4nbWFwLW8nOicyNzgnLFxuJ21hcC1waW4nOicyNzYnLFxuJ21hcC1zaWducyc6JzI3NycsXG4nbWFycyc6JzIyMicsXG4nbWFycy1kb3VibGUnOicyMjcnLFxuJ21hcnMtc3Ryb2tlJzonMjI5JyxcbidtYXJzLXN0cm9rZS1oJzonMjJiJyxcbidtYXJzLXN0cm9rZS12JzonMjJhJyxcbidtYXhjZG4nOicxMzYnLFxuJ21lYW5wYXRoJzonMjBjJyxcbidtZWRpdW0nOicyM2EnLFxuJ21lZGtpdCc6JzBmYScsXG4nbWVoLW8nOicxMWEnLFxuJ21lcmN1cnknOicyMjMnLFxuJ21pY3JvcGhvbmUnOicxMzAnLFxuJ21pY3JvcGhvbmUtc2xhc2gnOicxMzEnLFxuJ21pbnVzJzonMDY4JyxcbidtaW51cy1jaXJjbGUnOicwNTYnLFxuJ21pbnVzLXNxdWFyZSc6JzE0NicsXG4nbWludXMtc3F1YXJlLW8nOicxNDcnLFxuJ21vYmlsZSc6JzEwYicsXG4nbW9iaWxlLXBob25lJzonMTBiJyxcbidtb25leSc6JzBkNicsXG4nbW9vbi1vJzonMTg2Jyxcbidtb3J0YXItYm9hcmQnOicxOWQnLFxuJ21vdG9yY3ljbGUnOicyMWMnLFxuJ21vdXNlLXBvaW50ZXInOicyNDUnLFxuJ211c2ljJzonMDAxJyxcbiduYXZpY29uJzonMGM5JyxcbiduZXV0ZXInOicyMmMnLFxuJ25ld3NwYXBlci1vJzonMWVhJyxcbidvYmplY3QtZ3JvdXAnOicyNDcnLFxuJ29iamVjdC11bmdyb3VwJzonMjQ4JyxcbidvZG5va2xhc3NuaWtpJzonMjYzJyxcbidvZG5va2xhc3NuaWtpLXNxdWFyZSc6JzI2NCcsXG4nb3BlbmNhcnQnOicyM2QnLFxuJ29wZW5pZCc6JzE5YicsXG4nb3BlcmEnOicyNmEnLFxuJ29wdGluLW1vbnN0ZXInOicyM2MnLFxuJ291dGRlbnQnOicwM2InLFxuJ3BhZ2VsaW5lcyc6JzE4YycsXG4ncGFpbnQtYnJ1c2gnOicxZmMnLFxuJ3BhcGVyLXBsYW5lJzonMWQ4JyxcbidwYXBlci1wbGFuZS1vJzonMWQ5JyxcbidwYXBlcmNsaXAnOicwYzYnLFxuJ3BhcmFncmFwaCc6JzFkZCcsXG4ncGFzdGUnOicwZWEnLFxuJ3BhdXNlJzonMDRjJyxcbidwYXcnOicxYjAnLFxuJ3BheXBhbCc6JzFlZCcsXG4ncGVuY2lsJzonMDQwJyxcbidwZW5jaWwtc3F1YXJlJzonMTRiJyxcbidwZW5jaWwtc3F1YXJlLW8nOicwNDQnLFxuJ3Bob25lJzonMDk1JyxcbidwaG9uZS1zcXVhcmUnOicwOTgnLFxuJ3Bob3RvJzonMDNlJyxcbidwaWN0dXJlLW8nOicwM2UnLFxuJ3BpZS1jaGFydCc6JzIwMCcsXG4ncGllZC1waXBlcic6JzFhNycsXG4ncGllZC1waXBlci1hbHQnOicxYTgnLFxuJ3BpbnRlcmVzdCc6JzBkMicsXG4ncGludGVyZXN0LXAnOicyMzEnLFxuJ3BpbnRlcmVzdC1zcXVhcmUnOicwZDMnLFxuJ3BsYW5lJzonMDcyJyxcbidwbGF5JzonMDRiJyxcbidwbGF5LWNpcmNsZSc6JzE0NCcsXG4ncGxheS1jaXJjbGUtbyc6JzAxZCcsXG4ncGx1Zyc6JzFlNicsXG4ncGx1cyc6JzA2NycsXG4ncGx1cy1jaXJjbGUnOicwNTUnLFxuJ3BsdXMtc3F1YXJlJzonMGZlJyxcbidwbHVzLXNxdWFyZS1vJzonMTk2Jyxcbidwb3dlci1vZmYnOicwMTEnLFxuJ3ByaW50JzonMDJmJyxcbidwdXp6bGUtcGllY2UnOicxMmUnLFxuJ3FxJzonMWQ2JyxcbidxcmNvZGUnOicwMjknLFxuJ3F1ZXN0aW9uJzonMTI4JyxcbidxdWVzdGlvbi1jaXJjbGUnOicwNTknLFxuJ3F1b3RlLWxlZnQnOicxMGQnLFxuJ3F1b3RlLXJpZ2h0JzonMTBlJyxcbidyYSc6JzFkMCcsXG4ncmFuZG9tJzonMDc0JyxcbidyZWJlbCc6JzFkMCcsXG4ncmVjeWNsZSc6JzFiOCcsXG4ncmVkZGl0JzonMWExJyxcbidyZWRkaXQtc3F1YXJlJzonMWEyJyxcbidyZWZyZXNoJzonMDIxJyxcbidyZWdpc3RlcmVkJzonMjVkJyxcbidyZW1vdmUnOicwMGQnLFxuJ3JlbnJlbic6JzE4YicsXG4ncmVvcmRlcic6JzBjOScsXG4ncmVwZWF0JzonMDFlJyxcbidyZXBseSc6JzExMicsXG4ncmVwbHktYWxsJzonMTIyJyxcbidyZXR3ZWV0JzonMDc5JyxcbidybWInOicxNTcnLFxuJ3JvYWQnOicwMTgnLFxuJ3JvY2tldCc6JzEzNScsXG4ncm90YXRlLWxlZnQnOicwZTInLFxuJ3JvdGF0ZS1yaWdodCc6JzAxZScsXG4ncm91YmxlJzonMTU4Jyxcbidyc3MnOicwOWUnLFxuJ3Jzcy1zcXVhcmUnOicxNDMnLFxuJ3J1Yic6JzE1OCcsXG4ncnVibGUnOicxNTgnLFxuJ3J1cGVlJzonMTU2JyxcbidzYWZhcmknOicyNjcnLFxuJ3NhdmUnOicwYzcnLFxuJ3NjaXNzb3JzJzonMGM0JyxcbidzZWFyY2gnOicwMDInLFxuJ3NlYXJjaC1taW51cyc6JzAxMCcsXG4nc2VhcmNoLXBsdXMnOicwMGUnLFxuJ3NlbGxzeSc6JzIxMycsXG4nc2VuZCc6JzFkOCcsXG4nc2VuZC1vJzonMWQ5JyxcbidzZXJ2ZXInOicyMzMnLFxuJ3NoYXJlJzonMDY0JyxcbidzaGFyZS1hbHQnOicxZTAnLFxuJ3NoYXJlLWFsdC1zcXVhcmUnOicxZTEnLFxuJ3NoYXJlLXNxdWFyZSc6JzE0ZCcsXG4nc2hhcmUtc3F1YXJlLW8nOicwNDUnLFxuJ3NoZWtlbCc6JzIwYicsXG4nc2hlcWVsJzonMjBiJyxcbidzaGllbGQnOicxMzInLFxuJ3NoaXAnOicyMWEnLFxuJ3NoaXJ0c2luYnVsayc6JzIxNCcsXG4nc2hvcHBpbmctY2FydCc6JzA3YScsXG4nc2lnbi1pbic6JzA5MCcsXG4nc2lnbi1vdXQnOicwOGInLFxuJ3NpZ25hbCc6JzAxMicsXG4nc2ltcGx5YnVpbHQnOicyMTUnLFxuJ3NpdGVtYXAnOicwZTgnLFxuJ3NreWF0bGFzJzonMjE2Jyxcbidza3lwZSc6JzE3ZScsXG4nc2xhY2snOicxOTgnLFxuJ3NsaWRlcnMnOicxZGUnLFxuJ3NsaWRlc2hhcmUnOicxZTcnLFxuJ3NtaWxlLW8nOicxMTgnLFxuJ3NvY2Nlci1iYWxsLW8nOicxZTMnLFxuJ3NvcnQnOicwZGMnLFxuJ3NvcnQtYWxwaGEtYXNjJzonMTVkJyxcbidzb3J0LWFscGhhLWRlc2MnOicxNWUnLFxuJ3NvcnQtYW1vdW50LWFzYyc6JzE2MCcsXG4nc29ydC1hbW91bnQtZGVzYyc6JzE2MScsXG4nc29ydC1hc2MnOicwZGUnLFxuJ3NvcnQtZGVzYyc6JzBkZCcsXG4nc29ydC1kb3duJzonMGRkJyxcbidzb3J0LW51bWVyaWMtYXNjJzonMTYyJyxcbidzb3J0LW51bWVyaWMtZGVzYyc6JzE2MycsXG4nc29ydC11cCc6JzBkZScsXG4nc291bmRjbG91ZCc6JzFiZScsXG4nc3BhY2Utc2h1dHRsZSc6JzE5NycsXG4nc3Bpbm5lcic6JzExMCcsXG4nc3Bvb24nOicxYjEnLFxuJ3Nwb3RpZnknOicxYmMnLFxuJ3NxdWFyZSc6JzBjOCcsXG4nc3F1YXJlLW8nOicwOTYnLFxuJ3N0YWNrLWV4Y2hhbmdlJzonMThkJyxcbidzdGFjay1vdmVyZmxvdyc6JzE2YycsXG4nc3Rhcic6JzAwNScsXG4nc3Rhci1oYWxmJzonMDg5JyxcbidzdGFyLWhhbGYtZW1wdHknOicxMjMnLFxuJ3N0YXItaGFsZi1mdWxsJzonMTIzJyxcbidzdGFyLWhhbGYtbyc6JzEyMycsXG4nc3Rhci1vJzonMDA2JyxcbidzdGVhbSc6JzFiNicsXG4nc3RlYW0tc3F1YXJlJzonMWI3JyxcbidzdGVwLWJhY2t3YXJkJzonMDQ4JyxcbidzdGVwLWZvcndhcmQnOicwNTEnLFxuJ3N0ZXRob3Njb3BlJzonMGYxJyxcbidzdGlja3ktbm90ZSc6JzI0OScsXG4nc3RpY2t5LW5vdGUtbyc6JzI0YScsXG4nc3RvcCc6JzA0ZCcsXG4nc3RyZWV0LXZpZXcnOicyMWQnLFxuJ3N0cmlrZXRocm91Z2gnOicwY2MnLFxuJ3N0dW1ibGV1cG9uJzonMWE0JyxcbidzdHVtYmxldXBvbi1jaXJjbGUnOicxYTMnLFxuJ3N1YnNjcmlwdCc6JzEyYycsXG4nc3Vid2F5JzonMjM5JyxcbidzdWl0Y2FzZSc6JzBmMicsXG4nc3VuLW8nOicxODUnLFxuJ3N1cGVyc2NyaXB0JzonMTJiJyxcbidzdXBwb3J0JzonMWNkJyxcbid0YWJsZSc6JzBjZScsXG4ndGFibGV0JzonMTBhJyxcbid0YWNob21ldGVyJzonMGU0Jyxcbid0YWcnOicwMmInLFxuJ3RhZ3MnOicwMmMnLFxuJ3Rhc2tzJzonMGFlJyxcbid0YXhpJzonMWJhJyxcbid0ZWxldmlzaW9uJzonMjZjJyxcbid0ZW5jZW50LXdlaWJvJzonMWQ1Jyxcbid0ZXJtaW5hbCc6JzEyMCcsXG4ndGV4dC1oZWlnaHQnOicwMzQnLFxuJ3RleHQtd2lkdGgnOicwMzUnLFxuJ3RoJzonMDBhJyxcbid0aC1sYXJnZSc6JzAwOScsXG4ndGgtbGlzdCc6JzAwYicsXG4ndGh1bWItdGFjayc6JzA4ZCcsXG4ndGh1bWJzLWRvd24nOicxNjUnLFxuJ3RodW1icy1vLWRvd24nOicwODgnLFxuJ3RodW1icy1vLXVwJzonMDg3Jyxcbid0aHVtYnMtdXAnOicxNjQnLFxuJ3RpY2tldCc6JzE0NScsXG4ndGltZXMnOicwMGQnLFxuJ3RpbWVzLWNpcmNsZSc6JzA1NycsXG4ndGltZXMtY2lyY2xlLW8nOicwNWMnLFxuJ3RpbnQnOicwNDMnLFxuJ3RvZ2dsZS1kb3duJzonMTUwJyxcbid0b2dnbGUtbGVmdCc6JzE5MScsXG4ndG9nZ2xlLW9mZic6JzIwNCcsXG4ndG9nZ2xlLW9uJzonMjA1Jyxcbid0b2dnbGUtcmlnaHQnOicxNTInLFxuJ3RvZ2dsZS11cCc6JzE1MScsXG4ndHJhZGVtYXJrJzonMjVjJyxcbid0cmFpbic6JzIzOCcsXG4ndHJhbnNnZW5kZXInOicyMjQnLFxuJ3RyYW5zZ2VuZGVyLWFsdCc6JzIyNScsXG4ndHJhc2gnOicxZjgnLFxuJ3RyYXNoLW8nOicwMTQnLFxuJ3RyZWUnOicxYmInLFxuJ3RyZWxsbyc6JzE4MScsXG4ndHJpcGFkdmlzb3InOicyNjInLFxuJ3Ryb3BoeSc6JzA5MScsXG4ndHJ1Y2snOicwZDEnLFxuJ3RyeSc6JzE5NScsXG4ndHR5JzonMWU0Jyxcbid0dW1ibHInOicxNzMnLFxuJ3R1bWJsci1zcXVhcmUnOicxNzQnLFxuJ3R1cmtpc2gtbGlyYSc6JzE5NScsXG4ndHYnOicyNmMnLFxuJ3R3aXRjaCc6JzFlOCcsXG4ndHdpdHRlcic6JzA5OScsXG4ndHdpdHRlci1zcXVhcmUnOicwODEnLFxuJ3VtYnJlbGxhJzonMGU5Jyxcbid1bmRlcmxpbmUnOicwY2QnLFxuJ3VuZG8nOicwZTInLFxuJ3VuaXZlcnNpdHknOicxOWMnLFxuJ3VubGluayc6JzEyNycsXG4ndW5sb2NrJzonMDljJyxcbid1bmxvY2stYWx0JzonMTNlJyxcbid1bnNvcnRlZCc6JzBkYycsXG4ndXBsb2FkJzonMDkzJyxcbid1c2QnOicxNTUnLFxuJ3VzZXInOicwMDcnLFxuJ3VzZXItbWQnOicwZjAnLFxuJ3VzZXItcGx1cyc6JzIzNCcsXG4ndXNlci1zZWNyZXQnOicyMWInLFxuJ3VzZXItdGltZXMnOicyMzUnLFxuJ3VzZXJzJzonMGMwJyxcbid2ZW51cyc6JzIyMScsXG4ndmVudXMtZG91YmxlJzonMjI2Jyxcbid2ZW51cy1tYXJzJzonMjI4Jyxcbid2aWFjb2luJzonMjM3Jyxcbid2aWRlby1jYW1lcmEnOicwM2QnLFxuJ3ZpbWVvJzonMjdkJyxcbid2aW1lby1zcXVhcmUnOicxOTQnLFxuJ3ZpbmUnOicxY2EnLFxuJ3ZrJzonMTg5Jyxcbid2b2x1bWUtZG93bic6JzAyNycsXG4ndm9sdW1lLW9mZic6JzAyNicsXG4ndm9sdW1lLXVwJzonMDI4Jyxcbid3YXJuaW5nJzonMDcxJyxcbid3ZWNoYXQnOicxZDcnLFxuJ3dlaWJvJzonMThhJyxcbid3ZWl4aW4nOicxZDcnLFxuJ3doYXRzYXBwJzonMjMyJyxcbid3aGVlbGNoYWlyJzonMTkzJyxcbid3aWZpJzonMWViJyxcbid3aWtpcGVkaWEtdyc6JzI2NicsXG4nd2luZG93cyc6JzE3YScsXG4nd29uJzonMTU5Jyxcbid3b3JkcHJlc3MnOicxOWEnLFxuJ3dyZW5jaCc6JzBhZCcsXG4neGluZyc6JzE2OCcsXG4neGluZy1zcXVhcmUnOicxNjknLFxuJ3ktY29tYmluYXRvcic6JzIzYicsXG4neS1jb21iaW5hdG9yLXNxdWFyZSc6JzFkNCcsXG4neWFob28nOicxOWUnLFxuJ3ljJzonMjNiJyxcbid5Yy1zcXVhcmUnOicxZDQnLFxuJ3llbHAnOicxZTknLFxuJ3llbic6JzE1NycsXG4neW91dHViZSc6JzE2NycsXG4neW91dHViZS1wbGF5JzonMTZhJyxcbid5b3V0dWJlLXNxdWFyZSc6JzE2Nidcbn07XG5cbmZ1bmN0aW9uIHNHbHlwaChzKSB7XG4gIHJldHVybiAnJiN4ZicgKyBzICsgJzsnXG59XG5cbi8vIGxvb2t1cCBnbHlwaCBnaXZlbiBuYW1lXG5oYi5yZWdpc3RlckhlbHBlcignZmFHbHlwaCcsIGZ1bmN0aW9uKG5hbWUsIGZyYW1lKSB7XG4gIHZhciBnbHlwaCA9IGdseXBoTWFwW25hbWVdO1xuICByZXR1cm4gZ2x5cGggPyBzR2x5cGgoZ2x5cGgpIDogJyc7XG59KTtcblxuLy8gZ2V0IGljb24gaHRtbCBmb3IgYSBuYW1lIC0geHRyYSBjbGFzc2VzIG9wdGlvbmFsXG5oYi5yZWdpc3RlckhlbHBlcignZmFJY29uJywgZnVuY3Rpb24obmFtZSwgeHRyYSwgZnJhbWUpIHtcbiAgcmV0dXJuIGljb25IdG1sKG5hbWUsIGhiLmhicCh4dHJhKSk7XG59KTtcblxuLy8gYmxvY2sgaGVscGVyIG92ZXIgYWxsIHtuYW1lOiBnbHlwaDp9XG5oYi5yZWdpc3RlckhlbHBlcignZWFjaEZhJywgZnVuY3Rpb24oZnJhbWUpIHtcbiAgcmV0dXJuIHUubWFwKGdseXBoTWFwLCBmdW5jdGlvbihnbHlwaCwgbmFtZSkge1xuICAgIHJldHVybiBmcmFtZS5mbih7IG5hbWU6bmFtZSwgZ2x5cGg6c0dseXBoKGdseXBoKSB9KTtcbiAgfSkuam9pbignJyk7XG59KTtcblxuLy8gZ2V0IGh0bWwgZm9yIG5hbWUsIHdpdGggb3B0aW9uYWwgZXh0cmEgY2xhc3Nlc1xuZnVuY3Rpb24gaWNvbkh0bWwobmFtZSwgeHRyYSkge1xuICB2YXIgZ2x5cGggPSBnbHlwaE1hcFtuYW1lXTtcbiAgaWYgKCFnbHlwaCkgcmV0dXJuO1xuICB2YXIgeHRyYSA9IHh0cmEgPyAoJyBmYS0nICsgeHRyYS5zcGxpdCgvXFxzLykuam9pbignIGZhLScpKSA6ICcnO1xuICByZXR1cm4gJzxzcGFuIGNsYXNzPVwiZmEnICsgeHRyYSArICdcIj4nICsgc0dseXBoKGdseXBoKSArICc8L3NwYW4+Jztcbn1cblxuLy8gdGVzdCBmb3IgIWdseXBoTWFwa2V5IGNsYXNzMSBjbGFzczIgY2xhc3MzIC4uLlxudmFyIHJlID0gbmV3IFJlZ0V4cCgnXiEoJyArIHUua2V5cyhnbHlwaE1hcCkuam9pbignfCcpICsgJykoPzpcXFxccysoLispfCQpJyk7XG5cbi8vIG11dGF0ZSBtYXJrZWQgcmVuZGVyZXIgdG8gY3VzdG9taXplIC5lbSBodG1sXG52YXIgcmVuZGVyZXIgPSBnZW5lcmF0b3IucmVuZGVyZXI7XG52YXIgcmVuZGVyRW0gPSByZW5kZXJlci5lbTtcbnJlbmRlcmVyLmVtID0gZnVuY3Rpb24gZW0odGV4dCkge1xuICB2YXIgbWF0Y2g7XG4gIGlmIChtYXRjaCA9IHUuc3RyKHRleHQpLm1hdGNoKHJlKSkgcmV0dXJuIGljb25IdG1sKG1hdGNoWzFdLCBtYXRjaFsyXSk7XG4gIHJldHVybiByZW5kZXJFbS5jYWxsKHRoaXMsIHRleHQpO1xufVxuXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGdlbmVyYXRvcikge1xuICB2YXIgdSA9IGdlbmVyYXRvci51dGlsO1xuICB2YXIgb3B0cyA9IGdlbmVyYXRvci5vcHRzO1xuICB2YXIgbG9nID0gb3B0cy5sb2c7XG4gIHZhciBoYiA9IGdlbmVyYXRvci5oYW5kbGViYXJzO1xuXG4gIGlmICgvXFwvXFwvbG9jYWxob3N0Ly50ZXN0KG9wdHMuYXBwVXJsKSkge1xuICAgIGxvZygnV0FSTklORzogcHViLXBrZy1zZW8gc2l0ZW1hcCB1c2luZyBhcHBVcmwgJXMnLCBvcHRzLmFwcFVybCk7XG4gIH1cblxuICBoYi5yZWdpc3RlckhlbHBlcignbWV0YVNlbycsIGZ1bmN0aW9uKGZyYW1lKSB7XG4gICAgaWYgKG9wdHMubm9Sb2JvdHMpIHtcbiAgICAgIHJldHVybiAnPG1ldGEgbmFtZT1cInJvYm90c1wiIGNvbnRlbnQ9XCJub2luZGV4LCBub2ZvbGxvd1wiPic7XG4gICAgfVxuICB9KTtcblxufVxuIiwicmVxdWlyZShcInB1Yi1wYWdlclwiKShnZW5lcmF0b3IpO1xucmVxdWlyZShcIi9Vc2Vycy9oZWxsby9wdWIvd2Vic2l0ZS9wdWItZ2VuZXJhdG9yLXBsdWdpbi5qc1wiKShnZW5lcmF0b3IpO1xucmVxdWlyZShcIi9Vc2Vycy9oZWxsby9wdWIvc2VydmVyL25vZGVfbW9kdWxlcy9wdWItcGtnLWZvbnQtYXdlc29tZS9nZW5lcmF0b3ItcGx1Z2luLmpzXCIpKGdlbmVyYXRvcik7XG5yZXF1aXJlKFwiL1VzZXJzL2hlbGxvL3B1Yi9zZXJ2ZXIvbm9kZV9tb2R1bGVzL3B1Yi1wa2ctc2VvL2dlbmVyYXRvci1wbHVnaW4uanNcIikoZ2VuZXJhdG9yKTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gSWYgb2JqLmhhc093blByb3BlcnR5IGhhcyBiZWVuIG92ZXJyaWRkZW4sIHRoZW4gY2FsbGluZ1xuLy8gb2JqLmhhc093blByb3BlcnR5KHByb3ApIHdpbGwgYnJlYWsuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9pc3N1ZXMvMTcwN1xuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihxcywgc2VwLCBlcSwgb3B0aW9ucykge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgdmFyIG9iaiA9IHt9O1xuXG4gIGlmICh0eXBlb2YgcXMgIT09ICdzdHJpbmcnIHx8IHFzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICB2YXIgcmVnZXhwID0gL1xcKy9nO1xuICBxcyA9IHFzLnNwbGl0KHNlcCk7XG5cbiAgdmFyIG1heEtleXMgPSAxMDAwO1xuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5tYXhLZXlzID09PSAnbnVtYmVyJykge1xuICAgIG1heEtleXMgPSBvcHRpb25zLm1heEtleXM7XG4gIH1cblxuICB2YXIgbGVuID0gcXMubGVuZ3RoO1xuICAvLyBtYXhLZXlzIDw9IDAgbWVhbnMgdGhhdCB3ZSBzaG91bGQgbm90IGxpbWl0IGtleXMgY291bnRcbiAgaWYgKG1heEtleXMgPiAwICYmIGxlbiA+IG1heEtleXMpIHtcbiAgICBsZW4gPSBtYXhLZXlzO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHZhciB4ID0gcXNbaV0ucmVwbGFjZShyZWdleHAsICclMjAnKSxcbiAgICAgICAgaWR4ID0geC5pbmRleE9mKGVxKSxcbiAgICAgICAga3N0ciwgdnN0ciwgaywgdjtcblxuICAgIGlmIChpZHggPj0gMCkge1xuICAgICAga3N0ciA9IHguc3Vic3RyKDAsIGlkeCk7XG4gICAgICB2c3RyID0geC5zdWJzdHIoaWR4ICsgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtzdHIgPSB4O1xuICAgICAgdnN0ciA9ICcnO1xuICAgIH1cblxuICAgIGsgPSBkZWNvZGVVUklDb21wb25lbnQoa3N0cik7XG4gICAgdiA9IGRlY29kZVVSSUNvbXBvbmVudCh2c3RyKTtcblxuICAgIGlmICghaGFzT3duUHJvcGVydHkob2JqLCBrKSkge1xuICAgICAgb2JqW2tdID0gdjtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgb2JqW2tdLnB1c2godik7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ialtrXSA9IFtvYmpba10sIHZdO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvYmo7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdpZnlQcmltaXRpdmUgPSBmdW5jdGlvbih2KSB7XG4gIHN3aXRjaCAodHlwZW9mIHYpIHtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIHY7XG5cbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiB2ID8gJ3RydWUnIDogJ2ZhbHNlJztcblxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gaXNGaW5pdGUodikgPyB2IDogJyc7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICcnO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9iaiwgc2VwLCBlcSwgbmFtZSkge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIG9iaiA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBtYXAob2JqZWN0S2V5cyhvYmopLCBmdW5jdGlvbihrKSB7XG4gICAgICB2YXIga3MgPSBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKGspKSArIGVxO1xuICAgICAgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgICByZXR1cm4gbWFwKG9ialtrXSwgZnVuY3Rpb24odikge1xuICAgICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUodikpO1xuICAgICAgICB9KS5qb2luKHNlcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9ialtrXSkpO1xuICAgICAgfVxuICAgIH0pLmpvaW4oc2VwKTtcblxuICB9XG5cbiAgaWYgKCFuYW1lKSByZXR1cm4gJyc7XG4gIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG5hbWUpKSArIGVxICtcbiAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqKSk7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuZnVuY3Rpb24gbWFwICh4cywgZikge1xuICBpZiAoeHMubWFwKSByZXR1cm4geHMubWFwKGYpO1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICByZXMucHVzaChmKHhzW2ldLCBpKSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSByZXMucHVzaChrZXkpO1xuICB9XG4gIHJldHVybiByZXM7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmRlY29kZSA9IGV4cG9ydHMucGFyc2UgPSByZXF1aXJlKCcuL2RlY29kZScpO1xuZXhwb3J0cy5lbmNvZGUgPSBleHBvcnRzLnN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vZW5jb2RlJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGdlbmVyYXRvcikge1xuXG4gIHZhciBvcHRzID0gZ2VuZXJhdG9yLm9wdHM7XG4gIHZhciBsb2cgPSBvcHRzLmxvZztcbiAgdmFyIGhiID0gZ2VuZXJhdG9yLmhhbmRsZWJhcnM7XG4gIHZhciB1ID0gZ2VuZXJhdG9yLnV0aWw7XG4gIHZhciBkZWJ1ZyA9IGdlbmVyYXRvci5kZWJ1ZztcblxuICAvLyBwcmUtY29tcHV0ZSByZXN1bHRzIGZvciBlYWNoIGZpbmQtc29sdXRpb25zIHBhZ2VcbiAgZ2VuZXJhdG9yLm9uKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3VsdExpc3QgPSB1KGdlbmVyYXRvci50ZW1wbGF0ZVBhZ2VzJFsnc29sdXRpb24nXSlcbiAgICAgIC5yZWplY3QoJ25vcHVibGlzaCcpXG4gICAgICAuc29ydEJ5KCdjcmVhdGVkJylcbiAgICAgIC5yZXZlcnNlKClcbiAgICAgIC52YWx1ZSgpO1xuXG4gICAgdS5lYWNoKGdlbmVyYXRvci50ZW1wbGF0ZVBhZ2VzJFsnc29sdXRpb25zJ10sIGZ1bmN0aW9uKHBhZ2UpIHtcblxuICAgICAgaWYgKCFwYWdlLnNlYXJjaENhdGVnb3J5KSB7XG4gICAgICAgIHBhZ2UucmVzdWx0cyA9IHJlc3VsdExpc3Q7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmUgPSBuZXcgUmVnRXhwKCdeJyArIHUuZXNjYXBlUmVnRXhwKHBhZ2Uuc2VhcmNoQ2F0ZWdvcnkpKTtcbiAgICAgICAgcGFnZS5yZXN1bHRzID0gdS5maWx0ZXIocmVzdWx0TGlzdCwgZnVuY3Rpb24ocCkge1xuICAgICAgICAgIHJldHVybiB1LnNvbWUodS5nZXRhVmFscyhwLCAnY2F0ZWdvcnknKSwgZnVuY3Rpb24oYykge1xuICAgICAgICAgICAgcmV0dXJuIHJlLnRlc3QoYylcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICAvLyBsb2coJ3ByZS1jb21wdXRlZDonLCBwYWdlLl9ocmVmLCBwYWdlLnJlc3VsdHMubGVuZ3RoKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gdGVtcG9yYXJpbHkgY29waWVkIGZyb20gZ2VuZXJhdG9yL2hlbHBlcnMuanNcbiAgLy8gYmxvY2staGVscGVyIGZvciBmcmFnbWVudHMgbWF0Y2hpbmcgcGF0dGVyblxuICAvLyBmcmFnbWVudCBwYXR0ZXJuIHNob3VsZCBzdGFydCB3aXRoICMuLi4gb3IgL3BhZ2UjLi4uXG4gIGhiLnJlZ2lzdGVySGVscGVyKCdlYWNoRnJhZ21lbnQnLCBmdW5jdGlvbihwYXR0ZXJuLCBmcmFtZSkge1xuICAgIHZhciBwID0gaGIuaGJwKHBhdHRlcm4pO1xuICAgIGZyYW1lID0gcCA/IGZyYW1lIDogcGF0dGVybjtcbiAgICB2YXIgcmcgPSBzZWxlY3RGcmFnbWVudHMocCwgdGhpcyk7XG4gICAgdmFyIG1hcCA9IHUubWFwKHJnLCBmdW5jdGlvbihmcmFnbWVudCwgaW5kZXgpIHtcbiAgICAgIGZyYW1lLmRhdGEuaW5kZXggPSBpbmRleDtcbiAgICAgIGlmIChpbmRleCA9PT0gcmcubGVuZ3RoIC0gMSkgeyBmcmFtZS5kYXRhLmxhc3QgPSB0cnVlOyB9XG4gICAgICByZXR1cm4gZnJhbWUuZm4oZnJhZ21lbnQsIGZyYW1lKTtcbiAgICB9KTtcbiAgICByZXR1cm4gbWFwLmpvaW4oJycpO1xuXG4gICAgLy8gbG9va3VwIG11bHRpcGxlIGZyYWdtZW50cyB2aWEgaHJlZiBwYXR0ZXJuIG1hdGNoXG4gICAgLy8gd29ya3MgbGlrZSByZXNvbHZlIHdpdGggYSB3aWxkY2FyZFxuICAgIC8vIGNhcmVmdWwgdXNpbmcgdGhpcyB3aXRob3V0ICNcbiAgICBmdW5jdGlvbiBzZWxlY3RGcmFnbWVudHMocmVmcGF0LCBjb250ZXh0KSB7XG4gICAgICByZWZwYXQgPSByZWZwYXQgfHwgJyMnO1xuICAgICAgaWYgKC9eIy8udGVzdChyZWZwYXQpKSB7XG4gICAgICAgIHJlZnBhdCA9ICdeJyArIHUuZXNjYXBlUmVnRXhwKChjb250ZXh0Ll9ocmVmIHx8ICcvJykgKyByZWZwYXQpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHJlZnBhdCA9IHUuZXNjYXBlUmVnRXhwKHJlZnBhdCk7XG4gICAgICB9XG4gICAgICB2YXIgcmUgPSBuZXcgUmVnRXhwKHJlZnBhdCk7XG4gICAgICByZXR1cm4gdS5maWx0ZXIoZ2VuZXJhdG9yLmZyYWdtZW50cywgZnVuY3Rpb24oZnJhZ21lbnQpIHsgcmV0dXJuIHJlLnRlc3QoZnJhZ21lbnQuX2hyZWYpOyB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGhiLnJlZ2lzdGVySGVscGVyKCdlYWNoU2VhcmNoUmVzdWx0cycsIGZ1bmN0aW9uKGZyYW1lKSB7XG4gICAgdmFyIGxpc3QgPSB0aGlzLnJlc3VsdHM7XG4gICAgdmFyIHR4dCA9IHUuZ2V0KGdlbmVyYXRvciwgJ3JlcS5xdWVyeS5xJyk7IC8vIGxlYWt5IHdheSB0byBwYXNzIHBhcmFtc1xuICAgIGlmICh0eHQpIHtcbiAgICAgIGRlYnVnKCdzZWFyY2hpbmcgZm9yOiBcIiVzXCInLCB0eHQpO1xuICAgICAgdmFyIHJlID0gdS5ncmVwKHR4dCk7XG4gICAgICBsaXN0ID0gdS5maWx0ZXIobGlzdCwgZnVuY3Rpb24ocCkge1xuICAgICAgICByZXR1cm4gcmUudGVzdChwLl9ocmVmKSB8fCByZS50ZXN0KHAubmFtZSkgfHwgcmUudGVzdChwLmNhdGVnb3J5KSB8fCByZS50ZXN0KHAudGFncykgfHwgcmUudGVzdChwLl90eHQpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB1Lm1hcChsaXN0LCBmdW5jdGlvbihwYWdlLCBpZHgpIHtcbiAgICAgIGZyYW1lLmRhdGEuaW5kZXggPSBpZHg7XG4gICAgICByZXR1cm4gZnJhbWUuZm4ocGFnZSwgZnJhbWUpO1xuICAgIH0pLmpvaW4oJycpO1xuICB9KTtcblxuICBoYi5yZWdpc3RlckhlbHBlcignbGFzdFNlYXJjaCcsIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB1LmdldChnZW5lcmF0b3IsICdyZXEucXVlcnkucScpO1xuICB9KTtcblxuICBoYi5yZWdpc3RlckhlbHBlcignaWNvbicsIGZ1bmN0aW9uKGZyYW1lKSB7XG4gICAgaWYgKCF0aGlzLmljb24pIHJldHVybiAnJztcbiAgICByZXR1cm4gJzxpbWcgc3JjPVwiJyArIGhiLmZpeFBhdGgodGhpcy5pY29uKSArICdcIj4nO1xuICB9KTtcblxuICAvLyByZXR1cm4gZWl0aGVyIGJhbm5lciBodG1sIG9yLCBmYWlsaW5nIHRoYXQsIHBhZ2UgaHRtbFxuICBoYi5yZWdpc3RlckhlbHBlcignYmFubmVyJywgZnVuY3Rpb24oZnJhbWUpIHtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzWycjYmFubmVyJ10gfHwgdGhpcztcbiAgICByZXR1cm4gZ2VuZXJhdG9yLnJlbmRlck1hcmtkb3duKGZyYWdtZW50Ll90eHQsIGhiLnJlbmRlck9wdHMoKSk7XG4gIH0pO1xuXG4gIC8vIHJldHVybiBzb2x1dGlvbiBzdW1tYXJ5IGlmIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIHVzZSBtYWluIHNvbHV0aW9uIHRleHRcbiAgaGIucmVnaXN0ZXJIZWxwZXIoJ3N1bW1hcnknLCBmdW5jdGlvbihmcmFtZSkge1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXNbJyNzdW1tYXJ5J10gfHwgdGhpcztcbiAgICByZXR1cm4gZ2VuZXJhdG9yLnJlbmRlck1hcmtkb3duKHUudHJ1bmMoZnJhZ21lbnQuX3R4dCwgMjQwKSwgaGIucmVuZGVyT3B0cygpKTtcbiAgfSk7XG5cbiAgaGIucmVnaXN0ZXJIZWxwZXIoJ2VhY2hTZWFyY2hUYWcnLCBmdW5jdGlvbihmcmFtZSkge1xuICAgIGlmICghdGhpcy5zZWFyY2hUYWdzKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIHUubWFwKHRoaXMuc2VhcmNoVGFncy5zcGxpdCgnLCcpLCBmdW5jdGlvbih0YWcpIHtcbiAgICAgIHJldHVybiBmcmFtZS5mbih1LnRyaW0odGFnKSwgZnJhbWUpO1xuICAgIH0pLmpvaW4oJycpO1xuICB9KTtcblxuIGhiLnJlZ2lzdGVySGVscGVyKCdjYXRlZ29yeS1pY29ucycsIGZ1bmN0aW9uKGZyYW1lKSB7XG4gICB2YXIgY2F0cyA9IEFycmF5LmlzQXJyYXkodGhpcy5jYXRlZ29yeSkgPyB0aGlzLmNhdGVnb3J5IDogW3RoaXMuY2F0ZWdvcnldO1xuICAgcmV0dXJuIGNhdHMubWFwKGZ1bmN0aW9uIChjYXQpIHtcbiAgICAgdmFyIHBhdGggPSBoYi5maXhQYXRoKCcvaW1nL2NhdGVnb3J5LWljb25zLycgKyBjYXQgKyAnLnBuZycpO1xuICAgICByZXR1cm4gJzxpbWcgc3JjPVwiJyArIHBhdGggKyAnXCIgYWx0PVwiJyArIGNhdCArICdcIj4nO1xuICAgfSkuam9pbignJyk7XG4gfSk7XG5cbiBoYi5yZWdpc3RlckhlbHBlcigndmlkZW8tcGxheWVyJywgZnVuY3Rpb24oZnJhbWUpIHtcbiAgIHJldHVybiB0aGlzLnZpZGVvID8gJzxpZnJhbWUgc3JjPVwiJyArIGhiLmZpeFBhdGgodGhpcy52aWRlbykgKyAnXCIgZnJhbWVib3JkZXI9XCIwXCI+PC9pZnJhbWU+JyA6ICcnO1xuIH0pO1xuXG4gaGIucmVnaXN0ZXJIZWxwZXIoJ3JlbFBhdGhIcmVmJywgZnVuY3Rpb24oaHJlZiwgZnJhbWUpIHtcbiAgIHJldHVybiB1LnJlbFBhdGgoaHJlZik7XG4gfSk7XG5cbn1cbiJdfQ==
