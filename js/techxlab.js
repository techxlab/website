$(function() {

// search state
var lastSearch = '';
var cleanSearch = function(){};

// global forms state;
var cleanForms = function(){};

// generator api
var pager, generator, log, u;

// provide opts.staticRoot and location.origin also for forms in non-SPA mode
var opts = {};
opts.staticRoot = location.pathname.slice(0, location.pathname.length - pubRef.href.length);

// http://tosbourn.com/a-fix-for-window-location-origin-in-internet-explorer/
if (!location.origin) { location.origin = location.protocol + "//" + location.hostname + (location.port ? ':' + location.port: ''); }

// load generator on browsers that are up to it
if (history && history.pushState) {
  $.getScript(pubRef.relPath + '/pub/_generator.js');
  window.onGeneratorLoaded = initClientSide;
}

// initialize contact and other form handlers (both SPA and non-SPA modes)
initForms();
initScrollmon();

// start SPA mode
function initClientSide(g) {
  generator = g;
  opts = generator.opts;
  log = opts.log;
  u = generator.util;
  u.set(generator, 'req.query', u.parseUrlParams(location.search));

  // initialize SPA events
  pager = generator.initPager();
  generator.on('nav', function() { $('html,body').scrollTop(0); });
  generator.on('before-update-view', cleanAllViews);
  generator.on('after-update-view', initAllViews);

  // force reload after server save
  generator.on('notify', function(msg) {
    if (msg === 'save') {
      log('server save. reloading! (disable watcher with `pub -K`)');
      location.reload();
    }
  });

  // initSearch on this page (TODO: review - not necessary unless req.query.q)
  initSearch();
}

// remove all event handlers
function cleanAllViews($el) {
  cleanSearch();
  cleanForms();
  cleanScrollmon();
}

// initialize all event handlers
function initAllViews($el) {
  initSearch();
  initForms();
  initScrollmon();
}

function initForms() {
  $forms = $('#contact-form, #add-solution-form');
  if (!$forms.length) return;

  $forms.on('submit', validateForm);

  cleanForms = function() {
    $forms.off('submit', validateForm);
  }

  function validateForm() {
    console.log('validateForm: ' + $('#form').val());
    $('#location').val(location.origin + opts.staticRoot);
    $('#validated').val('jawohl!');
  }
}

// init client-side search if this is a search page
function initSearch() {

  // search UI
  var $search = $('#search');
  if (!$search.length) return;

  var $clear = $('#search-clear');
  var $results = $('#search-results');

  // event handlers on
  $search.on('search', searchInput); // chrome X button
  $search.on('focus',  searchInput);
  $search.on('keyup',  searchInput);
  $clear.on('click',   searchClear);

  // event handlers off
  cleanSearch = function() {
    $search.off('search', searchInput);
    $search.off('focus',  searchInput);
    $search.off('keyup',  searchInput);
    $clear.off('click',   searchClear);
    cleanSearch = u.noop; // call once
  }

  // support urls with q param, preserve search input value
  var query = u.get(generator, 'req.query.q', lastSearch);
  if (query) {
    search(query);
  }

  function searchInput(evt) {
    var txt = $search.val();
    if (txt === lastSearch) return;
    search(txt);
  }

  function searchClear(evt) {
    search('');
  }

  function search(txt) {
    lastSearch = txt;
    $search.val(txt);

    u.set(generator, 'req.query.q', txt);
    cleanScrollmon();
    $results.html(generator.renderTemplate(pager.page, 'partial/result'));
    initScrollmon();
  }
}

function initScrollmon() {
  $('.scrollmon').each(function() {
    var $el = $(this);
    var src = $el.data('src');
    var watcher = scrollMonitor.create(this, 500);
    watcher.enterViewport(function() {
      $el.attr('src',src);
      watcher.destroy();
    });
  });
}

function cleanScrollmon() {
  scrollMonitor.destroyAll();
}


}) // $(function() {
