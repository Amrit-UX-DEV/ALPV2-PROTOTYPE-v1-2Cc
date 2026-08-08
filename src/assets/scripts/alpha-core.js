


var alpha_ui = {
		global_reference_selectors:{
			appContainer:'.alpha-app-container'
		},
		/* APP EXPLORER TOOL BAR INTERACTIONS */
		app_explorer:{
			reference_selector:{
				container:'.alpha-nav-app-explorer',
				settingsPanel:'.alpha-nav-app-explorer-settings',
				menuToggle:'.alpha-nav-app-explorer-menu-toggle',
				close_style:"alpha-app-exp-closed",
				no_data_item:'#alpha-nav-app-setting-no-data',
				collapse_expand_item:'#alpha-nav-app-setting-collapse-expand',
				hide_no_data_style:"alpha-app-exp-hide-no-data",
				collapse_expand_style:"alpha-app-exp-expand-all"
			},
			init:function(){
				alpha_ui.app_explorer.menutoggleNew();
				alpha_ui.app_explorer.settings.init();
			},
			menutoggleNew:function(){
			
				var appContainer = jQuery(alpha_ui.global_reference_selectors.appContainer);
				var toolbarToggle = jQuery('input#alpha-toolbar-toggle');
				
				toolbarToggle.on('change', function(){
					jQuery(this).is(':checked') ? appContainer.addClass(alpha_ui.app_explorer.reference_selector.close_style): appContainer.removeClass(alpha_ui.app_explorer.reference_selector.close_style);
				});

			},

			settings:{
				init:function(){

					alpha_ui.app_explorer.settings.data_item_toggle();
					alpha_ui.app_explorer.settings.collapse_expand();
				
				},
				data_item_toggle:function(){
					var noDataItemsElement = jQuery(alpha_ui.app_explorer.reference_selector.no_data_item);
				
					noDataItemsElement.on('change', function(){
						jQuery(alpha_ui.app_explorer.reference_selector.container).toggleClass(alpha_ui.app_explorer.reference_selector.hide_no_data_style);
					});

				},
				collapse_expand:function(){
					var collapseExpandElement = jQuery(alpha_ui.app_explorer.reference_selector.collapse_expand_item);
					var appExplorer = jQuery(alpha_ui.app_explorer.reference_selector.container);
				

				collapseExpandElement.on('change', function(){
						jQuery(alpha_ui.app_explorer.reference_selector.container).toggleClass(alpha_ui.app_explorer.reference_selector.collapse_expand_style);

						
					});
				}
			}
		},
		/* ACCORDION INTERACTIONS */
		accordion:{
			reference_selector:{
				container:".alpha-accordion-container",
				parent_element:".alpha-accordion-parent",
				child_elements:".alpha-accordion-children",
				close_style:"alpha-item-closed",
				active_style:"alpha-active-section",
				selected_style:"alpha-selected"
			},
			init:function()
			{
				var accordionContainer = jQuery(alpha_ui.accordion.reference_selector.container);
				var parentElements = jQuery(alpha_ui.accordion.reference_selector.parent_element);
				var childElements = accordionContainer.find('li a');
				var openCloseElement = jQuery("<span class='alpha-openclose'></span>");
		
				jQuery(alpha_ui.accordion.reference_selector.parent_element + ' > a').append(openCloseElement);

				/* Open Close Nested Menu Items */
				parentElements.each(function(){

				 var thisParent = jQuery(this); /* li */
				 var thisItem = thisParent.find('> a');

				 thisItem.on('click', function(){

					var thisItem = jQuery(this); /* li */
					var thisParent = thisItem.parents().eq(0);
					thisParent.toggleClass(alpha_ui.accordion.reference_selector.close_style + ' ' + alpha_ui.accordion.reference_selector.active_style);

				 }); /* End of Click Event*/

				}); /* End of Open Close Nested Items */

				/* Assign Selected State */

				childElements.on('click', function(){
					var thisItem = jQuery(this).parents().eq(0); /* li */
					var allItems = jQuery(alpha_ui.accordion.reference_selector.container + ' li');

					allItems.removeClass(alpha_ui.accordion.reference_selector.selected_style);
					thisItem.toggleClass(alpha_ui.accordion.reference_selector.selected_style);
				});

			} /* End of init */
		} /* End of accordion */


} /* End of alpha_ui */


