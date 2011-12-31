/*!
 * Wedge
 *
 * Helper functions for creating and managing the auto-suggest control
 *
 * @package wedge
 * @copyright 2010-2011 Wedgeward, wedge.org
 * @license http://wedge.org/license/
 *
 * @version 0.1
 */

function weAutoSuggest(oOptions)
{
	if (!can_ajax)
		return false;

	this.opt = oOptions;

	// Nothing else for now.
	this.opt.sSearchType = 'member';

	// Store the handle to the text box.
	var oText = $('#' + this.opt.sControlId)[0];

	// An annoying bug in Packer makes some servers crash on long strings.
	// It is probably when it attempts to find comments and make sure they aren't enclosed in strings.
	// I don't know more. Let's keep it quiet, shall we?
	var sItemTemplate = '<input type="hidden" name="%post_name%[]" value="%item_id%"><a href="%item_href%" class="extern" onclick="window.open(this.href, \'_blank\'); return false;">%item_name%</a>';
	sItemTemplate += '&nbsp;<img src="%images_url%/pm_recipient_delete.gif" alt="%delete_text%" title="%delete_text%" onclick="return %self%.deleteAddedItem(%item_id%);">';

	this.oTextHandle = oText;

	this.oSuggestDivHandle = null;
	this.sLastSearch = '';
	this.sLastDirtySearch = '';
	this.oSelectedDiv = null;
	this.aCache = [];
	this.aDisplayData = [];
	this.oCallback = {};
	this.bDoAutoAdd = false;
	this.iItemCount = 0;
	this.oHideTimer = null;
	this.bPositionComplete = false;
	this.oXmlRequestHandle = null;

	this.sRetrieveURL = 'sRetrieveURL' in this.opt ? this.opt.sRetrieveURL : '%scripturl%action=suggest;suggest_type=%suggest_type%;search=%search%;%sessionVar%=%sessionID%;xml;time=%time%';

	// How many objects can we show at once?
	this.iMaxDisplayQuantity = 'iMaxDisplayQuantity' in this.opt ? this.opt.iMaxDisplayQuantity : 15;

	// How many characters shall we start searching on?
	this.iMinimumSearchChars = 'iMinimumSearchChars' in this.opt ? this.opt.iMinimumSearchChars : 3;

	// Should selected items be added to a list?
	this.bItemList = 'bItemList' in this.opt ? this.opt.bItemList : false;

	// Are there any items that should be added in advance?
	this.aListItems = 'aListItems' in this.opt ? this.opt.aListItems : [];

	this.sItemTemplate = 'sItemTemplate' in this.opt ? this.opt.sItemTemplate : sItemTemplate;
	this.sTextDeleteItem = 'sTextDeleteItem' in this.opt ? this.opt.sTextDeleteItem : '';
	this.sURLMask = 'sURLMask' in this.opt ? this.opt.sURLMask : '';

	// Create a div that'll contain the results later on.
	this.oSuggestDivHandle = $('<div></div>').addClass('auto_suggest_div').appendTo('body')[0];

	// Create a backup text input for single-entry inputs.
	this.oRealTextHandle = $('<input type="hidden" name="' + oText.name + '" />').val(oText.value).appendTo(oText.form);

	// Disable autocomplete in any browser by obfuscating the name.
	var that = this;
	$(oText).attr({ name: 'dummy_' + Math.floor(Math.random() * 1000000), autocomplete: 'off' })
		.bind(is_opera || is_ie ? 'keypress keydown' : 'keydown', function (oEvent) { return that.handleKey(oEvent); })
		.bind('keyup change focus', function (oEvent) { return that.autoSuggestUpdate(oEvent); })
		.blur(function (oEvent) { return that.autoSuggestHide(oEvent); });

	if (this.bItemList)
	{
		if ('sItemListContainerId' in this.opt)
			this.oItemList = $('#' + this.opt.sItemListContainerId)[0];
		else
		{
			this.oItemList = document.createElement('div');
			oText.parentNode.insertBefore(this.oItemList, oText.nextSibling);
		}
	}

	if (this.aListItems.length > 0)
		for (var i = 0, n = this.aListItems.length; i < n; i++)
			this.addItemLink(this.aListItems[i].sItemId, this.aListItems[i].sItemName);

	return true;
}

