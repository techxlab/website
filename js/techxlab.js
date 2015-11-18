$(function() {

// global list of filterable solution elements
var $solutions = $('.solution-list-box');
var $count = $('#count');
$count.text($solutions.length);

// highlight active category
$('.searchcategory[href="' + location.pathname + '"]').addClass('active');

// enable tag click handler and highlight active tag
var allTag = $('.searchtag').click(clickTag).first().addClass('active').get(0);
var activeTag = allTag;

// search state
var $search = $('#search');
var $clear = $('#search-clear');
var lastsearch = '';

// search events
$search.on('focus', searchInput);
$search.on('keyup', searchInput);
$clear.click(function() { searchTag($(activeTag)); });

//--//--//--//--//--//--//--//--//--//--//--//--//--//--//--//--//--//--//--//--

function clickTag(evt) { searchTag($(this)); }

function searchTag($el) {
  $(allTag).removeClass('active'); $search.val(''); // clear search
  $(activeTag).removeClass('active');               // clear old tag
  activeTag = $el.addClass('active').get(0);        // set and show new tag
  var tag = $el.text();
  if (activeTag === allTag) return filterByText('');
  filterByText(tag);
}

// search input event handler
function searchInput(evt) {
  var txt = $search.val();
  if (txt === lastsearch) return;
  $(activeTag).removeClass('active');   // clear old tag
  $(allTag).addClass('active');         // switch to All tag
  lastsearch = txt;
  filterByText(txt);
}

// filter solutions - no input means show all
function filterByText(txt) {
  if (!txt) {
    if (activeTag !== allTag) return searchTag($(activeTag));
    $solutions.show();
    $count.text($solutions.length);
    return;
  }
  $solutions.hide();
  var re = new RegExp(_.escapeRegExp(txt), 'i');
  var $results = $solutions.filter(function() {
    var $el = $(this);
    return re.test($el.text()) || re.test($el.data('tags'));
  });
  $count.text($results.length);
  $results.show();
}

});