function slideContent(){

var primaryField = jQuery('.primary-field input');
var secondaryFields = jQuery('.secondary-fields input');
var protoSearchBtn = jQuery('#proto-search-btn');

var protoSearchToolbarBtn = jQuery('#proto-toolbar-search-btn');
var protoShowFieldsBtn = jQuery('#proto-show-fields-btn');
var searchResults = jQuery('.search-results');
var searchFields = jQuery('.search-fields');
var contextString = "Policy 80007, In Force, Directors Inv Prog 1, Great Britain, UK Sterling"



if(protoSearchToolbarBtn){

protoSearchToolbarBtn.on('click', function(){

	searchFields.hide(350);

	searchResults.fadeIn(350);
	protoShowFieldsBtn.show(0);

	jQuery('.alpha-context-bar-info').text(contextString);
	jQuery('.proto-toolbar-options').show(0);
	
	jQuery('.search-menu-item').addClass('alpha-item-closed');
	

	
});


}




if(protoSearchBtn){

protoSearchBtn.on('click', function(){

	searchFields.hide(350);
	protoSearchBtn.hide(0);
	searchResults.show(350);
	protoShowFieldsBtn.show(0);

	jQuery('.alpha-context-bar-info').text(contextString);

	jQuery('.proto-toolbar-options').show(0);
});

protoShowFieldsBtn.on('click', function(){

	searchFields.show(350);
	protoSearchBtn.show(0);
	
	protoShowFieldsBtn.hide(0);


});


}

if(secondaryFields){
var primaryFieldContainer = jQuery('.primary-field');
	
	secondaryFields.each(function(){
		var thisField = jQuery(this);

		thisField.on('keyup', function(){
		thisField.val() == "" ? primaryFieldContainer.show(0) : primaryFieldContainer.hide(350) ;
		});
	});

};



if(primaryField){
	var slideContent = jQuery('.slide-content');
	
	primaryField.on('change keyup', function(){

		var thisField = jQuery(this);
		thisField.val() == "" ? slideContent.show(0) : slideContent.hide(350) ;

	});
};

};	





