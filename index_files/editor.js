var _____WB$wombat$assign$function_____ = function(name) {return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name)) || self[name]; };
if (!self.__WB_pmw) { self.__WB_pmw = function(obj) { this.__WB_source = obj; return this; } }
{
  let window = _____WB$wombat$assign$function_____("window");
  let self = _____WB$wombat$assign$function_____("self");
  let document = _____WB$wombat$assign$function_____("document");
  let location = _____WB$wombat$assign$function_____("location");
  let top = _____WB$wombat$assign$function_____("top");
  let parent = _____WB$wombat$assign$function_____("parent");
  let frames = _____WB$wombat$assign$function_____("frames");
  let opener = _____WB$wombat$assign$function_____("opener");

/// <reference path="../node_modules/pxt-core/built/pxteditor.d.ts" />
var pxt;
(function (pxt) {
    var editor;
    (function (editor) {
        function patchBlocks(pkgTargetVersion, dom) {
            // Perform the following upgrades for sprite event blocks:
            // - Change variables_get_reporter shadows into argument_reporter_custom shadows for sprite
            //   event blocks
            // - Delete variables_get blocks that are connected to a shadow on a sprite event block
            // - If a variables_get block inside an event handler has the same name as an event handler
            //   argument name, change the variables_get block to an argument_reporter_custom block
            /*
            Old event blocks (variables_get_reporter):
    
            <block type="spritesoverlap">
                <value name="HANDLER_DRAG_PARAM_sprite">
                    <shadow type="variables_get_reporter">
                        <field name="VAR">sprite</field>
                    </shadow>
                    <block type="variables_get">
                        <field name="VAR">myVariable</field>
                    </block>
                </value>
                ...
                <value name="HANDLER_DRAG_PARAM_otherSprite">
                    <shadow type="variables_get_reporter">
                        <field name="VAR">otherSprite</field>
                    </shadow>
                </value>
                ...
                <statement name="HANDLER">
                    <block type="spritesetpos">
                        <value name="sprite">
                            <block type="variables_get">
                                <field name="VAR">myVariable</field>
                            </block>
                        </value>
                        ...
                    </block>
                </statement>
            </block>
    
    
            New event blocks (argument_reporter_custom):
    
            <block type="spritesoverlap" x="490" y="470">
                <value name="HANDLER_DRAG_PARAM_sprite">
                    <shadow type="argument_reporter_custom">
                        <mutation typename="Sprite"></mutation>
                        <field name="VALUE">sprite</field>
                    </shadow>
                </value>
                ...
                <value name="HANDLER_DRAG_PARAM_otherSprite">
                    <shadow type="argument_reporter_custom">
                        <mutation typename="Sprite"></mutation>
                        <field name="VALUE">otherSprite</field>
                    </shadow>
                </value>
                ...
                <statement name="HANDLER">
                    <block type="spritesetpos">
                        <value name="sprite">
                            <block type="argument_reporter_custom">
                                <mutation typename="Sprite"></mutation>
                                <field name="VALUE">sprite</field>
                            </block>
                        </value>
                        ...
                    </block>
                </statement>
            </block>
            */
            var allEventNodes = pxt.U.toArray(dom.querySelectorAll("block[type=spritesoverlap]"))
                .concat(pxt.U.toArray(dom.querySelectorAll("block[type=spritesoncreated]")))
                .concat(pxt.U.toArray(dom.querySelectorAll("block[type=spritesondestroyed]")))
                .concat(pxt.U.toArray(dom.querySelectorAll("block[type=spritesollisions]")));
            allEventNodes.forEach(function (node) {
                // Don't rewrite if already upgraded, i.e. if there are argument_reporter_custom
                // shadows already present
                if (node.querySelectorAll("shadow[type=argument_reporter_custom]").length > 0) {
                    return;
                }
                var paramValues = pxt.U.toArray(node.children).filter(function (child) {
                    return child.tagName == "value" && child.getAttribute("name").indexOf("HANDLER_DRAG_PARAM_") !== -1;
                });
                var statementsRoot = node.querySelector("statement[name=HANDLER]");
                var usedVariables = pxt.U.toArray(statementsRoot.querySelectorAll("block[type=variables_get]"));
                paramValues.forEach(function (value) {
                    var oldVariableName = "";
                    var connectedVarBlock = getChildBlock(value, "variables_get");
                    if (connectedVarBlock) {
                        // A variable is connected to the shadow variable reporter; use the name for
                        // the argument reporter and delete the variable
                        var connectedVarField = getField(connectedVarBlock, "VAR");
                        oldVariableName = connectedVarField.textContent;
                        value.removeChild(connectedVarBlock);
                    }
                    var handlerVarShadow = getShadow(value, "variables_get_reporter");
                    var handlerVarField = getField(handlerVarShadow, "VAR");
                    var argReporterName = handlerVarField.textContent;
                    oldVariableName = oldVariableName || argReporterName;
                    changeVariableToSpriteReporter(handlerVarShadow, argReporterName);
                    // Change all references to this variable inside the handler to argument reporters
                    usedVariables.forEach(function (usedVarBlock) {
                        var usedVarField = getField(usedVarBlock, "VAR");
                        if (usedVarField && usedVarField.textContent === oldVariableName) {
                            // This variable is a reference to a handler parameter; change it to an
                            // argument reporter
                            changeVariableToSpriteReporter(usedVarBlock, argReporterName);
                        }
                    });
                });
            });
            /**
             * Upgrade for scene.setTile() which went from being expandable to not
             */
            pxt.U.toArray(dom.querySelectorAll("block[type=gamesettile]")).forEach(function (block) {
                var mutation = getMutation(block);
                if (!mutation)
                    return; // Already upgraded
                var expanded = mutation.getAttribute("_expanded") !== "0";
                block.removeChild(mutation);
                if (expanded) {
                    // The value input must already be in the XML, so no changes needed
                    return;
                }
                else {
                    // There might be a value input present, but we should remove it
                    // and replace it with the default to replicate the unexpanded behavior
                    var value = getChildNode(block, "value", "name", "wall");
                    if (value) {
                        block.removeChild(value);
                    }
                    var newValue = replaceToggle("wall", "toggleOnOff", "on", "false");
                    block.appendChild(newValue);
                }
            });
            /**
             * Upgrade for game.over() which went from being expandable twice to being expandable once
             */
            if (pxt.semver.strcmp(pkgTargetVersion || "0.0.0", "0.10.0") < 0) {
                pxt.U.toArray(dom.querySelectorAll("block[type=gameOver]")).forEach(function (block) {
                    var mutation = getMutation(block);
                    var value = getChildNode(block, "value", "name", "win");
                    var expansion = mutation.getAttribute("_expanded");
                    if (expansion !== "0") {
                        // Decrement expansion level, as win is now required
                        mutation.setAttribute("_expanded", (Number(expansion) - 1) + "");
                    }
                    else {
                        // Remove old value to replace it default to maintain current behavior
                        if (value) {
                            block.removeChild(value);
                        }
                        var newValue = replaceToggle("win", "toggleWinLose", "win", "false");
                        block.appendChild(newValue);
                    }
                });
            }
            /**
             * Upgrade for enum SpriteKind -> SpriteKindLegacy
             */
            if (pxt.semver.strcmp(pkgTargetVersion || "0.0.0", "0.11.20") < 0) {
                pxt.U.toArray(dom.querySelectorAll("variable[type=SpriteKind]")).forEach(function (block) {
                    block.setAttribute("type", "SpriteKindLegacy");
                });
            }
        }
        function changeVariableToSpriteReporter(varBlockOrShadow, reporterName) {
            var varField = getField(varBlockOrShadow, "VAR");
            varBlockOrShadow.setAttribute("type", "argument_reporter_custom");
            varField.setAttribute("name", "VALUE");
            varField.textContent = reporterName;
            varField.removeAttribute("variabletype");
            varField.removeAttribute("id");
            var mutation = varBlockOrShadow.ownerDocument.createElement("mutation");
            mutation.setAttribute("typename", "Sprite");
            varBlockOrShadow.insertBefore(mutation, varBlockOrShadow.firstChild);
        }
        function getField(parent, name) {
            return getChildNode(parent, "field", "name", name);
        }
        function getShadow(parent, type) {
            return getChildNode(parent, "shadow", "type", type);
        }
        function getChildBlock(parent, type) {
            return getChildNode(parent, "block", "type", type);
        }
        function getChildNode(parent, nodeType, idAttribute, idValue) {
            for (var i = 0; i < parent.children.length; i++) {
                var child = parent.children.item(i);
                if (child.tagName === nodeType && child.getAttribute(idAttribute) === idValue) {
                    return child;
                }
            }
            return undefined;
        }
        function getMutation(parent) {
            for (var i = 0; i < parent.children.length; i++) {
                var child = parent.children.item(i);
                if (child.tagName === "mutation") {
                    return child;
                }
            }
            return undefined;
        }
        editor.initExtensionsAsync = function (opts) {
            pxt.debug('loading arcade target extensions...');
            var res = {
                blocklyPatch: patchBlocks
            };
            return Promise.resolve(res);
        };
        function replaceToggle(valueName, shadowType, fieldName, fieldValue) {
            var newValue = document.createElement("value");
            newValue.setAttribute("name", valueName);
            var shadow = document.createElement("shadow");
            shadow.setAttribute("type", shadowType);
            var field = document.createElement("field");
            field.setAttribute("name", fieldName);
            field.textContent = fieldValue;
            shadow.appendChild(field);
            newValue.appendChild(shadow);
            return newValue;
        }
    })(editor = pxt.editor || (pxt.editor = {}));
})(pxt || (pxt = {}));


}
/*
     FILE ARCHIVED ON 18:00:01 Oct 05, 2019 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 21:41:28 Apr 27, 2023.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 127.334
  exclusion.robots: 0.172
  exclusion.robots.policy: 0.159
  cdx.remote: 0.095
  esindex: 0.01
  LoadShardBlock: 81.602 (3)
  PetaboxLoader3.datanode: 116.761 (4)
  load_resource: 182.377
  PetaboxLoader3.resolve: 140.066
*/