// Was it an enter key - if so assume they are trying to select something.
weAutoSuggest.prototype.handleKey = function (oEvent)
{
	// Get the keycode of the key that was pressed.
	var iKeyPress = oEvent.which;

	// Tab.
	if (iKeyPress == 9)
	{
		if (this.aDisplayData.length > 0)
			this.oSelectedDiv != null ? this.itemClicked(this.oSelectedDiv) : this.handleSubmit();
	}
	// Enter. (Returns false to prevent submitting the form.)
	else if (iKeyPress == 13)
	{
		if (this.aDisplayData.length > 0 && this.oSelectedDiv != null)
			this.itemClicked(this.oSelectedDiv);
		return false;
	}
	else if (iKeyPress == 38 || iKeyPress == 40)
	{
		// Up/Down arrow?
		if (!(this.aDisplayData.length && $(this.oSuggestDivHandle).is(':visible')))
			return true;

		// Loop through the display data trying to find our entry.
		var bPrevHandle = false, oToHighlight = null, i;
		for (i = 0; i < this.aDisplayData.length; i++)
		{
			// If we're going up and yet the top one was already selected don't go around.
			if (iKeyPress == 38 && i == 0 && this.oSelectedDiv != null && this.oSelectedDiv == this.aDisplayData[i])
			{
				oToHighlight = this.oSelectedDiv;
				break;
			}
			// If nothing is selected and we are going down then we select the first one.
			if (iKeyPress == 40 && this.oSelectedDiv == null)
			{
				oToHighlight = this.aDisplayData[i];
				break;
			}
			// If the previous handle was the actual previously selected one and we're hitting down then this is the one we want.
			if (iKeyPress == 40 && bPrevHandle != false && bPrevHandle == this.oSelectedDiv)
			{
				oToHighlight = this.aDisplayData[i];
				break;
			}
			// If we're going up and this is the previously selected one then we want the one before, if there was one.
			if (iKeyPress == 38 && bPrevHandle != false && this.aDisplayData[i] == this.oSelectedDiv)
			{
				oToHighlight = bPrevHandle;
				break;
			}
			// Turn this into the previous handle!
			bPrevHandle = this.aDisplayData[i];
		}

		// If we don't have one to highlight by now then it must be the last one that we're after.
		if (oToHighlight == null)
			oToHighlight = bPrevHandle;

		// Remove any old highlighting.
		if (this.oSelectedDiv != null)
			this.itemMouseLeave(this.oSelectedDiv);
		// Mark what the selected div now is.
		this.oSelectedDiv = oToHighlight;
		this.itemMouseEnter(this.oSelectedDiv);
	}

	return true;
};

// Functions for integration.
weAutoSuggest.prototype.registerCallback = function (sCallbackType, sCallback)
{
	this.oCallback[sCallbackType] = sCallback;
};

// User hit submit?
weAutoSuggest.prototype.handleSubmit = function()
{
	var bReturnValue = true, entryId = entryName = null, i = 0;

	// Do we have something that matches the current text?
	for (; i < this.aCache.length; i++)
	{
		var sLastSearch = this.sLastSearch.toLowerCase(), entry = this.aCache[i];

		if (sLastSearch == entry.sItemName.toLowerCase().substr(0, sLastSearch.length))
		{
			// Exact match?
			if (sLastSearch.length == entry.sItemName.length)
			{
				// This is the one!
				entryId = entry.sItemId;
				entryName = entry.sItemName;
				break;
			}
			// Not an exact match, but it'll do for now.
			else
			{
				// If we have two matches don't find anything.
				if (entryId != null)
					bReturnValue = false;
				else
				{
					entryId = entry.sItemId;
					entryName = entry.sItemName;
				}
			}
		}
	}

	if (entryId == null || !bReturnValue)
		return bReturnValue;
	else
	{
		this.addItemLink(entryId, entryName, true);
		return false;
	}
};

// Positions the box correctly on the window.
weAutoSuggest.prototype.positionDiv = function ()
{
	// Only do it once.
	if (this.bPositionComplete)
		return;

	this.bPositionComplete = true;

	// Put the div under the text box.
	var aParentPos = $(this.oTextHandle).offset();

	$(this.oSuggestDivHandle).css({
		left: aParentPos.left,
		top: aParentPos.top + this.oTextHandle.offsetHeight + 1,
		width: this.oTextHandle.style.width
	});
};

// Do something after clicking an item.
weAutoSuggest.prototype.itemClicked = function (oCurElement)
{
	// Is there a div that we are populating?
	if (this.bItemList)
		this.addItemLink($(oCurElement).data('sItemId'), oCurElement.innerHTML);

	// Otherwise clear things down.
	else
		this.oTextHandle.value = oCurElement.innerHTML.php_unhtmlspecialchars();

	this.oRealTextHandle.val(this.oTextHandle.value);
	this.autoSuggestActualHide();
	this.bPositionComplete = false;
};

