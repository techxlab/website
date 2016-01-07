$(function() {

// global forms state;
var cleanForms = function(){};

// provide opts.staticRoot and location.origin also for forms
var opts = {};
opts.staticRoot = location.pathname.slice(0, location.pathname.length - pubRef.href.length);

// http://tosbourn.com/a-fix-for-window-location-origin-in-internet-explorer/
if (!location.origin) { location.origin = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port: ''); }

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


}) // $(function() {
