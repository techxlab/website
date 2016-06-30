$(function() {

// global forms state;
var cleanForms = function(){};

// provide opts.staticRoot and location.origin also for forms
var opts = {};
opts.staticRoot = location.pathname.slice(0, location.pathname.length - pubRef.href.length);

// http://tosbourn.com/a-fix-for-window-location-origin-in-internet-explorer/
if (!location.origin) { location.origin = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port: ''); }

var page; // page data

$.getJSON('/search.json', function(data) {
  page = data;
  initSearch();
});

// initialize contact and other form handlers (both SPA and non-SPA modes)
initForms();
initScrollmon();

function initForms() {
  $forms = $('#contact-form, #get-started-form, #add-solution-form, #sign-up-form');
  if (!$forms.length) return;
  $('#location').val(location.origin + opts.staticRoot);

  $forms.on('submit', validateForm);

  cleanForms = function() {
    $forms.off('submit', validateForm);
  }

  var revalidatingOnChange = false;

  function validateForm(evt) {
    var $form = $(this);
    var vals = formValues();

    if (!checkRequired($form, vals) || !confirmSame($form, vals)) {
      if (!revalidatingOnChange) {
        $form.on('change', validateForm);
        revalidatingOnChange = true;
      }
      $('#validated').val('');
      evt.preventDefault();
    }
    else {
      $('#validated').val('jawohl!');
    }

    // collect field values (only one per name!) into object o
    function formValues() {
      var o = {};
      $.each($form.serializeArray(), function(idx, v){ o[v.name] = v.value; });
      return o;
    }
  }
}

// make sure pw and confirm pw values are the same
function confirmSame($form, values) {
  if (('Password' in values) && (values['Password'] != values['Confirm password'])) {
    $('[for=password]').addClass('mismatched');
    return false;
  }
  else {
    $('[for=password]').removeClass('mismatched');
    return true;
  }
}

// set/remove .missing class on required fields, return false if any missing
function checkRequired($form, values) {
  var sel = 'input[required], select[required], textarea[required]';
  var msgs = [];

  $form.find(sel).each(function() {
    var $fld = $(this);
    if (! $fld.is(':disabled')) {
      var name = $fld.attr('name');
      var missing = !values[name];
      var id = $fld.attr('id');
      var label = $('[for='+id+']:visible');
      if (missing) {
        label.addClass('missing');
        msgs.push(name);
      }
      else { label.removeClass('missing'); }
    }
  });
  if (msgs.length) {
    $('.form-error').text(msgs.join('\n')).show();
    return false;
  } else {
    $('.form-error').hide();
    return true;
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

// Initialize Search

function initSearch() {

// template external to searchpages() to avoid recompiles
var renderSearchItem = _.template('<li class="searchitem <%=page.template%>"><a class="page" href=<%=page._href%> ' +
                   'title="<%=page.name%>"><%=page.name%></a></li>');

var searchList = {
  $field: $('#q'),
  $list: $('#q-list'),
  length: 0,
  nohide: false,
  q: ''
}

var searchInput = $('#q');

// search takes over keyboard
$(window).keydown(function(evt) {
  if (evt.metaKey || evt.altKey || evt.ctrlKey  || evt.target == searchInput) return true;
  if ($(document.activeElement).parents('form').length) return true;
  var k = evt.keyCode;
  if ((k >= 65 && k <= 90) || k === 189 || k === 190) { searchInput.focus(); } // a-z . _
  return true;
})

searchInput
  .keydown(searchListNav)
  .keyup(searchpages)
  .blur(searchListHide)
  .focus(searchListShow)
  .on('search', searchpages);

// prevent blur(searchListHide) when clicking search list
$('#q-list')
  .mousedown(function() { return searchList.noHide = true; })
  .click(function(evt) { return searchListSelect(evt); });

// keydown events navigate search UI
function searchListNav(evt) {
  if (evt.shiftKey || evt.metaKey || evt.altKey || evt.ctrlKey) return true;
  switch(evt.keyCode) {
    case 27: // esc
    case 9:  // tab
      return searchListHide(evt);
    case 37: // left
    case 38: // up
    case 39: // right
    case 40: // down
      return searchListMove(evt, evt.keyCode < 39, evt.keyCode % 2);
    case 13: // enter
      return searchListSelect(evt);
  }
}

function searchListSelect(evt) {
  if (!searchList.length) return false; // prevent normal browser form submit

  var href = $(evt && evt.target).attr('href') || // click on link
             $('.searchitem.selected a').attr('href') || // enter key with selection
             $('.searchitem a').first().attr('href'); // enter key no selection
    window.location.href = href;
    return false;
}

function searchListHide(evt, searching) {
  if (searchList.noHide) {
    searchList.noHide = false;
    return true;
  }
  // blur (non-search) events hide Reg search control

  searchList.$list.removeClass('show');
  return false; // necessary for chrome
}

function searchListShow() {
  if (searchList.length) {
    searchList.$list.addClass('show');
  }
  return true;
}

function searchListMove(evt, direction, hmove) {
  if (!searchList.length) return true;

  var $newsel = moveSelection('.searchitem', direction, searchList.$list);
  if (!$newsel.length) return true;

  return false;
}

// moves .selected class to next/prev sibling in or first/last child of $list
// all params optional
function moveSelection(selector, direction, $list, wraparound) {

  selector = selector || '';
  var $selection = $(selector + '.selected', $list);
  var $to = direction ? $selection.prev(selector) : $selection.next(selector);
  if (!$to.length) {
    // try jumping over one sibling (e.g. for connected link annotations)
    $to = direction ? $selection.prev().prev(selector) : $selection.next().next(selector);
  }

  if (!$to.length && $list && (wraparound || !$selection.length)) {
    $to = direction
      ? $list.children(selector).last()
      : $list.children(selector).first()
  }

  if ($to.length) {
    $(selector + '.selected').removeClass('selected');
    $to.addClass('selected').get(0).scrollIntoView(false);
  }

  return $to;
}

// search keyup events refresh search results
function searchpages(evt) {
  var q = searchList.$field.val();
  if (q === searchList.q) return true;
  searchList.q = q;
  var pages = q ? greppages(page, q) : [];

  searchList.$list
    .html(_.map(pages, function(page) {
       return renderSearchItem
        ({
         page: page
        });
      }).join(''));

  searchList.length = pages.length;
  if (!pages.length) return searchListHide(evt, true);
  searchListShow();
  return true;
}

}   // end initSearch()

function greppages(data, q) {
  var re = grep(q);
  return _.filter(data, function(page) {
    return re.test(page._href + ' ' +page.name + page.tags + page.category + page._txt);
  });
}

// escape regexp special characters
function escapeRegExp(s) {
  return str(s).replace(/[\\^$.*+?|{[()]/g, "\\$&");
};

// search for 1 or more words (must match all words in order)
function grep(s) {
  return new RegExp(_.map(str(s).split(/\s/), escapeRegExp).join('.*'), "i")
}
// fast coerce to string - careful with 0
function str(s) { return s ? ''+s : ''; }

}) // $(function() {
