

let alphaInteractions = {
    repeatingDetailBlock:{
        references:{
            userInputCollection:'input[type="text"], select',
            userSubmitElement:'button',
            blockContainer:"<ul></ul>",
            blockItemContainer:"li",
            blockItemDataContainer:"span",
            removeItemBtnContent:"<i class=\"fa fa-times\" aria-hidden=\"true\"></i>"
        },
        init:function(selector){
            let detailBlock = document.querySelectorAll(selector);
            for (let i = 0; i < detailBlock.length; i++) {

                // Find all instances and set up creation
                let thisBlock = detailBlock[i];
                let thisBlockTheme = thisBlock.getAttribute('alpha-ui-theme');
                let thisBlockIsSelectable = thisBlock.getAttribute('alpha-ui-selectable-repeaters');
                let thisBlockTemplate = document.querySelectorAll('#' + thisBlock.getAttribute('alpha-ui-template'))[0];
                let thisBlockSubmit = thisBlock.querySelectorAll(alphaInteractions.repeatingDetailBlock.references.userSubmitElement)[0];

                // Insert Container Markup
                thisBlockTemplate == undefined ? thisBlockTemplate = false : thisBlockTemplate = thisBlockTemplate;
                thisBlock.insertAdjacentHTML('afterend', alphaInteractions.repeatingDetailBlock.references.blockContainer);
                let thisBlockContainer = thisBlock.nextElementSibling;
                thisBlockContainer.classList.add((thisBlockTheme == null || thisBlockTheme == ""  ? 'default-theme' : thisBlockTheme));

                // Setup insertions
                alphaInteractions.repeatingDetailBlock.setupBlock(thisBlock, thisBlockSubmit, thisBlockContainer, thisBlockTemplate, thisBlockIsSelectable);
            }
        },
        setupBlock:function(thisBlock, thisBlockSubmit, thisBlockContainer, thisBlockTemplate, thisBlockIsSelectable){

            function insertBlockItem(){

                thisBlockContainer.append(alphaInteractions.repeatingDetailBlock.createBlockItem(thisBlock, thisBlockTemplate, thisBlockIsSelectable));
            };

            thisBlockSubmit.addEventListener("click", insertBlockItem, false);
        },
        createBlockItem:function(thisBlock, thisBlockTemplate, thisBlockIsSelectable){

            let blockItemContainer = document.createElement(alphaInteractions.repeatingDetailBlock.references.blockItemContainer);
            let blockItemDataContainer = document.createElement(alphaInteractions.repeatingDetailBlock.references.blockItemDataContainer);
            let thisBlockInputs = thisBlock.querySelectorAll(alphaInteractions.repeatingDetailBlock.references.userInputCollection);

            // Loop through inputs and append values into item container
            for (let i = 0; i < thisBlockInputs.length; i++) {
                let thisInput = thisBlockInputs[i];
                let thisInputData = blockItemDataContainer.cloneNode(false);
                thisInputData.classList.add('item-info-' + i);
                thisInputData.textContent = thisInput.value;
                blockItemContainer.append(thisInputData);
            }

            let removeItem = document.createElement('button');
            let removeBlockItem = function(e){ e.stopPropagation(); blockItemContainer.remove();};

            removeItem.classList.add('remove');
            removeItem.addEventListener("click", removeBlockItem, false);
            removeItem.innerHTML = alphaInteractions.repeatingDetailBlock.references.removeItemBtnContent;
            blockItemContainer.classList.add('detail-block-item');
            blockItemContainer.append(removeItem);

            thisBlockIsSelectable != null ? alphaInteractions.selectableItem.setupEvents(blockItemContainer, thisBlockIsSelectable) : thisBlockIsSelectable = false;


            // If a template is defined, append to end
            if(thisBlockTemplate != false){
                thisBlockTemplate = thisBlockTemplate.cloneNode(true);
                let hasClickEventElements = thisBlockTemplate.querySelectorAll('[alpha-ui-event]');

                // let randomPairingID = "toggle-ui-" + Math.floor((Math.random() * 10000) + 1);
                // thisBlockTemplate.querySelectorAll('.toggle-label')[0].setAttribute('for', randomPairingID);
                // thisBlockTemplate.querySelectorAll('.toggle-checkbox')[0].setAttribute('id', randomPairingID);

                hasClickEventElements.length > -1 ? alphaInteractions.changeAttributes.toggle(false, hasClickEventElements, blockItemContainer) : hasClickEventElements = false;

                blockItemContainer.append(thisBlockTemplate);
            }
            return blockItemContainer;
        }
    },
    splitAttr:function(attrString, splitChar){
        
        return attrString.split((splitChar == undefined ? splitChar = "," : splitChar));
    },
    addCSSClass:function(element, className){
        if (typeof className == 'object'){
            for (let i = 0; i < className.length; i++){
                element.classList.add(className[i]);
            }
        } else{
            element.classList.add(className);
        }
    },
    removeCSSClass:function(element, className){

        if (typeof className == 'object'){
            for (let i = 0; i < className.length; i++){
                element.classList.remove(className[i]);
            }
        } else{
            element.classList.remove(className);
        }

    },
    selectableItem:{
        init:function(selectors){
            let selectableItems = document.querySelectorAll(selectors);
            for (let i = 0; i < selectableItems.length; i++){
                let thisItem = selectableItems[i];
                let selectionAttr = thisItem.getAttribute('alpha-ui-selectable');

                alphaInteractions.selectableItem.setupEvents(thisItem, selectionAttr);
            }
        },
        setupEvents:function(selectableElement, selectionAttr){

            let selectionType = alphaInteractions.splitAttr(selectionAttr)[0];
            let selectionCSSClass = alphaInteractions.splitAttr(alphaInteractions.splitAttr(selectionAttr)[1], "|");
            let hasTargetElement = selectableElement.getAttribute('alpha-ui-target');

            let selectionTarget = hasTargetElement != null ? document.querySelectorAll(hasTargetElement)[0] : hasTargetElement = false;


            let selectItems = function(e){
                e.stopPropagation();
                selectionTarget = hasTargetElement == false ? selectableElement : selectionTarget;
                alphaInteractions.addCSSClass(selectionTarget, selectionCSSClass);
            };

            let toggleItems = function(e){
                e.stopPropagation();

                selectionTarget = hasTargetElement == false ? selectableElement : selectionTarget;
                console.log(selectionTarget);

                for (let i = 0; i < selectionCSSClass.length; i++){
                    selectionTarget.classList.contains(selectionCSSClass[i]) ? alphaInteractions.removeCSSClass(selectionTarget, selectionCSSClass[i]) : alphaInteractions.addCSSClass(selectionTarget, selectionCSSClass[i]);
                }
            };

            let selectSingleItem = function(e){
                e.stopPropagation();

                let parentContainer = this.parentElement;
                let siblingItems = parentContainer.getElementsByTagName(selectableElement.tagName);

                    for (let i = 0; i < siblingItems.length; i++){ alphaInteractions.removeCSSClass(siblingItems[i], selectionCSSClass);};

                alphaInteractions.addCSSClass(selectableElement, selectionCSSClass);
            };

            selectionType == 'single' ? selectableElement.addEventListener("click", selectSingleItem, false) : false;
            selectionType == 'multi' ? selectableElement.addEventListener("click", selectItems, false) : false;
            selectionType == 'toggle' ? selectableElement.addEventListener("click", toggleItems, false) : false;
        }
    },
    changeAttributes:{
        toggle: function(toggleSelector, customElement, customTargetElement){

            let toggleElement = (customElement == undefined ? document.querySelectorAll(toggleSelector) : customElement);

            // Toggle function used by for loop below.
            function elementToggleClass(toggleSelector, targetElement, elementValueCheck, thisElement){
                
                console.log(targetElement, toggleSelector);
                if(elementValueCheck != null){

                    elementValueCheck = alphaInteractions.splitAttr(elementValueCheck);

                    let selectedValueMatched = thisElement.value === elementValueCheck ? true: false;

                    console.log(elementValueCheck, thisElement.value, thisElement.getAttribute('customtarget'));

                    if(selectedValueMatched == true){
                        alphaInteractions.addCSSClass(targetElement, toggleSelector);
                    }
                    if(selectedValueMatched == false){
                        alphaInteractions.removeCSSClass(targetElement, toggleSelector);
                    }
                }else{
                    for (let i = 0; i < toggleSelector.length; i++){
                    targetElement.classList.contains(toggleSelector[i]) ? alphaInteractions.removeCSSClass(targetElement, toggleSelector[i]) : alphaInteractions.addCSSClass(targetElement, toggleSelector[i]);
                    }
                }
            };

            for (let i = 0; i < toggleElement.length; i++) {

                let thisElement = toggleElement[i];
                let thisElementAttributes = alphaInteractions.splitAttr(thisElement.getAttribute('alpha-ui-attr-toggle'));
                let useParentElement = thisElement.getAttribute('alpha-ui-use-parent');
                let elementEventType = thisElement.getAttribute('alpha-ui-event');
                let elementValueCheck = thisElement.getAttribute('alpha-ui-value-check'); 
                let targetElement = customTargetElement == undefined ? document.querySelectorAll(thisElementAttributes[0])[0] : customTargetElement;
                let toggleSelector = alphaInteractions.splitAttr(thisElementAttributes[1], "|");

                elementEventType == 'click' ? thisElement.addEventListener("click", function(){elementToggleClass(toggleSelector, targetElement, elementValueCheck, thisElement)}, false): false;
                elementEventType == 'change' ? thisElement.addEventListener("change", function(){elementToggleClass(toggleSelector, targetElement, elementValueCheck, thisElement)}, false): false;

            }
        }
    },
    matchSelectedValue:{
        init:function(attributeToFind, customparams){
            let elements = (customparams == undefined ? document.querySelectorAll('['+attributeToFind+']') : customparams);
            

            for (let i = 0; i < elements.length; i++) {

                let thisElement = elements[i];
                let thisElementAttributes = alphaInteractions.splitAttr(thisElement.getAttribute(attributeToFind));
                let elementEventType = thisElement.getAttribute('alpha-ui-event');
    
                elementEventType == 'click' ? thisElement.addEventListener("click", function(){alphaInteractions.matchSelectedValue.toggleMatchedSelectedValues(thisElement, thisElementAttributes)}, false): false;
                elementEventType == 'change' ? thisElement.addEventListener("change", function(){alphaInteractions.matchSelectedValue.toggleMatchedSelectedValues(thisElement, thisElementAttributes)}, false): false;
            }

        },
        toggleMatchedSelectedValues:function(element, attributeArray){
            // attributeArray params = ["valueToMatch|elementSelector|["cssClassName"]","valueToMatch|elementSelector|["cssClassName","cssClassName"]"]

            let elementValue = element.value;

            for(let i = 0; i < attributeArray.length; i++){

                let attributeArrayValues = alphaInteractions.splitAttr(attributeArray[i], "|");
                let valueToMatch = attributeArrayValues[0];
                let targetElement = document.querySelectorAll(attributeArrayValues[1])[0];
                let cssClassName = alphaInteractions.splitAttr(attributeArrayValues[2], " ");
                
                let selectedValueMatched = elementValue === valueToMatch ? true: false;

                if(selectedValueMatched == true){
                    alphaInteractions.addCSSClass(targetElement, cssClassName);
                }
                if(selectedValueMatched == false){
                    alphaInteractions.removeCSSClass(targetElement, cssClassName);
                }

                console.log(valueToMatch, targetElement, cssClassName, selectedValueMatched);
            }

        }
    }
};

