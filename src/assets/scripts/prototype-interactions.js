function sidebarClosing(event, element, location) {
  // console.log(event, element);
}

function pinSidebar(thisElement, sidebarTagName) {
  let sidebar = document.getElementsByTagName(sidebarTagName)[0];
  let pinClass = 'pinned';

  sidebar.classList.contains(pinClass)
    ? sidebar.classList.remove(pinClass)
    : sidebar.classList.add(pinClass);
}

function addRemoveShortcut(thisElement, targetElement) {
  let shortcutActiveClass = 'active';
  let widgetShortcutList = document.getElementsByClassName(targetElement)[0];
  let thisWidgetTile = thisElement.parentNode;
  let widgetAttr = thisWidgetTile.getAttribute('alpha-widget-tile');
  let shortcut = widgetShortcutList.querySelectorAll('li[alpha-widget-tile="' + widgetAttr + '"]');

  if (shortcut.length === 1) {
    shortcut[0].remove();
    thisElement.classList.remove(shortcutActiveClass);
  } else if (shortcut.length === 0) {
    let thisWidgetTileClone = thisWidgetTile.cloneNode(true);
    thisWidgetTileClone.classList.add('new-shortcut');
    widgetShortcutList.appendChild(thisWidgetTileClone);
    thisElement.classList.add(shortcutActiveClass);
    setTimeout(function () {
      thisWidgetTileClone.classList.remove('new-shortcut');
    }, 500);
  }
}

function loadWidget(thisElement) {
  let widgetLoader = document.querySelectorAll('.widget-dock-loader')[0];
  let loaderAppendLocation = widgetLoader.querySelectorAll('.currently-loading')[0];
  let previouslyLoaded = loaderAppendLocation.children[0];

  let thisWidgetInfo = thisElement.querySelectorAll('.widget-title')[0].cloneNode(true);

  previouslyLoaded.remove();
  loaderAppendLocation.prepend(thisWidgetInfo);

  // .docked-features was the always hidden widget list, since deleted. Guarded
  // rather than dropped, because the class may still exist in other views.
  document.querySelectorAll('.docked-features')[0]?.classList.remove('view-widgets');
  widgetLoader.setAttribute('widget-loading', true);
  setTimeout(function () {
    widgetLoader.setAttribute('widget-loading', false);
  }, 2000);
}

function viewWidgetList() {
  let element = document.getElementsByClassName('docked-features')[0];
  let viewWidgetListClass = 'view-widgets';

  if (!element) return;

  element.classList.contains(viewWidgetListClass)
    ? element.classList.remove(viewWidgetListClass)
    : element.classList.add(viewWidgetListClass);
}

function uxHelperToggleState(thisElement, targetElement, thisElementCSSClass, targetElementCSSClass) {
  let element = document.getElementsByClassName(targetElement)[0];
  thisElement.classList.contains(thisElementCSSClass)
    ? thisElement.classList.remove(thisElementCSSClass)
    : thisElement.classList.add(thisElementCSSClass);
  element.classList.contains(targetElementCSSClass)
    ? element.classList.remove(targetElementCSSClass)
    : element.classList.add(targetElementCSSClass);
}

function formTileViewToggle(thisElement, formTileContainerID) {
  let formTileContainer = document.querySelectorAll(formTileContainerID)[0];
  let formTileCSSClass = 'tile-view';

  formTileContainer.classList.contains(formTileCSSClass)
    ? formTileContainer.classList.remove(formTileCSSClass)
    : formTileContainer.classList.add(formTileCSSClass);
}

function sidebarStep(stepHeader) {
  let openClass = 'step-open';
  stepHeader.classList.contains(openClass)
    ? stepHeader.classList.remove(openClass)
    : stepHeader.classList.add(openClass);
}

function scrollToPolicy(element) {
  document.getElementById(element).scrollIntoView({ behavior: 'smooth' });
}

function toggleAppStep(elem1, elem2) {
  document.querySelector(elem1).classList.remove('step-open');
  document.querySelector(elem2).classList.add('step-open');
}

function toggleCurrentlyStored(contactType) {
  document.querySelectorAll('.ui-stored-contact-detail').forEach((el) => {
    el.classList.add('ux-hide');
  });

  if (contactType === 'daytime') {
    document.querySelector('.ui-stored-contact-detail--daytime').classList.remove('ux-hide');
  }
  if (contactType === 'email') {
    document.querySelector('.ui-stored-contact-detail--email').classList.remove('ux-hide');
  }
}

function toggleUpdateCurrentlyStored(contactType) {
  document.querySelectorAll('.ui-stored-contact-detail-update').forEach((el) => {
    el.classList.add('ux-hide');
  });

  if (contactType === 'daytime') {
    document.querySelector('.ui-stored-contact-detail--daytime-update').classList.remove('ux-hide');
  }
  if (contactType === 'email') {
    document.querySelector('.ui-stored-contact-detail--email-update').classList.remove('ux-hide');
  }
}

function toggleButtonState(elem, elemClass) {
  document.querySelector(elem).classList.toggle(elemClass);
}

function toggleReviewContent() {
  document.querySelector('.guidance-review-block').classList.toggle('ux-hide');
}

function toggleAppointmentCreatedBy(selectedValue) {
  var value = selectedValue.value;
  if (value == '0') {
    document.querySelector('.ui-pension-booking-information-container-c1').classList.add('ux-hide');
    document.querySelector('.ui-pension-booking-information-container-c2').classList.add('ux-hide');
  }
  if (value == '1') {
    document.querySelector('.ui-pension-booking-information-container-c1').classList.remove('ux-hide');
    document.querySelector('.ui-pension-booking-information-container-c2').classList.add('ux-hide');
  }
  if (value == '2') {
    document.querySelector('.ui-pension-booking-information-container-c1').classList.add('ux-hide');
    document.querySelector('.ui-pension-booking-information-container-c2').classList.remove('ux-hide');
  }
  if (value == '3') {
    document.querySelector('.ui-pension-booking-information-container-c1').classList.add('ux-hide');
    document.querySelector('.ui-pension-booking-information-container-c2').classList.add('ux-hide');
  }
}

function openURLWindowPopup() {
  var leftPos = screen.width - 1100;
  window.open(
    'https://www.moneyhelper.org.uk/en/pensions-and-retirement/pension-wise/book-a-free-pension-wise-appointment/how-to-book-a-phone-appointment/book-a-phone-appointment',
    '_blank',
    'location=no,titlebar=no,height=600,width=450,top=250,left=' + leftPos + ',scrollbars=yes,status=yes'
  );
}