jQuery(function(){

	console.log('running');
	alpha_ui.accordion.init();
	alpha_ui.app_explorer.init();

	slideContent();

	// UX Trigger Click on element

		function triggerClickOnElement(){
			
			let triggerElement = jQuery('button[ux-tc]');

			triggerElement.on('click', function(){

			let thisElement = jQuery(this);

			let elementToClickID = thisElement.attr('ux-tc');
			let elementToClick = jQuery('[ux-child=\"' + elementToClickID + '\"] .alpha-selected');
			
			elementToClick.trigger('click');
		
			}); // End of click
	
		}

		triggerClickOnElement();


	// UX Card Slider 

	function alphaCardSlider(){

		let alphaTimeLineCardSlider = jQuery('alpha-address-timeline, .card-carousel');

		alphaTimeLineCardSlider.each(function(){
		
			let thisCardSlider = jQuery(this);
		
		
		let alphaCardElements = thisCardSlider.find('li.alpha-unit-card, .card-item-container');
		let numberOfCards = alphaCardElements.length;
		let alphaCardsNextBtn = thisCardSlider.find('.alpha-unit-card-next, .card-next-btn');
		let alphaCardsPrevBtn = thisCardSlider.find('.alpha-unit-card-prev, .card-prev-btn');
		let currentItemCount = thisCardSlider.find('.alpha-deck-controls .alpha-count-current-item, .card-deck-controls .card-count-current-item');
		
		// Setting example disabled state
		alphaCardsNextBtn.attr('disabled', 'disabled');

		// Previous Button - goes forward through LI items
		alphaCardsPrevBtn.on('click', function(){
			
			let thisElement = jQuery(this);
			let currentCard = thisCardSlider.find('li.alpha-unit-card.current-card, .card-item-container.current-card');

			if(currentCard.index() == (numberOfCards)){

				/* End is reached */
			
			}else{

				alphaCardElements.removeClass('current-card previous-card');

				currentCard.next().addClass('current-card');
				currentCard.addClass('previous-card');
				currentItemCount.text(currentCard.next().attr('item-count'));

				// Setting example disabled state
				currentCard.next().attr('item-count') == (1) ? alphaCardsPrevBtn.attr('disabled', 'disabled') : alphaCardsNextBtn.removeAttr('disabled');

			}
			
		});// Previous Button

		// Next Button
		alphaCardsNextBtn.on('click', function(){
			
			let thisElement = jQuery(this);
			let currentCard = thisCardSlider.find('.alpha-unit-card.current-card , .card-item-container.current-card');

			if(currentCard.index() == 1){

				/* End is reached */
			
			}else{

				alphaCardElements.removeClass('current-card previous-card');
				
				currentCard.prev().prev().addClass('previous-card');
				currentCard.prev().addClass('current-card');
				currentItemCount.text(currentCard.prev().attr('item-count'));

				// Setting example disabled state
				currentCard.prev().attr('item-count') == (numberOfCards) ? alphaCardsNextBtn.attr('disabled', 'disabled') : alphaCardsPrevBtn.removeAttr('disabled');
			}
			
		});// Next Button
		
		
		
		});
		
	} // end of alphaCardSlider

	alphaCardSlider();

	// UX Tabs

	function uxTabs(){
		
		let uxTabSelectionGroup = jQuery('.alpha-section-tabs');

		uxTabSelectionGroup.each(function(){
		
			let thisTabSelectionGroup = jQuery(this);
			let uxTabs = thisTabSelectionGroup.find('button[ux-tab]');
			let uxTabSections = thisTabSelectionGroup.next('.alpha-sections').find('[ux-tab-section]');
		
		
			uxTabs.on('click', function(){
				let thisElement = jQuery(this);	
				let elementID = thisElement.attr('ux-tab');
			
				uxTabs.removeClass('selected');
				thisElement.addClass('selected');

				uxTabSections.css({display:"none"});

				let tabSectionToShow = thisTabSelectionGroup.next('.alpha-sections').find('[ux-tab-section=\"' + elementID + '\"]');
				tabSectionToShow.css({display:"block"});
		
			}); // End of Click

		
		}); // End of Each

		
		

		

		

	}

	uxTabs();

	// UX Selection Group - Parent/Child Group 

		function parentChildGroups(){
	
		let parentItem = jQuery('button[ux-parent]');

		parentItem.on('click', function(){

			let thisElement = jQuery(this);

			let thisParentsChildID = thisElement.attr('ux-parent');
			let thisParentsChild = jQuery('[ux-child=\"' + thisParentsChildID + '\"]');
			
			thisParentsChildSiblings = (thisParentsChild.nextAll().add(thisParentsChild.prevAll()) );

			thisParentsChild.css({display: "block"});
			thisParentsChildSiblings.css({display: "none"});
		
		});// end of click
	}// end of parentChildGroups

	parentChildGroups();


	function selectionGroups(){
	
		let selectionGroup = jQuery('button[ux-selection-group]');
		selectionGroup.on('click', function(){

			let thisElement = jQuery(this);
			let thisSelectionGroup = thisElement.attr('ux-selection-group');
			let selectionGroupItems = jQuery('[ux-selection-group=\"' + thisSelectionGroup + '\"]');
			
			selectionGroupItems.removeClass('alpha-selected');
			
			thisElement.addClass('alpha-selected');
		
		});
	}

	selectionGroups();



	// GROUP SUMMARY EVENTS

	function groupSummaryInteractionExamples(){
		
		var groupSummaryItem = jQuery("#UXGroupSummaryProto.alpha-linked-data-structure button");
	
		if(groupSummaryItem){
			
			groupSummaryItem.on("click", function(){
				
				var thisItem = jQuery(this);
				var thisItemID = thisItem.attr("client-id");
				var thisItemGroupID = thisItem.attr("ux-group-type");
				var thisItemWarning = thisItem.attr("warning-notifications");
				var thisItemClientName = thisItem.attr("ux-client-name");

				var commonItems = jQuery('[client-id*=\"' + thisItemID + '\"]');
				var thisItemPolicy = thisItem.find(".alpha-info, .alpha-info + .alpha-additional-info , .status-label").text();
				
				groupSummaryItem.removeClass('alpha-selected');

				if(thisItemID){

					commonItems.addClass('alpha-selected');

				}// end of if

				if(thisItemClientName){

					console.log(thisItemClientName);
				
				}// end of if

				if(thisItemGroupID){

					var groupTypeTree = jQuery("li[ux-group-type]");
					jQuery("button.group-unit").removeClass("current-group active");
					thisItem.addClass("current-group active");


					groupTypeTree.addClass("hide-summary-type");
					jQuery('[ux-group-type*=\"' + thisItemGroupID + '\"]').removeClass("hide-summary-type");;


				}// end of if


				if(thisItemWarning){

					jQuery('alpha-context-notifications, alpha-footer').addClass('hasWarnings');
					jQuery('alpha-context-notifications i').addClass('ringalert');
					

					

				
				}else{
					jQuery('alpha-context-notifications, alpha-footer').removeClass('hasWarnings');
					jQuery('alpha-context-notifications i').removeClass('ringalert');
				}// end of if

			thisItem.addClass('alpha-selected');
	

				jQuery(".alpha-context-bar-info").text(thisItemPolicy);
			});
		
		}
		// End of if
	
	}
	// end of function

	groupSummaryInteractionExamples();


    
	function wizardExample(){
        var nextButton = jQuery(".proto-wizard-next");


        console.log("wizard next running");
            nextButton.on("click", function(){

			var activeStep = jQuery("li[stepstatus='active']");
			var stepIndex = (activeStep.index() + 1);

			jQuery("#wizardStep_" + stepIndex).addClass('hide-step');
			jQuery("#wizardStep_" + (stepIndex + 1)).removeClass('hide-step');
			activeStep.attr('stepstatus', 'complete');
			activeStep.next().attr('stepstatus', 'active');
          


        });

        var uxHelper = jQuery(".ux-helper-btn");
		
            uxHelper.on("click", function(){

			var thisHelper = jQuery(this);
			var uiElm = thisHelper.attr('ui-element');
			var hideElm = thisHelper.attr('hide-element');

			jQuery('.' + uiElm).removeClass('hide-step');
			jQuery(hideElm).addClass('hide-step');
			thisHelper.addClass('selected-grid-row');

		
        });


        };
        wizardExample();


		function uxClickEvents(){
		
		var clickTrigger = jQuery("[ux-click-events]");
		var clickCount = 0;

			if(clickTrigger){
				
				clickTrigger.on('click', function(){
				
				var thisElement = jQuery(this);
				var clickCap = thisElement.attr('ux-click-events');
				
					if(clickCount != clickCap){
						clickCount++;

						thisElement.attr('ux-click-event-step', clickCount);


					} else if(clickCount == clickCap){
						//clickCount = 0;
						//thisElement.attr('ux-click-event-step', clickCount);
					}
					console.log(clickCap, clickCount);
					
				}
				
				); // end of click

		
			} // end of if

		
		}; // end of uxClickEvents
		uxClickEvents();
});