// Remove the last searched for name from the search box.
weAutoSuggest.prototype.removeLastSearchString = function ()
{
	// Remove the text we searched for from the div.
	var
		sTempText = this.oTextHandle.value.toLowerCase(),
		iStartString = sTempText.indexOf(this.sLastSearch.toLowerCase());
	// Just attempt to remove the bits we just searched for.
	if (iStartString != -1)
	{
		while (iStartString > 0)
		{
			if (sTempText.charAt(iStartString - 1) == '"' || sTempText.charAt(iStartString - 1) == ',' || sTempText.charAt(iStartString - 1) == ' ')
			{
				iStartString--;
				if (sTempText.charAt(iStartString - 1) == ',')
					break;
			}
			else
				break;
		}

		// Now remove anything from iStartString upwards.
		this.oTextHandle.value = this.oTextHandle.value.substr(0, iStartString);
	}
	// Just take it all.
	else
		this.oTextHandle.value = '';
};

// Add a result if not already done.
weAutoSuggest.prototype.addItemLink = function (sItemId, sItemName, bFromSubmit)
{
	// Increase the internal item count.
	this.iItemCount++;

	// If there's a callback then call it. If it returns false, the item must not be added.
	if ('oCallback' in this && 'onBeforeAddItem' in this.oCallback && typeof this.oCallback.onBeforeAddItem == 'string')
		if (!this.oCallback.onBeforeAddItem(this.opt.sSelf, sItemId))
			return;

	var eid = 'suggest_' + this.opt.sControlId + '_' + sItemId;
	$('<div id="' + eid + '"></div>').html(
		this.sItemTemplate.replace(/%post_name%/g, this.opt.sPostName).replace(/%item_id%/g, sItemId)
		.replace(/%item_href%/g, we_prepareScriptUrl() + this.sURLMask.replace(/%item_id%/g, sItemId))
		.replace(/%item_name%/g, sItemName).replace(/%images_url%/g, we_theme_url + "/images").replace(/%self%/g, this.opt.sSelf).replace(/%delete_text%/g, this.sTextDeleteItem)
	).appendTo(this.oItemList);

	// If there's a registered callback, call it. (Note, this isn't used in Wedge at all.)
	if ('oCallback' in this && 'onAfterAddItem' in this.oCallback && typeof this.oCallback.onAfterAddItem == 'string')
		this.oCallback.onAfterAddItem(this.opt.sSelf, eid, this.iItemCount);

	// Clear the div a bit.
	this.removeLastSearchString();

	// If we came from a submit, and there's still more to go, turn on auto add for all the other things.
	this.bDoAutoAdd = this.oTextHandle.value != '' && bFromSubmit;

	// Update the fellow...
	this.autoSuggestUpdate();

	// We'll need to recalculate the auto-suggest's position.
	this.bPositionComplete = false;
};

// Delete an item that has been added, if at all?
weAutoSuggest.prototype.deleteAddedItem = function (sItemId)
{
	// Remove the div if it exists.
	if (!($('#suggest_' + this.opt.sControlId + '_' + sItemId).remove().length))
		return false;

	// Decrease the internal item count.
	this.iItemCount--;

	// If there's a registered callback, call it. (Note, this isn't used in Wedge at all.)
	if ('oCallback' in this && 'onAfterDeleteItem' in this.oCallback && typeof this.oCallback.onAfterDeleteItem == 'string')
		this.oCallback.onAfterDeleteItem(this.opt.sSelf, this.iItemCount);
};

// Hide the box.
weAutoSuggest.prototype.autoSuggestHide = function ()
{
	// Delay to allow events to propagate through....
	this.oHideTimer = setTimeout(this.opt.sSelf + '.autoSuggestActualHide();', 250);
};

// Do the actual hiding after a timeout.
weAutoSuggest.prototype.autoSuggestActualHide = function ()
{
	$(this.oSuggestDivHandle).hide();
	this.oSelectedDiv = null;
};

// Show the box.
weAutoSuggest.prototype.autoSuggestShow = function ()
{
	if (this.oHideTimer)
	{
		clearTimeout(this.oHideTimer);
		this.oHideTimer = false;
	}

	this.positionDiv();

	$(this.oSuggestDivHandle).has(':hidden').slideDown(200);
};

// Populate the actual div.
weAutoSuggest.prototype.populateDiv = function (aResults)
{
	// Cannot have any children yet.
	$(this.oSuggestDivHandle).empty();

	// Something to display?
	if (typeof aResults == 'undefined')
	{
		this.aDisplayData = [];
		return true;
	}

	var aNewDisplayData = [], i;
	for (i = 0; i < (aResults.length > this.iMaxDisplayQuantity ? this.iMaxDisplayQuantity : aResults.length); i++)
		// Create the sub element, and attach some events to it so we can do stuff.
		aNewDisplayData[i] = $('<div></div>')
			.data({ sItemId: aResults[i].sItemId, that: this })
			.addClass('auto_suggest_item')
			.html(aResults[i].sItemName)
			.appendTo(this.oSuggestDivHandle)
			.mouseenter(function (oEvent) { $(this).data('that').itemMouseEnter(this); })
			.mouseleave(function (oEvent) { $(this).data('that').itemMouseLeave(this); })
			.click(function (oEvent) { $(this).data('that').itemClicked(this); })[0];

	this.aDisplayData = aNewDisplayData;

	return true;
};

