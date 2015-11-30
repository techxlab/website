$(function() {

// search state
var lastSearch = '';
var cleanSearch = function(){};

// global forms state;
var cleanForms = function(){};

// generator api
var pager, generator, opts, log, u;

// load generator on browsers that are up to it
if (history && history.pushState) {
  $.getScript(pubRef.relPath + '/pub/_generator.js');
  window.onGeneratorLoaded = initClientSide;
}

// initialize contact and other form handlers (both SPA and non-SPA modes)
initForms();

// start single-page-app
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
}

// initialize all event handlers
function initAllViews($el) {
  initSearch();
  initForms();
}

function initForms() {
  $contactForm = $('#contact-form');

  $contactForm.on('submit', validateContactForm);

  cleanForms = function() {
    $contactForm.off('submit', validateContactForm);
  }

  function validateContactForm() {
    console.log('validateContactForm');
    $('#location').val(location);
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
    $results.html(generator.renderTemplate(pager.page, 'partial/result'));
  }
}

}) // $(function() {