function groupSummaryInteractionExamples(){
	
	var groupSummaryItem = jQuery("#UXGroupSummaryProto button:not(.ui-policy-open, .secondary-action)");

	if(groupSummaryItem){
		
		groupSummaryItem.on("click", function(){
			
			var thisItem = jQuery(this);
			var thisItemID = thisItem.attr("client-id");
			var thisItemGroupID = thisItem.attr("ux-group-type");
			var thisItemWarning = thisItem.attr("warning-notifications");
			var thisItemClientName = thisItem.attr("ux-client-name");

			var commonItems = jQuery('[client-id*=\"' + thisItemID + '\"]');
			var thisItemPolicy = thisItem.find(".alpha-info, .alpha-info + .alpha-additional-info , .status-label").text();
			
			groupSummaryItem.removeClass('alpha-selected');

			if(thisItemID){

				commonItems.addClass('alpha-selected');

			}// end of if

			if(thisItemClientName){

				console.log(thisItemClientName);
			
			}// end of if

			if(thisItemGroupID){

				var groupTypeTree = jQuery("li[ux-group-type]");
				jQuery("button.group-unit").removeClass("current-group active");
				thisItem.addClass("current-group active");


				groupTypeTree.addClass("hide-summary-type");
				jQuery('[ux-group-type*=\"' + thisItemGroupID + '\"]').removeClass("hide-summary-type");;


			}// end of if


			if(thisItemWarning){

				jQuery('alpha-context-notifications, alpha-footer').addClass('hasWarnings');
				jQuery('alpha-context-notifications i').addClass('ringalert');

			}else{
				jQuery('alpha-context-notifications, alpha-footer').removeClass('hasWarnings');
				jQuery('alpha-context-notifications i').removeClass('ringalert');
			}// end of if

		thisItem.addClass('alpha-selected');


			jQuery(".alpha-context-bar-info").text(thisItemPolicy);
		});
	
	}
	// End of if

}
// end of function