// Refocus the element.
weAutoSuggest.prototype.itemMouseEnter = function (oCurElement)
{
	this.oSelectedDiv = oCurElement;
	oCurElement.className = 'auto_suggest_item_hover';
};

// Unfocus the element
weAutoSuggest.prototype.itemMouseLeave = function (oCurElement)
{
	oCurElement.className = 'auto_suggest_item';
};

weAutoSuggest.prototype.onSuggestionReceived = function (oXMLDoc)
{
	var aItems = $('item', oXMLDoc), i, ac = [];

	aItems.each(function (i) {
		ac[i] = { sItemId: $(this).attr('id'), sItemName: $(this).text() };
	});

	// If we're doing auto add and we find the exact person, then add them!
	if (this.bDoAutoAdd)
		for (i in ac)
		{
			if (this.sLastSearch == ac[i].sItemName)
			{
				var sItemId = ac[i].sItemId, sItemName = ac[i].sItemName;
				this.aCache = ac = [];
				return this.addItemLink(sItemId, sItemName, true);
			}
		}

	// Check we don't try to keep auto-updating!
	this.bDoAutoAdd = false;

	// Populate the div.
	this.populateDiv(this.aCache = ac);

	// Make sure we can see it.
	aItems.length ? this.autoSuggestShow() : this.autoSuggestHide();

	return true;
};

// Get a new suggestion.
weAutoSuggest.prototype.autoSuggestUpdate = function ()
{
	// If there's a callback then call it.
	if ('onBeforeUpdate' in this.oCallback && typeof this.oCallback.onBeforeUpdate == 'string')
		// If it returns false, the item must not be added.
		if (!this.oCallback.onBeforeUpdate(this.opt.sSelf))
			return false;

	this.oRealTextHandle.val(this.oTextHandle.value);

	if ($.trim(this.oTextHandle.value) === '')
	{
		this.aCache = [];
		this.populateDiv();
		this.autoSuggestHide();

		return true;
	}

	// Nothing changed?
	if (this.oTextHandle.value == this.sLastDirtySearch)
		return true;

	this.sLastDirtySearch = this.oTextHandle.value;

	// We're only actually interested in the last string.
	var sSearchString = this.oTextHandle.value.replace(/^("[^"]+",[ ]*)+/, '').replace(/^([^,]+,[ ]*)+/, '');
	if (sSearchString[0] == '"')
		sSearchString = sSearchString.substr(1);

	// Stop replication ASAP.
	var sRealLastSearch = this.sLastSearch;
	this.sLastSearch = sSearchString;

	// Either nothing or we've completed a sentence.
	if (sSearchString == '' || sSearchString.substr(sSearchString.length - 1) == '"')
		return this.populateDiv();

	// Nothing?
	var sLowercaseSearch = sSearchString.toLowerCase();
	if (sRealLastSearch.toLowerCase() == sLowercaseSearch)
		return true;

	// Too small?
	else if (sSearchString.length < this.iMinimumSearchChars)
	{
		this.aCache = [];
		this.autoSuggestHide();
		return true;
	}
	else if (sSearchString.substr(0, sRealLastSearch.length) == sRealLastSearch)
	{
		// Instead of hitting the server again, just narrow down the results...
		for (var aNewCache = [], j = 0, k = 0; k < this.aCache.length; k++)
			if (this.aCache[k].sItemName.substr(0, sSearchString.length).toLowerCase() == sLowercaseSearch)
				aNewCache[j++] = this.aCache[k];

		this.aCache = [];
		if (aNewCache.length != 0)
		{
			this.aCache = aNewCache;

			// Repopulate.
			this.populateDiv(this.aCache);

			// Can it be seen?
			this.autoSuggestShow();

			return true;
		}
	}

	// In progress means destroy!
	if (typeof this.oXmlRequestHandle == 'object' && this.oXmlRequestHandle != null)
		this.oXmlRequestHandle.abort();

	// Get the document.
	this.oXmlRequestHandle = getXMLDocument.call(this, this.sRetrieveURL
		.replace(/%scripturl%/g, we_prepareScriptUrl())
		.replace(/%suggest_type%/g, this.opt.sSearchType)
		.replace(/%search%/g, sSearchString.php_urlencode())
		.replace(/%sessionVar%/g, we_sessvar)
		.replace(/%sessionID%/g, we_sessid)
		.replace(/%time%/g, +new Date()), this.onSuggestionReceived);

	return true;
};