alphaInteractions.repeatingDetailBlock.init('[alpha-ui="repeating-detail-block"]');
alphaInteractions.changeAttributes.toggle('[alpha-ui-attr-toggle]');
alphaInteractions.selectableItem.init('[alpha-ui-selectable]');

alphaInteractions.matchSelectedValue.init('alpha-ui-match-selected');




// let mousedownID = -1;  //Global ID of mouse down interval
// let mouseYPos;

// function mousedown(event) {
//     event.stopPropagation();
//   if(mousedownID==-1)  //Prevent multimple loops!

//   mousedownID = setInterval(whilemousedown , 10 /*execute every 100ms*/);
//   console.log(mouseYPos);  
// }
// function mouseup(event) {
//     event.stopPropagation();
//     document.body.style['pointer-events'] = 'auto';
//    if(mousedownID!=-1) {  //Only stop if exists
//      clearInterval(mousedownID);
//      mousedownID=-1;
     
//    }
//    //document.body.style['pointer-events'] = 'auto';

// }

// function mouseposition(event){
//     mouseYPos = event.clientY;
    
// }

// function whilemousedown() {
//     // document.body.style['pointer-events'] = 'none';
//     console.log(mouseYPos, 'mousedown');  
    
// }
//Assign events
////document.addEventListener("mousedown", mousedown);
//document.addEventListener("mouseup", mouseup);
//Also clear the interval when user leaves the window with mouse
//document.addEventListener("mouseout", mouseup);
//document.addEventListener("mousemove", mouseposition);