groupSummaryInteractionExamples();



function groupSummaryResturcureInteractions(){
	
	var groupSummaryItem = jQuery(".ux-group-summary-prototype button:not(.ui-policy-open, .secondary-action)");
	
	
	
	if(groupSummaryItem){

		var policyRows = jQuery(".ux-group-summary-prototype .ui-policy-row, .ux-group-summary-prototype .ui-group-row");

		groupSummaryItem.on("click", function(){
			
			var thisItem = jQuery(this);
			var thisItemID = thisItem.attr("client-id");
			var thisItemLinkedPolicyClient = thisItem.attr("policy-client-link");
			var thisItemGroupID = thisItem.attr("ux-group-type");
			var thisItemWarning = thisItem.attr("warning-notifications");
			var thisItemClientName = thisItem.attr("ux-client-name");
			var commonItems = jQuery('[client-id*=\"' + thisItemID + '\"]');
			var linkedPolicyClient = jQuery('[linked-clients*=\"' + thisItemLinkedPolicyClient + '\"]');

			//var thisItemSelectedClient = linkedPolicyClient.attr("selected-client");

			var thisItemPolicy = thisItem.find(".alpha-info, .alpha-info + .alpha-additional-info , .status-label").text();
			
			groupSummaryItem.removeClass('alpha-selected');
			policyRows.removeClass('ui-show-linked-member');
			policyRows.attr("selected-client", "");

			if(thisItemID){

				commonItems.addClass('alpha-selected');

			}// end of if

			if(thisItemLinkedPolicyClient){
				
				linkedPolicyClient.addClass('ui-show-linked-member');
				linkedPolicyClient.attr("selected-client", thisItemLinkedPolicyClient);
				//thisItemSelectedClient = thisItemLinkedPolicyClient;
				
			}// end of if

			if(thisItemClientName){

			}// end of if

			if(thisItemGroupID){

				var groupTypeTree = jQuery("li[ux-group-type]");
				jQuery("button.group-unit").removeClass("current-group active");
				thisItem.addClass("current-group active");


				groupTypeTree.addClass("hide-summary-type");
				jQuery('[ux-group-type*=\"' + thisItemGroupID + '\"]').removeClass("hide-summary-type");;


			}// end of if


			if(thisItemWarning){

				jQuery('alpha-context-notifications, alpha-footer').addClass('hasWarnings');
				jQuery('alpha-context-notifications i').addClass('ringalert');

			}else{
				jQuery('alpha-context-notifications, alpha-footer').removeClass('hasWarnings');
				jQuery('alpha-context-notifications i').removeClass('ringalert');
			}// end of if

		thisItem.addClass('alpha-selected');


			jQuery(".alpha-context-bar-info").text(thisItemPolicy);
		});
	
	}
	// End of if

}
// end of function

groupSummaryResturcureInteractions();






