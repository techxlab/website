(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * humane.js
 * Humanized Messages for Notifications
 * @author Marc Harter (@wavded)
 * @example
 *   humane.log('hello world');
 * @license MIT
 * See more usage examples at: http://wavded.github.com/humane-js/
 */

;!function (name, context, definition) {
   if (typeof module !== 'undefined') module.exports = definition(name, context)
   else if (typeof define === 'function' && typeof define.amd  === 'object') define(definition)
   else context[name] = definition(name, context)
}('humane', this, function (name, context) {
   var win = window
   var doc = document

   var ENV = {
      on: function (el, type, cb) {
         'addEventListener' in win ? el.addEventListener(type,cb,false) : el.attachEvent('on'+type,cb)
      },
      off: function (el, type, cb) {
         'removeEventListener' in win ? el.removeEventListener(type,cb,false) : el.detachEvent('on'+type,cb)
      },
      bind: function (fn, ctx) {
         return function () { fn.apply(ctx,arguments) }
      },
      isArray: Array.isArray || function (obj) { return Object.prototype.toString.call(obj) === '[object Array]' },
      config: function (preferred, fallback) {
         return preferred != null ? preferred : fallback
      },
      transSupport: false,
      useFilter: /msie [678]/i.test(navigator.userAgent), // sniff, sniff
      _checkTransition: function () {
         var el = doc.createElement('div')
         var vendors = { webkit: 'webkit', Moz: '', O: 'o', ms: 'MS' }

         for (var vendor in vendors)
            if (vendor + 'Transition' in el.style) {
               this.vendorPrefix = vendors[vendor]
               this.transSupport = true
            }
      }
   }
   ENV._checkTransition()

   var Humane = function (o) {
      o || (o = {})
      this.queue = []
      this.baseCls = o.baseCls || 'humane'
      this.addnCls = o.addnCls || ''
      this.timeout = 'timeout' in o ? o.timeout : 2500
      this.waitForMove = o.waitForMove || false
      this.clickToClose = o.clickToClose || false
      this.timeoutAfterMove = o.timeoutAfterMove || false
      this.container = o.container

      try { this._setupEl() } // attempt to setup elements
      catch (e) {
        ENV.on(win,'load',ENV.bind(this._setupEl, this)) // dom wasn't ready, wait till ready
      }
   }

   Humane.prototype = {
      constructor: Humane,
      _setupEl: function () {
         var el = doc.createElement('div')
         el.style.display = 'none'
         if (!this.container){
           if(doc.body) this.container = doc.body;
           else throw 'document.body is null'
         }
         this.container.appendChild(el)
         this.el = el
         this.removeEvent = ENV.bind(function(){
            var timeoutAfterMove = ENV.config(this.currentMsg.timeoutAfterMove,this.timeoutAfterMove)
            if (!timeoutAfterMove){
               this.remove()
            } else {
               setTimeout(ENV.bind(this.remove,this),timeoutAfterMove)
            }
         },this)

         this.transEvent = ENV.bind(this._afterAnimation,this)
         this._run()
      },
      _afterTimeout: function () {
         if (!ENV.config(this.currentMsg.waitForMove,this.waitForMove)) this.remove()

         else if (!this.removeEventsSet) {
            ENV.on(doc.body,'mousemove',this.removeEvent)
            ENV.on(doc.body,'click',this.removeEvent)
            ENV.on(doc.body,'keypress',this.removeEvent)
            ENV.on(doc.body,'touchstart',this.removeEvent)
            this.removeEventsSet = true
         }
      },
      _run: function () {
         if (this._animating || !this.queue.length || !this.el) return

         this._animating = true
         if (this.currentTimer) {
            clearTimeout(this.currentTimer)
            this.currentTimer = null
         }

         var msg = this.queue.shift()
         var clickToClose = ENV.config(msg.clickToClose,this.clickToClose)

         if (clickToClose) {
            ENV.on(this.el,'click',this.removeEvent)
            ENV.on(this.el,'touchstart',this.removeEvent)
         }

         var timeout = ENV.config(msg.timeout,this.timeout)

         if (timeout > 0)
            this.currentTimer = setTimeout(ENV.bind(this._afterTimeout,this), timeout)

         if (ENV.isArray(msg.html)) msg.html = '<ul><li>'+msg.html.join('<li>')+'</ul>'

         this.el.innerHTML = msg.html
         this.currentMsg = msg
         this.el.className = this.baseCls
         if (ENV.transSupport) {
            this.el.style.display = 'block'
            setTimeout(ENV.bind(this._showMsg,this),50)
         } else {
            this._showMsg()
         }

      },
      _setOpacity: function (opacity) {
         if (ENV.useFilter){
            try{
               this.el.filters.item('DXImageTransform.Microsoft.Alpha').Opacity = opacity*100
            } catch(err){}
         } else {
            this.el.style.opacity = String(opacity)
         }
      },
      _showMsg: function () {
         var addnCls = ENV.config(this.currentMsg.addnCls,this.addnCls)
         if (ENV.transSupport) {
            this.el.className = this.baseCls+' '+addnCls+' '+this.baseCls+'-animate'
         }
         else {
            var opacity = 0
            this.el.className = this.baseCls+' '+addnCls+' '+this.baseCls+'-js-animate'
            this._setOpacity(0) // reset value so hover states work
            this.el.style.display = 'block'

            var self = this
            var interval = setInterval(function(){
               if (opacity < 1) {
                  opacity += 0.1
                  if (opacity > 1) opacity = 1
                  self._setOpacity(opacity)
               }
               else clearInterval(interval)
            }, 30)
         }
      },
      _hideMsg: function () {
         var addnCls = ENV.config(this.currentMsg.addnCls,this.addnCls)
         if (ENV.transSupport) {
            this.el.className = this.baseCls+' '+addnCls
            ENV.on(this.el,ENV.vendorPrefix ? ENV.vendorPrefix+'TransitionEnd' : 'transitionend',this.transEvent)
         }
         else {
            var opacity = 1
            var self = this
            var interval = setInterval(function(){
               if(opacity > 0) {
                  opacity -= 0.1
                  if (opacity < 0) opacity = 0
                  self._setOpacity(opacity);
               }
               else {
                  self.el.className = self.baseCls+' '+addnCls
                  clearInterval(interval)
                  self._afterAnimation()
               }
            }, 30)
         }
      },
      _afterAnimation: function () {
         if (ENV.transSupport) ENV.off(this.el,ENV.vendorPrefix ? ENV.vendorPrefix+'TransitionEnd' : 'transitionend',this.transEvent)

         if (this.currentMsg.cb) this.currentMsg.cb()
         this.el.style.display = 'none'

         this._animating = false
         this._run()
      },
      remove: function (e) {
         var cb = typeof e == 'function' ? e : null

         ENV.off(doc.body,'mousemove',this.removeEvent)
         ENV.off(doc.body,'click',this.removeEvent)
         ENV.off(doc.body,'keypress',this.removeEvent)
         ENV.off(doc.body,'touchstart',this.removeEvent)
         ENV.off(this.el,'click',this.removeEvent)
         ENV.off(this.el,'touchstart',this.removeEvent)
         this.removeEventsSet = false

         if (cb && this.currentMsg) this.currentMsg.cb = cb
         if (this._animating) this._hideMsg()
         else if (cb) cb()
      },
      log: function (html, o, cb, defaults) {
         var msg = {}
         if (defaults)
           for (var opt in defaults)
               msg[opt] = defaults[opt]

         if (typeof o == 'function') cb = o
         else if (o)
            for (var opt in o) msg[opt] = o[opt]

         msg.html = html
         if (cb) msg.cb = cb
         this.queue.push(msg)
         this._run()
         return this
      },
      spawn: function (defaults) {
         var self = this
         return function (html, o, cb) {
            self.log.call(self,html,o,cb,defaults)
            return self
         }
      },
      create: function (o) { return new Humane(o) }
   }
   return new Humane()
});

},{}],2:[function(require,module,exports){
/*
 * editor-ui.js
 * browserify entry point for pub-pkg-editor user interface
 *
 * - depends on jquery
 * - uses iframe containing website layout for preview with 2 editing modes
 * - edit-mode captures clicks purely for selecting areas of content to edit
 * - nav-mode makes the iframe work just like a normal website
 *
 * copyright 2015, Jurgen Leschner - github.com/jldec - MIT license
*/

var humane = require('humane-js').create({timeout:600});

window.onGeneratorLoaded = function editorUI(generator) {

  var opts = generator.opts;
  var u = generator.util;

  var log = opts.log;

  // var origin = location.href.replace(/^(.*?:\/\/[^\/]+)\/.*$/,'$1' + '/pub')

  var $outer = $('.outer').get(0); // outermost div - for width and height

  var editor =
    { $name:   $('.name'),            // jquery name area in header
      $edit:   $('textarea.editor'),  // jquery editor textarea
      $save:   $('.savebutton'),      // jquery save button

      // binding is the _href of fragment being edited
      // NOTE: don't bind by ref! recompile invalidates refs
      binding: '' };

  var $preview = $('iframe.preview'); // jquery preview iframe
  var iframe = $preview.get(0);       // preview iframe

  var isLeftRight = true;
  var editorSize; // set in resizeEditor

  var DDPANE = 'pane-handle-drag'; // custom drag event type for pane handles

  var $css, pwindow; // set in previewOnLoad

  // iframe navigation and window backbutton handlers - use polling instead of onload
  // iframe.onload = previewOnLoad;
  var previewPoller = setInterval(previewOnLoad, 150);

  // navigation handler - nav events emitted by pager in pub-preview.js
  // note: fragments are selected via fragmentClick in preview selection mode
  generator.on('nav', handleNav);
  generator.on('loaded', handleNav);
  generator.on('notify', function(s) { log(s); humane.log(s); });

  var onIOS = /iPad|iPhone/i.test(navigator.userAgent);
  $(window).on(onIOS ? "pagehide" : "beforeunload", function() {
    log('beforeunload')
    generator.clientSaveHoldText();
    generator.clientSaveUnThrottled(); // throttled version may do nothing
  });

  $('.editbutton').click(toggleFragments);

  // show save button on the static host
  if (opts.staticHost) {
    $('.savebutton').removeClass('hide').click(generator.clientSave);
  }

  /* disabled menu links
  // either do single action in editor or show iframe e.g for upload

  $('.panebutton').click(togglePanes);
  $('.menubutton').click(toggleForm);
  $('.name').click(revertEdits);
  $('.helpbutton').click(help);

  */

  // initialize drag to adjust panes - use Text for type to satisfy IE
  $('.handle').attr('draggable', 'true').get(0)
    .addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('Text', DDPANE);
    });

  // handle pane adjust event over editor
  document.addEventListener('dragover', function(e) {
    adjustPanes(e.clientX, e.clientY, false); // handle over editor
    e.preventDefault();
  });

  // handle pane adjuster drop event
  // (firefox will try to navigate to the url if text is dropped on it)
  document.addEventListener('drop', function(e) {
      e.preventDefault();
  });

  // restore pane dimensions
  resizeEditor(-1);

  // preview iframe onload handler - initializes pwindow and $css
  function previewOnLoad() {
    pwindow = iframe.contentWindow;
    var p$ = pwindow && pwindow.$;        // preview jquery object
    if (!p$ || p$.editorLoaded) return;   // not ready || already initialized

    var pdoc = pwindow.document;

    // handle pane adjust event over preview
    pdoc.addEventListener('dragover', function(e) {
      adjustPanes(e.clientX, e.clientY, true); // handle over preview
      e.preventDefault();
    });

    // handle pane adjuster drop event over preview
    // (firefox will try to navigate to the url if text is dropped on it)
    pdoc.addEventListener('drop', function(e) {
      e.preventDefault();
    });

    pRef = pwindow.pubRef || {};
    var relPath = pRef.relPath || '';

    $css = p$('<link rel="stylesheet" href="' + relPath + '/pub/css/pub-preview.css">');
    p$('head').append($css);
    $css.get(0).disabled = true;
    toggleFragments();

    var $script = p$('<script src="' + relPath + '/pub/js/pub-preview.js"></script>');
    p$('body').append($script);

    p$.editorLoaded = true;
    clearInterval(previewPoller);
  };

  function toggleFragments() {
    var css = $css && $css.get(0);
    if (!css) return;
    if (css.disabled) {
      css.disabled = false;
      pwindow.addEventListener('click', fragmentClick, true);
    }
    else {
      css.disabled = true;
      pwindow.removeEventListener('click', fragmentClick, true);
    }
  }

  // fragment click handler
  function fragmentClick(e) {
    var el = e.target;
    var href;
    while (el && el.nodeName !== 'HTML' && !el.getAttribute('data-render-html')) { el = el.parentNode };
    if (el && (href = el.getAttribute('data-render-html'))) {
      bindEditor(generator.fragment$[href]);
      e.preventDefault(); // will also stop pager because it checks for e.defaultPrevented
    }
  }

  // navigation handler
  function handleNav(path, query, hash) {
    if (path) {
      // replace /pub/path... with /path...
      // history.replaceState(null, null, origin + path + query + hash);
      bindEditor(generator.fragment$[path + hash]);
    }
    else {
      // reload
      bindEditor(generator.fragment$[editor.binding]);
    }
  }

  // change editingHref to a different fragment or page
  function bindEditor(fragment) {
    saveBreakHold();
    if (fragment) {
      editor.$name.text(fragment._href);
      if (fragment._holdUpdates) {
        editText(fragment._holdText);
      }
      else {
        editText(fragment._hdr + fragment._txt);
      }
      editor.binding = fragment._href;
    }
    else {
      editor.$name.text('');
      editText('');
      editor.binding = '';
    }
  }

  // replace text in editor using clone()
  // firefox gotcha: undo key mutates content after nav-triggered $edit.val()
  // assume that jquery takes care of removing keyup handler
  function editText(text) {
    var $newedit = editor.$edit.clone().val(text);
    editor.$edit.replaceWith($newedit);
    editor.$edit = $newedit;
    editor.$edit.on('keyup', editorUpdate);
  }

  // register updates from editor using editor.binding
  function editorUpdate() {
    if (editor.binding) {
      if ('hold' === generator.clientUpdateFragmentText(editor.binding, editor.$edit.val())) {
        editor.holding = true;
      }
    }
  }

  // save with breakHold - may result in modified href ==> loss of binding context?
  function saveBreakHold() {
    if (editor.binding && editor.holding) {
      generator.clientUpdateFragmentText(editor.binding, editor.$edit.val(), true);
      editor.holding = false;
    }
  }

  // toggle panes between left/right and top/bottom
  function togglePanes() {
    $('.editorpane').toggleClass('row col left top');
    $('.previewpane').toggleClass('row col right bottom');
    isLeftRight = $('.handle').toggleClass('leftright topbottom').hasClass('leftright');
    resizeEditor(-1);
  }

  function toggleForm() {
    $('.form').toggle();
    $('.editor').toggleClass('showform');
  }

  // draggable pane adjuster
  // x and y come from the mouse either over the preview or the editor
  // preview coordinates start at the separator (==> editorSize + ratio)
  // allow 25 pixels for the header (should be read from element)
  function adjustPanes(x, y, overPreview) {
    var ratio = isLeftRight ?
        (x / $outer.clientWidth) :
        ((overPreview ? y : y - 25) / ($outer.clientHeight - 25));
    var psize = overPreview ? editorSize + ratio * 100 : ratio * 100;
    if (psize >= 0) { resizeEditor(psize); }
  }

  // adjust editor window size between 0 and 100%
  //  0 means hide
  // -1 means restore last setting (or 50%)
  function resizeEditor(psize) {
    var force = false;
    if (psize === -1) {
      force = true;
      psize = max(10, editorSize || Number(localStorage.editorSize) || 50);
    } else {
      psize = psize % 100;
    }
    if (force || editorSize !== psize) {
      if (psize) { localStorage.editorSize = editorSize = psize; } // don't remember 0
      if (isLeftRight) {
        $('.left.col').css(  { width:  psize + '%', height: '100%' });
        $('.right.col').css( { width:  (100 - psize) + '%', height: '100%' });
        $('.handle').css( { left: psize + '%', top: '0' });
      } else {
        $('.top.row').css(   { height: psize + '%', width:  '100%' });
        $('.bottom.row').css({ height: 100 - psize + '%', width:  '100%' });
        $('.handle').css( { left: '0', top: ((psize / 100 * ($outer.clientHeight - 25)) + 25) + 'px' });
      }
    }
  }

  function max(x,y) { return x>y ? x : y; }

}

},{"humane-js":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NlcnZlci9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS1taWRkbGV3YXJlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9wa2ctZWRpdG9yL25vZGVfbW9kdWxlcy9odW1hbmUtanMvaHVtYW5lLmpzIiwiLi4vc2VydmVyL25vZGVfbW9kdWxlcy9wdWItcGtnLWVkaXRvci9jbGllbnQvZWRpdG9yLXVpLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIGh1bWFuZS5qc1xuICogSHVtYW5pemVkIE1lc3NhZ2VzIGZvciBOb3RpZmljYXRpb25zXG4gKiBAYXV0aG9yIE1hcmMgSGFydGVyIChAd2F2ZGVkKVxuICogQGV4YW1wbGVcbiAqICAgaHVtYW5lLmxvZygnaGVsbG8gd29ybGQnKTtcbiAqIEBsaWNlbnNlIE1JVFxuICogU2VlIG1vcmUgdXNhZ2UgZXhhbXBsZXMgYXQ6IGh0dHA6Ly93YXZkZWQuZ2l0aHViLmNvbS9odW1hbmUtanMvXG4gKi9cblxuOyFmdW5jdGlvbiAobmFtZSwgY29udGV4dCwgZGVmaW5pdGlvbikge1xuICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IGRlZmluaXRpb24obmFtZSwgY29udGV4dClcbiAgIGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgID09PSAnb2JqZWN0JykgZGVmaW5lKGRlZmluaXRpb24pXG4gICBlbHNlIGNvbnRleHRbbmFtZV0gPSBkZWZpbml0aW9uKG5hbWUsIGNvbnRleHQpXG59KCdodW1hbmUnLCB0aGlzLCBmdW5jdGlvbiAobmFtZSwgY29udGV4dCkge1xuICAgdmFyIHdpbiA9IHdpbmRvd1xuICAgdmFyIGRvYyA9IGRvY3VtZW50XG5cbiAgIHZhciBFTlYgPSB7XG4gICAgICBvbjogZnVuY3Rpb24gKGVsLCB0eXBlLCBjYikge1xuICAgICAgICAgJ2FkZEV2ZW50TGlzdGVuZXInIGluIHdpbiA/IGVsLmFkZEV2ZW50TGlzdGVuZXIodHlwZSxjYixmYWxzZSkgOiBlbC5hdHRhY2hFdmVudCgnb24nK3R5cGUsY2IpXG4gICAgICB9LFxuICAgICAgb2ZmOiBmdW5jdGlvbiAoZWwsIHR5cGUsIGNiKSB7XG4gICAgICAgICAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgaW4gd2luID8gZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLGNiLGZhbHNlKSA6IGVsLmRldGFjaEV2ZW50KCdvbicrdHlwZSxjYilcbiAgICAgIH0sXG4gICAgICBiaW5kOiBmdW5jdGlvbiAoZm4sIGN0eCkge1xuICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHsgZm4uYXBwbHkoY3R4LGFyZ3VtZW50cykgfVxuICAgICAgfSxcbiAgICAgIGlzQXJyYXk6IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XScgfSxcbiAgICAgIGNvbmZpZzogZnVuY3Rpb24gKHByZWZlcnJlZCwgZmFsbGJhY2spIHtcbiAgICAgICAgIHJldHVybiBwcmVmZXJyZWQgIT0gbnVsbCA/IHByZWZlcnJlZCA6IGZhbGxiYWNrXG4gICAgICB9LFxuICAgICAgdHJhbnNTdXBwb3J0OiBmYWxzZSxcbiAgICAgIHVzZUZpbHRlcjogL21zaWUgWzY3OF0vaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpLCAvLyBzbmlmZiwgc25pZmZcbiAgICAgIF9jaGVja1RyYW5zaXRpb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgICAgICAgdmFyIHZlbmRvcnMgPSB7IHdlYmtpdDogJ3dlYmtpdCcsIE1vejogJycsIE86ICdvJywgbXM6ICdNUycgfVxuXG4gICAgICAgICBmb3IgKHZhciB2ZW5kb3IgaW4gdmVuZG9ycylcbiAgICAgICAgICAgIGlmICh2ZW5kb3IgKyAnVHJhbnNpdGlvbicgaW4gZWwuc3R5bGUpIHtcbiAgICAgICAgICAgICAgIHRoaXMudmVuZG9yUHJlZml4ID0gdmVuZG9yc1t2ZW5kb3JdXG4gICAgICAgICAgICAgICB0aGlzLnRyYW5zU3VwcG9ydCA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgIH1cbiAgIH1cbiAgIEVOVi5fY2hlY2tUcmFuc2l0aW9uKClcblxuICAgdmFyIEh1bWFuZSA9IGZ1bmN0aW9uIChvKSB7XG4gICAgICBvIHx8IChvID0ge30pXG4gICAgICB0aGlzLnF1ZXVlID0gW11cbiAgICAgIHRoaXMuYmFzZUNscyA9IG8uYmFzZUNscyB8fCAnaHVtYW5lJ1xuICAgICAgdGhpcy5hZGRuQ2xzID0gby5hZGRuQ2xzIHx8ICcnXG4gICAgICB0aGlzLnRpbWVvdXQgPSAndGltZW91dCcgaW4gbyA/IG8udGltZW91dCA6IDI1MDBcbiAgICAgIHRoaXMud2FpdEZvck1vdmUgPSBvLndhaXRGb3JNb3ZlIHx8IGZhbHNlXG4gICAgICB0aGlzLmNsaWNrVG9DbG9zZSA9IG8uY2xpY2tUb0Nsb3NlIHx8IGZhbHNlXG4gICAgICB0aGlzLnRpbWVvdXRBZnRlck1vdmUgPSBvLnRpbWVvdXRBZnRlck1vdmUgfHwgZmFsc2VcbiAgICAgIHRoaXMuY29udGFpbmVyID0gby5jb250YWluZXJcblxuICAgICAgdHJ5IHsgdGhpcy5fc2V0dXBFbCgpIH0gLy8gYXR0ZW1wdCB0byBzZXR1cCBlbGVtZW50c1xuICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgRU5WLm9uKHdpbiwnbG9hZCcsRU5WLmJpbmQodGhpcy5fc2V0dXBFbCwgdGhpcykpIC8vIGRvbSB3YXNuJ3QgcmVhZHksIHdhaXQgdGlsbCByZWFkeVxuICAgICAgfVxuICAgfVxuXG4gICBIdW1hbmUucHJvdG90eXBlID0ge1xuICAgICAgY29uc3RydWN0b3I6IEh1bWFuZSxcbiAgICAgIF9zZXR1cEVsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICB2YXIgZWwgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICAgICAgIGVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSdcbiAgICAgICAgIGlmICghdGhpcy5jb250YWluZXIpe1xuICAgICAgICAgICBpZihkb2MuYm9keSkgdGhpcy5jb250YWluZXIgPSBkb2MuYm9keTtcbiAgICAgICAgICAgZWxzZSB0aHJvdyAnZG9jdW1lbnQuYm9keSBpcyBudWxsJ1xuICAgICAgICAgfVxuICAgICAgICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQoZWwpXG4gICAgICAgICB0aGlzLmVsID0gZWxcbiAgICAgICAgIHRoaXMucmVtb3ZlRXZlbnQgPSBFTlYuYmluZChmdW5jdGlvbigpe1xuICAgICAgICAgICAgdmFyIHRpbWVvdXRBZnRlck1vdmUgPSBFTlYuY29uZmlnKHRoaXMuY3VycmVudE1zZy50aW1lb3V0QWZ0ZXJNb3ZlLHRoaXMudGltZW91dEFmdGVyTW92ZSlcbiAgICAgICAgICAgIGlmICghdGltZW91dEFmdGVyTW92ZSl7XG4gICAgICAgICAgICAgICB0aGlzLnJlbW92ZSgpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgc2V0VGltZW91dChFTlYuYmluZCh0aGlzLnJlbW92ZSx0aGlzKSx0aW1lb3V0QWZ0ZXJNb3ZlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgfSx0aGlzKVxuXG4gICAgICAgICB0aGlzLnRyYW5zRXZlbnQgPSBFTlYuYmluZCh0aGlzLl9hZnRlckFuaW1hdGlvbix0aGlzKVxuICAgICAgICAgdGhpcy5fcnVuKClcbiAgICAgIH0sXG4gICAgICBfYWZ0ZXJUaW1lb3V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICBpZiAoIUVOVi5jb25maWcodGhpcy5jdXJyZW50TXNnLndhaXRGb3JNb3ZlLHRoaXMud2FpdEZvck1vdmUpKSB0aGlzLnJlbW92ZSgpXG5cbiAgICAgICAgIGVsc2UgaWYgKCF0aGlzLnJlbW92ZUV2ZW50c1NldCkge1xuICAgICAgICAgICAgRU5WLm9uKGRvYy5ib2R5LCdtb3VzZW1vdmUnLHRoaXMucmVtb3ZlRXZlbnQpXG4gICAgICAgICAgICBFTlYub24oZG9jLmJvZHksJ2NsaWNrJyx0aGlzLnJlbW92ZUV2ZW50KVxuICAgICAgICAgICAgRU5WLm9uKGRvYy5ib2R5LCdrZXlwcmVzcycsdGhpcy5yZW1vdmVFdmVudClcbiAgICAgICAgICAgIEVOVi5vbihkb2MuYm9keSwndG91Y2hzdGFydCcsdGhpcy5yZW1vdmVFdmVudClcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRXZlbnRzU2V0ID0gdHJ1ZVxuICAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF9ydW46IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgIGlmICh0aGlzLl9hbmltYXRpbmcgfHwgIXRoaXMucXVldWUubGVuZ3RoIHx8ICF0aGlzLmVsKSByZXR1cm5cblxuICAgICAgICAgdGhpcy5fYW5pbWF0aW5nID0gdHJ1ZVxuICAgICAgICAgaWYgKHRoaXMuY3VycmVudFRpbWVyKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5jdXJyZW50VGltZXIpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRUaW1lciA9IG51bGxcbiAgICAgICAgIH1cblxuICAgICAgICAgdmFyIG1zZyA9IHRoaXMucXVldWUuc2hpZnQoKVxuICAgICAgICAgdmFyIGNsaWNrVG9DbG9zZSA9IEVOVi5jb25maWcobXNnLmNsaWNrVG9DbG9zZSx0aGlzLmNsaWNrVG9DbG9zZSlcblxuICAgICAgICAgaWYgKGNsaWNrVG9DbG9zZSkge1xuICAgICAgICAgICAgRU5WLm9uKHRoaXMuZWwsJ2NsaWNrJyx0aGlzLnJlbW92ZUV2ZW50KVxuICAgICAgICAgICAgRU5WLm9uKHRoaXMuZWwsJ3RvdWNoc3RhcnQnLHRoaXMucmVtb3ZlRXZlbnQpXG4gICAgICAgICB9XG5cbiAgICAgICAgIHZhciB0aW1lb3V0ID0gRU5WLmNvbmZpZyhtc2cudGltZW91dCx0aGlzLnRpbWVvdXQpXG5cbiAgICAgICAgIGlmICh0aW1lb3V0ID4gMClcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFRpbWVyID0gc2V0VGltZW91dChFTlYuYmluZCh0aGlzLl9hZnRlclRpbWVvdXQsdGhpcyksIHRpbWVvdXQpXG5cbiAgICAgICAgIGlmIChFTlYuaXNBcnJheShtc2cuaHRtbCkpIG1zZy5odG1sID0gJzx1bD48bGk+Jyttc2cuaHRtbC5qb2luKCc8bGk+JykrJzwvdWw+J1xuXG4gICAgICAgICB0aGlzLmVsLmlubmVySFRNTCA9IG1zZy5odG1sXG4gICAgICAgICB0aGlzLmN1cnJlbnRNc2cgPSBtc2dcbiAgICAgICAgIHRoaXMuZWwuY2xhc3NOYW1lID0gdGhpcy5iYXNlQ2xzXG4gICAgICAgICBpZiAoRU5WLnRyYW5zU3VwcG9ydCkge1xuICAgICAgICAgICAgdGhpcy5lbC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJ1xuICAgICAgICAgICAgc2V0VGltZW91dChFTlYuYmluZCh0aGlzLl9zaG93TXNnLHRoaXMpLDUwKVxuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Nob3dNc2coKVxuICAgICAgICAgfVxuXG4gICAgICB9LFxuICAgICAgX3NldE9wYWNpdHk6IGZ1bmN0aW9uIChvcGFjaXR5KSB7XG4gICAgICAgICBpZiAoRU5WLnVzZUZpbHRlcil7XG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICB0aGlzLmVsLmZpbHRlcnMuaXRlbSgnRFhJbWFnZVRyYW5zZm9ybS5NaWNyb3NvZnQuQWxwaGEnKS5PcGFjaXR5ID0gb3BhY2l0eSoxMDBcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKXt9XG4gICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5lbC5zdHlsZS5vcGFjaXR5ID0gU3RyaW5nKG9wYWNpdHkpXG4gICAgICAgICB9XG4gICAgICB9LFxuICAgICAgX3Nob3dNc2c6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgIHZhciBhZGRuQ2xzID0gRU5WLmNvbmZpZyh0aGlzLmN1cnJlbnRNc2cuYWRkbkNscyx0aGlzLmFkZG5DbHMpXG4gICAgICAgICBpZiAoRU5WLnRyYW5zU3VwcG9ydCkge1xuICAgICAgICAgICAgdGhpcy5lbC5jbGFzc05hbWUgPSB0aGlzLmJhc2VDbHMrJyAnK2FkZG5DbHMrJyAnK3RoaXMuYmFzZUNscysnLWFuaW1hdGUnXG4gICAgICAgICB9XG4gICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBvcGFjaXR5ID0gMFxuICAgICAgICAgICAgdGhpcy5lbC5jbGFzc05hbWUgPSB0aGlzLmJhc2VDbHMrJyAnK2FkZG5DbHMrJyAnK3RoaXMuYmFzZUNscysnLWpzLWFuaW1hdGUnXG4gICAgICAgICAgICB0aGlzLl9zZXRPcGFjaXR5KDApIC8vIHJlc2V0IHZhbHVlIHNvIGhvdmVyIHN0YXRlcyB3b3JrXG4gICAgICAgICAgICB0aGlzLmVsLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snXG5cbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICAgICAgdmFyIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgIGlmIChvcGFjaXR5IDwgMSkge1xuICAgICAgICAgICAgICAgICAgb3BhY2l0eSArPSAwLjFcbiAgICAgICAgICAgICAgICAgIGlmIChvcGFjaXR5ID4gMSkgb3BhY2l0eSA9IDFcbiAgICAgICAgICAgICAgICAgIHNlbGYuX3NldE9wYWNpdHkob3BhY2l0eSlcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIGVsc2UgY2xlYXJJbnRlcnZhbChpbnRlcnZhbClcbiAgICAgICAgICAgIH0sIDMwKVxuICAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF9oaWRlTXNnOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICB2YXIgYWRkbkNscyA9IEVOVi5jb25maWcodGhpcy5jdXJyZW50TXNnLmFkZG5DbHMsdGhpcy5hZGRuQ2xzKVxuICAgICAgICAgaWYgKEVOVi50cmFuc1N1cHBvcnQpIHtcbiAgICAgICAgICAgIHRoaXMuZWwuY2xhc3NOYW1lID0gdGhpcy5iYXNlQ2xzKycgJythZGRuQ2xzXG4gICAgICAgICAgICBFTlYub24odGhpcy5lbCxFTlYudmVuZG9yUHJlZml4ID8gRU5WLnZlbmRvclByZWZpeCsnVHJhbnNpdGlvbkVuZCcgOiAndHJhbnNpdGlvbmVuZCcsdGhpcy50cmFuc0V2ZW50KVxuICAgICAgICAgfVxuICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgb3BhY2l0eSA9IDFcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICAgICAgdmFyIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgIGlmKG9wYWNpdHkgPiAwKSB7XG4gICAgICAgICAgICAgICAgICBvcGFjaXR5IC09IDAuMVxuICAgICAgICAgICAgICAgICAgaWYgKG9wYWNpdHkgPCAwKSBvcGFjaXR5ID0gMFxuICAgICAgICAgICAgICAgICAgc2VsZi5fc2V0T3BhY2l0eShvcGFjaXR5KTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgc2VsZi5lbC5jbGFzc05hbWUgPSBzZWxmLmJhc2VDbHMrJyAnK2FkZG5DbHNcbiAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpXG4gICAgICAgICAgICAgICAgICBzZWxmLl9hZnRlckFuaW1hdGlvbigpXG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCAzMClcbiAgICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBfYWZ0ZXJBbmltYXRpb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgIGlmIChFTlYudHJhbnNTdXBwb3J0KSBFTlYub2ZmKHRoaXMuZWwsRU5WLnZlbmRvclByZWZpeCA/IEVOVi52ZW5kb3JQcmVmaXgrJ1RyYW5zaXRpb25FbmQnIDogJ3RyYW5zaXRpb25lbmQnLHRoaXMudHJhbnNFdmVudClcblxuICAgICAgICAgaWYgKHRoaXMuY3VycmVudE1zZy5jYikgdGhpcy5jdXJyZW50TXNnLmNiKClcbiAgICAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJ1xuXG4gICAgICAgICB0aGlzLl9hbmltYXRpbmcgPSBmYWxzZVxuICAgICAgICAgdGhpcy5fcnVuKClcbiAgICAgIH0sXG4gICAgICByZW1vdmU6IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICB2YXIgY2IgPSB0eXBlb2YgZSA9PSAnZnVuY3Rpb24nID8gZSA6IG51bGxcblxuICAgICAgICAgRU5WLm9mZihkb2MuYm9keSwnbW91c2Vtb3ZlJyx0aGlzLnJlbW92ZUV2ZW50KVxuICAgICAgICAgRU5WLm9mZihkb2MuYm9keSwnY2xpY2snLHRoaXMucmVtb3ZlRXZlbnQpXG4gICAgICAgICBFTlYub2ZmKGRvYy5ib2R5LCdrZXlwcmVzcycsdGhpcy5yZW1vdmVFdmVudClcbiAgICAgICAgIEVOVi5vZmYoZG9jLmJvZHksJ3RvdWNoc3RhcnQnLHRoaXMucmVtb3ZlRXZlbnQpXG4gICAgICAgICBFTlYub2ZmKHRoaXMuZWwsJ2NsaWNrJyx0aGlzLnJlbW92ZUV2ZW50KVxuICAgICAgICAgRU5WLm9mZih0aGlzLmVsLCd0b3VjaHN0YXJ0Jyx0aGlzLnJlbW92ZUV2ZW50KVxuICAgICAgICAgdGhpcy5yZW1vdmVFdmVudHNTZXQgPSBmYWxzZVxuXG4gICAgICAgICBpZiAoY2IgJiYgdGhpcy5jdXJyZW50TXNnKSB0aGlzLmN1cnJlbnRNc2cuY2IgPSBjYlxuICAgICAgICAgaWYgKHRoaXMuX2FuaW1hdGluZykgdGhpcy5faGlkZU1zZygpXG4gICAgICAgICBlbHNlIGlmIChjYikgY2IoKVxuICAgICAgfSxcbiAgICAgIGxvZzogZnVuY3Rpb24gKGh0bWwsIG8sIGNiLCBkZWZhdWx0cykge1xuICAgICAgICAgdmFyIG1zZyA9IHt9XG4gICAgICAgICBpZiAoZGVmYXVsdHMpXG4gICAgICAgICAgIGZvciAodmFyIG9wdCBpbiBkZWZhdWx0cylcbiAgICAgICAgICAgICAgIG1zZ1tvcHRdID0gZGVmYXVsdHNbb3B0XVxuXG4gICAgICAgICBpZiAodHlwZW9mIG8gPT0gJ2Z1bmN0aW9uJykgY2IgPSBvXG4gICAgICAgICBlbHNlIGlmIChvKVxuICAgICAgICAgICAgZm9yICh2YXIgb3B0IGluIG8pIG1zZ1tvcHRdID0gb1tvcHRdXG5cbiAgICAgICAgIG1zZy5odG1sID0gaHRtbFxuICAgICAgICAgaWYgKGNiKSBtc2cuY2IgPSBjYlxuICAgICAgICAgdGhpcy5xdWV1ZS5wdXNoKG1zZylcbiAgICAgICAgIHRoaXMuX3J1bigpXG4gICAgICAgICByZXR1cm4gdGhpc1xuICAgICAgfSxcbiAgICAgIHNwYXduOiBmdW5jdGlvbiAoZGVmYXVsdHMpIHtcbiAgICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChodG1sLCBvLCBjYikge1xuICAgICAgICAgICAgc2VsZi5sb2cuY2FsbChzZWxmLGh0bWwsbyxjYixkZWZhdWx0cylcbiAgICAgICAgICAgIHJldHVybiBzZWxmXG4gICAgICAgICB9XG4gICAgICB9LFxuICAgICAgY3JlYXRlOiBmdW5jdGlvbiAobykgeyByZXR1cm4gbmV3IEh1bWFuZShvKSB9XG4gICB9XG4gICByZXR1cm4gbmV3IEh1bWFuZSgpXG59KTtcbiIsIi8qXG4gKiBlZGl0b3ItdWkuanNcbiAqIGJyb3dzZXJpZnkgZW50cnkgcG9pbnQgZm9yIHB1Yi1wa2ctZWRpdG9yIHVzZXIgaW50ZXJmYWNlXG4gKlxuICogLSBkZXBlbmRzIG9uIGpxdWVyeVxuICogLSB1c2VzIGlmcmFtZSBjb250YWluaW5nIHdlYnNpdGUgbGF5b3V0IGZvciBwcmV2aWV3IHdpdGggMiBlZGl0aW5nIG1vZGVzXG4gKiAtIGVkaXQtbW9kZSBjYXB0dXJlcyBjbGlja3MgcHVyZWx5IGZvciBzZWxlY3RpbmcgYXJlYXMgb2YgY29udGVudCB0byBlZGl0XG4gKiAtIG5hdi1tb2RlIG1ha2VzIHRoZSBpZnJhbWUgd29yayBqdXN0IGxpa2UgYSBub3JtYWwgd2Vic2l0ZVxuICpcbiAqIGNvcHlyaWdodCAyMDE1LCBKdXJnZW4gTGVzY2huZXIgLSBnaXRodWIuY29tL2psZGVjIC0gTUlUIGxpY2Vuc2VcbiovXG5cbnZhciBodW1hbmUgPSByZXF1aXJlKCdodW1hbmUtanMnKS5jcmVhdGUoe3RpbWVvdXQ6NjAwfSk7XG5cbndpbmRvdy5vbkdlbmVyYXRvckxvYWRlZCA9IGZ1bmN0aW9uIGVkaXRvclVJKGdlbmVyYXRvcikge1xuXG4gIHZhciBvcHRzID0gZ2VuZXJhdG9yLm9wdHM7XG4gIHZhciB1ID0gZ2VuZXJhdG9yLnV0aWw7XG5cbiAgdmFyIGxvZyA9IG9wdHMubG9nO1xuXG4gIC8vIHZhciBvcmlnaW4gPSBsb2NhdGlvbi5ocmVmLnJlcGxhY2UoL14oLio/OlxcL1xcL1teXFwvXSspXFwvLiokLywnJDEnICsgJy9wdWInKVxuXG4gIHZhciAkb3V0ZXIgPSAkKCcub3V0ZXInKS5nZXQoMCk7IC8vIG91dGVybW9zdCBkaXYgLSBmb3Igd2lkdGggYW5kIGhlaWdodFxuXG4gIHZhciBlZGl0b3IgPVxuICAgIHsgJG5hbWU6ICAgJCgnLm5hbWUnKSwgICAgICAgICAgICAvLyBqcXVlcnkgbmFtZSBhcmVhIGluIGhlYWRlclxuICAgICAgJGVkaXQ6ICAgJCgndGV4dGFyZWEuZWRpdG9yJyksICAvLyBqcXVlcnkgZWRpdG9yIHRleHRhcmVhXG4gICAgICAkc2F2ZTogICAkKCcuc2F2ZWJ1dHRvbicpLCAgICAgIC8vIGpxdWVyeSBzYXZlIGJ1dHRvblxuXG4gICAgICAvLyBiaW5kaW5nIGlzIHRoZSBfaHJlZiBvZiBmcmFnbWVudCBiZWluZyBlZGl0ZWRcbiAgICAgIC8vIE5PVEU6IGRvbid0IGJpbmQgYnkgcmVmISByZWNvbXBpbGUgaW52YWxpZGF0ZXMgcmVmc1xuICAgICAgYmluZGluZzogJycgfTtcblxuICB2YXIgJHByZXZpZXcgPSAkKCdpZnJhbWUucHJldmlldycpOyAvLyBqcXVlcnkgcHJldmlldyBpZnJhbWVcbiAgdmFyIGlmcmFtZSA9ICRwcmV2aWV3LmdldCgwKTsgICAgICAgLy8gcHJldmlldyBpZnJhbWVcblxuICB2YXIgaXNMZWZ0UmlnaHQgPSB0cnVlO1xuICB2YXIgZWRpdG9yU2l6ZTsgLy8gc2V0IGluIHJlc2l6ZUVkaXRvclxuXG4gIHZhciBERFBBTkUgPSAncGFuZS1oYW5kbGUtZHJhZyc7IC8vIGN1c3RvbSBkcmFnIGV2ZW50IHR5cGUgZm9yIHBhbmUgaGFuZGxlc1xuXG4gIHZhciAkY3NzLCBwd2luZG93OyAvLyBzZXQgaW4gcHJldmlld09uTG9hZFxuXG4gIC8vIGlmcmFtZSBuYXZpZ2F0aW9uIGFuZCB3aW5kb3cgYmFja2J1dHRvbiBoYW5kbGVycyAtIHVzZSBwb2xsaW5nIGluc3RlYWQgb2Ygb25sb2FkXG4gIC8vIGlmcmFtZS5vbmxvYWQgPSBwcmV2aWV3T25Mb2FkO1xuICB2YXIgcHJldmlld1BvbGxlciA9IHNldEludGVydmFsKHByZXZpZXdPbkxvYWQsIDE1MCk7XG5cbiAgLy8gbmF2aWdhdGlvbiBoYW5kbGVyIC0gbmF2IGV2ZW50cyBlbWl0dGVkIGJ5IHBhZ2VyIGluIHB1Yi1wcmV2aWV3LmpzXG4gIC8vIG5vdGU6IGZyYWdtZW50cyBhcmUgc2VsZWN0ZWQgdmlhIGZyYWdtZW50Q2xpY2sgaW4gcHJldmlldyBzZWxlY3Rpb24gbW9kZVxuICBnZW5lcmF0b3Iub24oJ25hdicsIGhhbmRsZU5hdik7XG4gIGdlbmVyYXRvci5vbignbG9hZGVkJywgaGFuZGxlTmF2KTtcbiAgZ2VuZXJhdG9yLm9uKCdub3RpZnknLCBmdW5jdGlvbihzKSB7IGxvZyhzKTsgaHVtYW5lLmxvZyhzKTsgfSk7XG5cbiAgdmFyIG9uSU9TID0gL2lQYWR8aVBob25lL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcbiAgJCh3aW5kb3cpLm9uKG9uSU9TID8gXCJwYWdlaGlkZVwiIDogXCJiZWZvcmV1bmxvYWRcIiwgZnVuY3Rpb24oKSB7XG4gICAgbG9nKCdiZWZvcmV1bmxvYWQnKVxuICAgIGdlbmVyYXRvci5jbGllbnRTYXZlSG9sZFRleHQoKTtcbiAgICBnZW5lcmF0b3IuY2xpZW50U2F2ZVVuVGhyb3R0bGVkKCk7IC8vIHRocm90dGxlZCB2ZXJzaW9uIG1heSBkbyBub3RoaW5nXG4gIH0pO1xuXG4gICQoJy5lZGl0YnV0dG9uJykuY2xpY2sodG9nZ2xlRnJhZ21lbnRzKTtcblxuICAvLyBzaG93IHNhdmUgYnV0dG9uIG9uIHRoZSBzdGF0aWMgaG9zdFxuICBpZiAob3B0cy5zdGF0aWNIb3N0KSB7XG4gICAgJCgnLnNhdmVidXR0b24nKS5yZW1vdmVDbGFzcygnaGlkZScpLmNsaWNrKGdlbmVyYXRvci5jbGllbnRTYXZlKTtcbiAgfVxuXG4gIC8qIGRpc2FibGVkIG1lbnUgbGlua3NcbiAgLy8gZWl0aGVyIGRvIHNpbmdsZSBhY3Rpb24gaW4gZWRpdG9yIG9yIHNob3cgaWZyYW1lIGUuZyBmb3IgdXBsb2FkXG5cbiAgJCgnLnBhbmVidXR0b24nKS5jbGljayh0b2dnbGVQYW5lcyk7XG4gICQoJy5tZW51YnV0dG9uJykuY2xpY2sodG9nZ2xlRm9ybSk7XG4gICQoJy5uYW1lJykuY2xpY2socmV2ZXJ0RWRpdHMpO1xuICAkKCcuaGVscGJ1dHRvbicpLmNsaWNrKGhlbHApO1xuXG4gICovXG5cbiAgLy8gaW5pdGlhbGl6ZSBkcmFnIHRvIGFkanVzdCBwYW5lcyAtIHVzZSBUZXh0IGZvciB0eXBlIHRvIHNhdGlzZnkgSUVcbiAgJCgnLmhhbmRsZScpLmF0dHIoJ2RyYWdnYWJsZScsICd0cnVlJykuZ2V0KDApXG4gICAgLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGUuZGF0YVRyYW5zZmVyLnNldERhdGEoJ1RleHQnLCBERFBBTkUpO1xuICAgIH0pO1xuXG4gIC8vIGhhbmRsZSBwYW5lIGFkanVzdCBldmVudCBvdmVyIGVkaXRvclxuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIGZ1bmN0aW9uKGUpIHtcbiAgICBhZGp1c3RQYW5lcyhlLmNsaWVudFgsIGUuY2xpZW50WSwgZmFsc2UpOyAvLyBoYW5kbGUgb3ZlciBlZGl0b3JcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH0pO1xuXG4gIC8vIGhhbmRsZSBwYW5lIGFkanVzdGVyIGRyb3AgZXZlbnRcbiAgLy8gKGZpcmVmb3ggd2lsbCB0cnkgdG8gbmF2aWdhdGUgdG8gdGhlIHVybCBpZiB0ZXh0IGlzIGRyb3BwZWQgb24gaXQpXG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBmdW5jdGlvbihlKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH0pO1xuXG4gIC8vIHJlc3RvcmUgcGFuZSBkaW1lbnNpb25zXG4gIHJlc2l6ZUVkaXRvcigtMSk7XG5cbiAgLy8gcHJldmlldyBpZnJhbWUgb25sb2FkIGhhbmRsZXIgLSBpbml0aWFsaXplcyBwd2luZG93IGFuZCAkY3NzXG4gIGZ1bmN0aW9uIHByZXZpZXdPbkxvYWQoKSB7XG4gICAgcHdpbmRvdyA9IGlmcmFtZS5jb250ZW50V2luZG93O1xuICAgIHZhciBwJCA9IHB3aW5kb3cgJiYgcHdpbmRvdy4kOyAgICAgICAgLy8gcHJldmlldyBqcXVlcnkgb2JqZWN0XG4gICAgaWYgKCFwJCB8fCBwJC5lZGl0b3JMb2FkZWQpIHJldHVybjsgICAvLyBub3QgcmVhZHkgfHwgYWxyZWFkeSBpbml0aWFsaXplZFxuXG4gICAgdmFyIHBkb2MgPSBwd2luZG93LmRvY3VtZW50O1xuXG4gICAgLy8gaGFuZGxlIHBhbmUgYWRqdXN0IGV2ZW50IG92ZXIgcHJldmlld1xuICAgIHBkb2MuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCBmdW5jdGlvbihlKSB7XG4gICAgICBhZGp1c3RQYW5lcyhlLmNsaWVudFgsIGUuY2xpZW50WSwgdHJ1ZSk7IC8vIGhhbmRsZSBvdmVyIHByZXZpZXdcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcblxuICAgIC8vIGhhbmRsZSBwYW5lIGFkanVzdGVyIGRyb3AgZXZlbnQgb3ZlciBwcmV2aWV3XG4gICAgLy8gKGZpcmVmb3ggd2lsbCB0cnkgdG8gbmF2aWdhdGUgdG8gdGhlIHVybCBpZiB0ZXh0IGlzIGRyb3BwZWQgb24gaXQpXG4gICAgcGRvYy5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZnVuY3Rpb24oZSkge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0pO1xuXG4gICAgcFJlZiA9IHB3aW5kb3cucHViUmVmIHx8IHt9O1xuICAgIHZhciByZWxQYXRoID0gcFJlZi5yZWxQYXRoIHx8ICcnO1xuXG4gICAgJGNzcyA9IHAkKCc8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgaHJlZj1cIicgKyByZWxQYXRoICsgJy9wdWIvY3NzL3B1Yi1wcmV2aWV3LmNzc1wiPicpO1xuICAgIHAkKCdoZWFkJykuYXBwZW5kKCRjc3MpO1xuICAgICRjc3MuZ2V0KDApLmRpc2FibGVkID0gdHJ1ZTtcbiAgICB0b2dnbGVGcmFnbWVudHMoKTtcblxuICAgIHZhciAkc2NyaXB0ID0gcCQoJzxzY3JpcHQgc3JjPVwiJyArIHJlbFBhdGggKyAnL3B1Yi9qcy9wdWItcHJldmlldy5qc1wiPjwvc2NyaXB0PicpO1xuICAgIHAkKCdib2R5JykuYXBwZW5kKCRzY3JpcHQpO1xuXG4gICAgcCQuZWRpdG9yTG9hZGVkID0gdHJ1ZTtcbiAgICBjbGVhckludGVydmFsKHByZXZpZXdQb2xsZXIpO1xuICB9O1xuXG4gIGZ1bmN0aW9uIHRvZ2dsZUZyYWdtZW50cygpIHtcbiAgICB2YXIgY3NzID0gJGNzcyAmJiAkY3NzLmdldCgwKTtcbiAgICBpZiAoIWNzcykgcmV0dXJuO1xuICAgIGlmIChjc3MuZGlzYWJsZWQpIHtcbiAgICAgIGNzcy5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgcHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZyYWdtZW50Q2xpY2ssIHRydWUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGNzcy5kaXNhYmxlZCA9IHRydWU7XG4gICAgICBwd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnJhZ21lbnRDbGljaywgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gZnJhZ21lbnQgY2xpY2sgaGFuZGxlclxuICBmdW5jdGlvbiBmcmFnbWVudENsaWNrKGUpIHtcbiAgICB2YXIgZWwgPSBlLnRhcmdldDtcbiAgICB2YXIgaHJlZjtcbiAgICB3aGlsZSAoZWwgJiYgZWwubm9kZU5hbWUgIT09ICdIVE1MJyAmJiAhZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXJlbmRlci1odG1sJykpIHsgZWwgPSBlbC5wYXJlbnROb2RlIH07XG4gICAgaWYgKGVsICYmIChocmVmID0gZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXJlbmRlci1odG1sJykpKSB7XG4gICAgICBiaW5kRWRpdG9yKGdlbmVyYXRvci5mcmFnbWVudCRbaHJlZl0pO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyB3aWxsIGFsc28gc3RvcCBwYWdlciBiZWNhdXNlIGl0IGNoZWNrcyBmb3IgZS5kZWZhdWx0UHJldmVudGVkXG4gICAgfVxuICB9XG5cbiAgLy8gbmF2aWdhdGlvbiBoYW5kbGVyXG4gIGZ1bmN0aW9uIGhhbmRsZU5hdihwYXRoLCBxdWVyeSwgaGFzaCkge1xuICAgIGlmIChwYXRoKSB7XG4gICAgICAvLyByZXBsYWNlIC9wdWIvcGF0aC4uLiB3aXRoIC9wYXRoLi4uXG4gICAgICAvLyBoaXN0b3J5LnJlcGxhY2VTdGF0ZShudWxsLCBudWxsLCBvcmlnaW4gKyBwYXRoICsgcXVlcnkgKyBoYXNoKTtcbiAgICAgIGJpbmRFZGl0b3IoZ2VuZXJhdG9yLmZyYWdtZW50JFtwYXRoICsgaGFzaF0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIHJlbG9hZFxuICAgICAgYmluZEVkaXRvcihnZW5lcmF0b3IuZnJhZ21lbnQkW2VkaXRvci5iaW5kaW5nXSk7XG4gICAgfVxuICB9XG5cbiAgLy8gY2hhbmdlIGVkaXRpbmdIcmVmIHRvIGEgZGlmZmVyZW50IGZyYWdtZW50IG9yIHBhZ2VcbiAgZnVuY3Rpb24gYmluZEVkaXRvcihmcmFnbWVudCkge1xuICAgIHNhdmVCcmVha0hvbGQoKTtcbiAgICBpZiAoZnJhZ21lbnQpIHtcbiAgICAgIGVkaXRvci4kbmFtZS50ZXh0KGZyYWdtZW50Ll9ocmVmKTtcbiAgICAgIGlmIChmcmFnbWVudC5faG9sZFVwZGF0ZXMpIHtcbiAgICAgICAgZWRpdFRleHQoZnJhZ21lbnQuX2hvbGRUZXh0KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBlZGl0VGV4dChmcmFnbWVudC5faGRyICsgZnJhZ21lbnQuX3R4dCk7XG4gICAgICB9XG4gICAgICBlZGl0b3IuYmluZGluZyA9IGZyYWdtZW50Ll9ocmVmO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGVkaXRvci4kbmFtZS50ZXh0KCcnKTtcbiAgICAgIGVkaXRUZXh0KCcnKTtcbiAgICAgIGVkaXRvci5iaW5kaW5nID0gJyc7XG4gICAgfVxuICB9XG5cbiAgLy8gcmVwbGFjZSB0ZXh0IGluIGVkaXRvciB1c2luZyBjbG9uZSgpXG4gIC8vIGZpcmVmb3ggZ290Y2hhOiB1bmRvIGtleSBtdXRhdGVzIGNvbnRlbnQgYWZ0ZXIgbmF2LXRyaWdnZXJlZCAkZWRpdC52YWwoKVxuICAvLyBhc3N1bWUgdGhhdCBqcXVlcnkgdGFrZXMgY2FyZSBvZiByZW1vdmluZyBrZXl1cCBoYW5kbGVyXG4gIGZ1bmN0aW9uIGVkaXRUZXh0KHRleHQpIHtcbiAgICB2YXIgJG5ld2VkaXQgPSBlZGl0b3IuJGVkaXQuY2xvbmUoKS52YWwodGV4dCk7XG4gICAgZWRpdG9yLiRlZGl0LnJlcGxhY2VXaXRoKCRuZXdlZGl0KTtcbiAgICBlZGl0b3IuJGVkaXQgPSAkbmV3ZWRpdDtcbiAgICBlZGl0b3IuJGVkaXQub24oJ2tleXVwJywgZWRpdG9yVXBkYXRlKTtcbiAgfVxuXG4gIC8vIHJlZ2lzdGVyIHVwZGF0ZXMgZnJvbSBlZGl0b3IgdXNpbmcgZWRpdG9yLmJpbmRpbmdcbiAgZnVuY3Rpb24gZWRpdG9yVXBkYXRlKCkge1xuICAgIGlmIChlZGl0b3IuYmluZGluZykge1xuICAgICAgaWYgKCdob2xkJyA9PT0gZ2VuZXJhdG9yLmNsaWVudFVwZGF0ZUZyYWdtZW50VGV4dChlZGl0b3IuYmluZGluZywgZWRpdG9yLiRlZGl0LnZhbCgpKSkge1xuICAgICAgICBlZGl0b3IuaG9sZGluZyA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gc2F2ZSB3aXRoIGJyZWFrSG9sZCAtIG1heSByZXN1bHQgaW4gbW9kaWZpZWQgaHJlZiA9PT4gbG9zcyBvZiBiaW5kaW5nIGNvbnRleHQ/XG4gIGZ1bmN0aW9uIHNhdmVCcmVha0hvbGQoKSB7XG4gICAgaWYgKGVkaXRvci5iaW5kaW5nICYmIGVkaXRvci5ob2xkaW5nKSB7XG4gICAgICBnZW5lcmF0b3IuY2xpZW50VXBkYXRlRnJhZ21lbnRUZXh0KGVkaXRvci5iaW5kaW5nLCBlZGl0b3IuJGVkaXQudmFsKCksIHRydWUpO1xuICAgICAgZWRpdG9yLmhvbGRpbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyB0b2dnbGUgcGFuZXMgYmV0d2VlbiBsZWZ0L3JpZ2h0IGFuZCB0b3AvYm90dG9tXG4gIGZ1bmN0aW9uIHRvZ2dsZVBhbmVzKCkge1xuICAgICQoJy5lZGl0b3JwYW5lJykudG9nZ2xlQ2xhc3MoJ3JvdyBjb2wgbGVmdCB0b3AnKTtcbiAgICAkKCcucHJldmlld3BhbmUnKS50b2dnbGVDbGFzcygncm93IGNvbCByaWdodCBib3R0b20nKTtcbiAgICBpc0xlZnRSaWdodCA9ICQoJy5oYW5kbGUnKS50b2dnbGVDbGFzcygnbGVmdHJpZ2h0IHRvcGJvdHRvbScpLmhhc0NsYXNzKCdsZWZ0cmlnaHQnKTtcbiAgICByZXNpemVFZGl0b3IoLTEpO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9nZ2xlRm9ybSgpIHtcbiAgICAkKCcuZm9ybScpLnRvZ2dsZSgpO1xuICAgICQoJy5lZGl0b3InKS50b2dnbGVDbGFzcygnc2hvd2Zvcm0nKTtcbiAgfVxuXG4gIC8vIGRyYWdnYWJsZSBwYW5lIGFkanVzdGVyXG4gIC8vIHggYW5kIHkgY29tZSBmcm9tIHRoZSBtb3VzZSBlaXRoZXIgb3ZlciB0aGUgcHJldmlldyBvciB0aGUgZWRpdG9yXG4gIC8vIHByZXZpZXcgY29vcmRpbmF0ZXMgc3RhcnQgYXQgdGhlIHNlcGFyYXRvciAoPT0+IGVkaXRvclNpemUgKyByYXRpbylcbiAgLy8gYWxsb3cgMjUgcGl4ZWxzIGZvciB0aGUgaGVhZGVyIChzaG91bGQgYmUgcmVhZCBmcm9tIGVsZW1lbnQpXG4gIGZ1bmN0aW9uIGFkanVzdFBhbmVzKHgsIHksIG92ZXJQcmV2aWV3KSB7XG4gICAgdmFyIHJhdGlvID0gaXNMZWZ0UmlnaHQgP1xuICAgICAgICAoeCAvICRvdXRlci5jbGllbnRXaWR0aCkgOlxuICAgICAgICAoKG92ZXJQcmV2aWV3ID8geSA6IHkgLSAyNSkgLyAoJG91dGVyLmNsaWVudEhlaWdodCAtIDI1KSk7XG4gICAgdmFyIHBzaXplID0gb3ZlclByZXZpZXcgPyBlZGl0b3JTaXplICsgcmF0aW8gKiAxMDAgOiByYXRpbyAqIDEwMDtcbiAgICBpZiAocHNpemUgPj0gMCkgeyByZXNpemVFZGl0b3IocHNpemUpOyB9XG4gIH1cblxuICAvLyBhZGp1c3QgZWRpdG9yIHdpbmRvdyBzaXplIGJldHdlZW4gMCBhbmQgMTAwJVxuICAvLyAgMCBtZWFucyBoaWRlXG4gIC8vIC0xIG1lYW5zIHJlc3RvcmUgbGFzdCBzZXR0aW5nIChvciA1MCUpXG4gIGZ1bmN0aW9uIHJlc2l6ZUVkaXRvcihwc2l6ZSkge1xuICAgIHZhciBmb3JjZSA9IGZhbHNlO1xuICAgIGlmIChwc2l6ZSA9PT0gLTEpIHtcbiAgICAgIGZvcmNlID0gdHJ1ZTtcbiAgICAgIHBzaXplID0gbWF4KDEwLCBlZGl0b3JTaXplIHx8IE51bWJlcihsb2NhbFN0b3JhZ2UuZWRpdG9yU2l6ZSkgfHwgNTApO1xuICAgIH0gZWxzZSB7XG4gICAgICBwc2l6ZSA9IHBzaXplICUgMTAwO1xuICAgIH1cbiAgICBpZiAoZm9yY2UgfHwgZWRpdG9yU2l6ZSAhPT0gcHNpemUpIHtcbiAgICAgIGlmIChwc2l6ZSkgeyBsb2NhbFN0b3JhZ2UuZWRpdG9yU2l6ZSA9IGVkaXRvclNpemUgPSBwc2l6ZTsgfSAvLyBkb24ndCByZW1lbWJlciAwXG4gICAgICBpZiAoaXNMZWZ0UmlnaHQpIHtcbiAgICAgICAgJCgnLmxlZnQuY29sJykuY3NzKCAgeyB3aWR0aDogIHBzaXplICsgJyUnLCBoZWlnaHQ6ICcxMDAlJyB9KTtcbiAgICAgICAgJCgnLnJpZ2h0LmNvbCcpLmNzcyggeyB3aWR0aDogICgxMDAgLSBwc2l6ZSkgKyAnJScsIGhlaWdodDogJzEwMCUnIH0pO1xuICAgICAgICAkKCcuaGFuZGxlJykuY3NzKCB7IGxlZnQ6IHBzaXplICsgJyUnLCB0b3A6ICcwJyB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICQoJy50b3Aucm93JykuY3NzKCAgIHsgaGVpZ2h0OiBwc2l6ZSArICclJywgd2lkdGg6ICAnMTAwJScgfSk7XG4gICAgICAgICQoJy5ib3R0b20ucm93JykuY3NzKHsgaGVpZ2h0OiAxMDAgLSBwc2l6ZSArICclJywgd2lkdGg6ICAnMTAwJScgfSk7XG4gICAgICAgICQoJy5oYW5kbGUnKS5jc3MoIHsgbGVmdDogJzAnLCB0b3A6ICgocHNpemUgLyAxMDAgKiAoJG91dGVyLmNsaWVudEhlaWdodCAtIDI1KSkgKyAyNSkgKyAncHgnIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1heCh4LHkpIHsgcmV0dXJuIHg+eSA/IHggOiB5OyB9XG5cbn1cbiJdfQ==
