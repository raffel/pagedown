'use strict';
// Needs Markdown.Converter.js at the moment

(function () {
  var util = {},
    position = {},
    ui = {},
    doc = window.document,
    re = window.RegExp,
    nav = window.navigator,
    SETTINGS = { lineLength: 72, },

    // Used to work around some browser bugs where we can't use feature testing.
    uaSniffed = {
      isIe: /msie/.test(nav.userAgent.toLowerCase()),
      isIe5or6: /msie 6/.test(nav.userAgent.toLowerCase()) ||
      /msie 5/.test(nav.userAgent.toLowerCase()),
      isOpera: /opera/.test(nav.userAgent.toLowerCase()),
    },
    HookCollection,
    output;
  if (typeof exports === "object" && typeof require === "function") {
    // we're in a CommonJS (e.g. Node.js) module
    output = exports;
    HookCollection = require("./Markdown.Converter").HookCollection;
  } else {
    output = Markdown;
    HookCollection = Markdown.HookCollection;
  }

  var defaultsStrings = {
    bold: "Strong <strong> Ctrl+B",
    boldexample: "strong text",

    italic: "Emphasis <em> Ctrl+I",
    italicexample: "emphasized text",

    link: "Hyperlink <a> Ctrl+L",
    linkdescription: "enter link description here",
    linkdialog: "<p><b>Insert Hyperlink</b></p><p>http://example.com/ \"optional title\"</p>",

    quote: "Blockquote <blockquote> Ctrl+Q",
    quoteexample: "Blockquote",

    code: "Code Sample <pre><code> Ctrl+K",
    codeexample: "enter code here",

    image: "Image <img> Ctrl+G",
    imagedescription: "enter image description here",
    imagedialog: "<p><b>Insert Image</b></p><p>http://example.com/images/diagram.jpg " +
    "\"optional title\"<br><br>Need <a href='http://www.google.com/search?q=free+" +
    "image+hosting' target='_blank'>free image hosting?</a></p>",

    olist: "Numbered List <ol> Ctrl+O",
    ulist: "Bulleted List <ul> Ctrl+U",
    litem: "List item",

    heading: "Heading <h1>/<h2> Ctrl+H",
    headingexample: "Heading",

    hr: "Horizontal Rule <hr> Ctrl+R",

    undo: "Undo - Ctrl+Z",
    redo: "Redo - Ctrl+Y",
    redomac: "Redo - Ctrl+Shift+Z",

    help: "Markdown Editing Help",
  };

  // -------------------------------------------------------------------
  //  YOUR CHANGES GO HERE
  //
  // I've tried to localize the things you are likely to change to
  // this area.
  // -------------------------------------------------------------------

  // The default text that appears in the dialog input box when entering
  // links.
  var imageDefaultText = "http://";
  var linkDefaultText = "http://";

  // -------------------------------------------------------------------
  //  END OF YOUR CHANGES
  // -------------------------------------------------------------------

  function PreviewManager(converter, panels, hooks) {
    var timeout;
    var elapsedTime;
    var oldInputText;
    var maxDelay = 3000;
    var isFirstTimeFilled = true;

    function getDocScrollTop() {
      var result = 0;

      if (window.innerHeight) {
        result = window.pageYOffset;
      } else {
        if (doc.documentElement != null && doc.documentElement.scrollTop != null) {
          result = doc.documentElement.scrollTop;
        } else if (doc.body != null) {
          result = doc.body.scrollTop;
        }
      }

      return result;
    }

    function nonSuckyBrowserPreviewSet(text) {
      panels.preview.innerHTML = text;
    }

    var previewSetter;

    function previewSet(text) {
      if (previewSetter) {
        return previewSetter(text);
      }

      try {
        nonSuckyBrowserPreviewSet(text);
        previewSetter = nonSuckyBrowserPreviewSet;
      } catch (e) {
        previewSetter = ieSafePreviewSet;
        previewSetter(text);
      }
    }

    function getScaleFactor(panel) {
      if (panel.scrollHeight <= panel.clientHeight) {
        return 1;
      }
      return panel.scrollTop / (panel.scrollHeight - panel.clientHeight);
    };

    function setPanelScrollTops() {
      if (panels.preview) {
        panels.preview.scrollTop = (panels.preview.scrollHeight - panels.preview.clientHeight) *
          getScaleFactor(panels.preview);
      }
    }

    function pushPreviewHtml(text) {
      var emptyTop = position.getTop(panels.input) - getDocScrollTop();

      if (panels.preview) {
        previewSet(text);
        hooks.onPreviewRefresh();
      }

      setPanelScrollTops();

      if (isFirstTimeFilled) {
        isFirstTimeFilled = false;
        return;
      }

      var fullTop = position.getTop(panels.input) - getDocScrollTop();
      if (uaSniffed.isIe) {
        setTimeout(function () {
          window.scrollBy(0, fullTop - emptyTop);
        }, 0);
      } else {
        window.scrollBy(0, fullTop - emptyTop);
      }
    }

    function makePreviewHtml() {
      // If there is no registered preview panel
      // there is nothing to do.
      if (panels.preview == null) {
        return;
      }

      var text = panels.input.value;
      if (text && text === oldInputText) {
         // Input text hasn't changed.
        return;
      }

      oldInputText = text;

      var prevTime = new Date().getTime();
      text = converter.makeHtml(text);
      // Calculate the processing time of the HTML creation.
      // It's used as the delay time in the event listener.
      var currTime = new Date().getTime();
      elapsedTime = currTime - prevTime;

      pushPreviewHtml(text);
    }

    // setTimeout is already used. Used as an event listener.
   function applyTimeout() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      var delay = 0;
      delay = elapsedTime;
      if (delay > maxDelay) {
        delay = maxDelay;
      }
      timeout = setTimeout(makePreviewHtml, delay);
    }

    this.refresh = function (requiresRefresh) {
      if (requiresRefresh) {
        oldInputText = "";
        makePreviewHtml();
      }
      else {
        applyTimeout();
      }
    };

    this.processingTime = function () {
      return elapsedTime;
    };

    // IE doesn't let you use innerHTML if the element is contained somewhere in a table
    // (which is the case for inline editing) -- in that case, detach the element, set the
    // value, and reattach. Yes, that *is* ridiculous.
    function ieSafePreviewSet(text) {
      var preview = panels.preview;
      var parent = preview.parentNode;
      var sibling = preview.nextSibling;
      parent.removeChild(preview);
      preview.innerHTML = text;
      if (!sibling) {
        parent.appendChild(preview);
      } else {
        parent.insertBefore(preview, sibling);
      }
    }

    util.addEvent(panels.input, "input", applyTimeout);
    panels.input.onpaste = applyTimeout;
    panels.input.ondrop = applyTimeout;
    util.addEvent(panels.input, "keypress", applyTimeout);
    util.addEvent(panels.input, "keydown", applyTimeout);
    makePreviewHtml();

    if (panels.preview) {
      panels.preview.scrollTop = 0;
    }
  }

  // A collection of the important regions on the page.
  // Cached so we don't have to keep traversing the DOM.
  // Also holds ieCachedRange and ieCachedScrollTop, where necessary; working around
  // this issue:
  // Internet explorer has problems with CSS sprite buttons that use HTML
  // lists. When you click on the background image "button", IE will
  // select the non-existent link text and discard the selection in the
  // textarea. The solution to this is to cache the textarea selection
  // on the button's mousedown event and set a flag. In the part of the
  // code where we need to grab the selection, we check for the flag
  // and, if it's set, use the cached area instead of querying the
  // textarea.
  //
  // This ONLY affects Internet Explorer (tested on versions 6, 7
  // and 8) and ONLY on button clicks. Keyboard shortcuts work
  // normally since the focus never leaves the textarea.
  function PanelCollection(postfix, text) {
    this.buttonBar = doc.getElementById("wmd-button-bar" + postfix);
    this.preview = doc.getElementById("wmd-preview" + postfix);
    this.input = doc.getElementById("wmd-input" + postfix);
    this.input.value = text || '';
  }

  function CommandManager(pluginHooks, getString, converter) {
    this.hooks = pluginHooks;
    this.getString = getString;
    this.converter = converter;
  }

  // before: contains all the text in the input box BEFORE the selection.
  // after: contains all the text in the input box AFTER the selection.
  function Chunks() {}

  // startRegex: a regular expression to find the start tag
  // endRegex: a regular expresssion to find the end tag
  Chunks.prototype.findTags = function (startRegex, endRegex) {
    var chunkObj = this;
    var regex;

    if (startRegex) {
      regex = util.extendRegExp(startRegex, "", "$");

      this.before = this.before.replace(regex, function (match) {
        chunkObj.startTag = chunkObj.startTag + match;
        return "";
      });

      regex = util.extendRegExp(startRegex, "^", "");

      this.selection = this.selection.replace(regex, function (match) {
        chunkObj.startTag = chunkObj.startTag + match;
        return "";
      });
    }

    if (endRegex) {
      regex = util.extendRegExp(endRegex, "", "$");

      this.selection = this.selection.replace(regex, function (match) {
        chunkObj.endTag = match + chunkObj.endTag;
        return "";
      });

      regex = util.extendRegExp(endRegex, "^", "");

      this.after = this.after.replace(regex, function (match) {
        chunkObj.endTag = match + chunkObj.endTag;
        return "";
      });
    }
  };

  // If remove is false, the whitespace is transferred
  // to the before/after regions.
  //
  // If remove is true, the whitespace disappears.
  Chunks.prototype.trimWhitespace = function (remove) {
    var beforeReplacer, afterReplacer, that = this;
    if (remove) {
      beforeReplacer = afterReplacer = "";
    } else {
      beforeReplacer = function (s) { that.before += s; return ""; };
      afterReplacer = function (s) { that.after = s + that.after; return ""; };
    }

    this.selection = this.selection
      .replace(/^(\s*)/, beforeReplacer)
      .replace(/(\s*)$/, afterReplacer);
  };

  Chunks.prototype.skipLines = function (nLinesBefore, nLinesAfter, findExtraNewlines) {
    if (nLinesBefore === undefined) {
      nLinesBefore = 1;
    }

    if (nLinesAfter === undefined) {
      nLinesAfter = 1;
    }

    ++nLinesBefore;
    ++nLinesAfter;

    var regexText;
    var replacementText;

    // chrome bug ... documented at:
    // http://meta.stackexchange.com/questions/63307/blockquote-glitch-in-editor-in-chrome-6-and-7/65985#65985
    if (navigator.userAgent.match(/Chrome/)) {
      "X".match(/()./);
    }

    this.selection = this.selection.replace(/(^\n*)/, "");

    this.startTag = this.startTag + re.$1;

    this.selection = this.selection.replace(/(\n*$)/, "");
    this.endTag = this.endTag + re.$1;
    this.startTag = this.startTag.replace(/(^\n*)/, "");
    this.before = this.before + re.$1;
    this.endTag = this.endTag.replace(/(\n*$)/, "");
    this.after = this.after + re.$1;

    if (this.before) {
      regexText = replacementText = "";

      while (nLinesBefore--) {
        regexText += "\\n?";
        replacementText += "\n";
      }

      if (findExtraNewlines) {
        regexText = "\\n*";
      }
      this.before = this.before.replace(new re(regexText + "$", ""), replacementText);
    }

    if (this.after) {
      regexText = replacementText = "";

      while (nLinesAfter--) {
        regexText += "\\n?";
        replacementText += "\n";
      }
      if (findExtraNewlines) {
        regexText = "\\n*";
      }

      this.after = this.after.replace(new re(regexText, ""), replacementText);
    }
  };

  // end of Chunks

  // This is used to implement undo/redo by the undo manager.
  function TextareaState(panels, isInitialState) {
    // Aliases
    var stateObj = this;
    var inputArea = panels.input;
    this.init = function () {
      if (!util.isVisible(inputArea)) {
        return;
      }
      if (!isInitialState && doc.activeElement && doc.activeElement !== inputArea) {
        // this happens when tabbing out of the input box
        return;
      }

      this.setInputAreaSelectionStartEnd();
      this.scrollTop = inputArea.scrollTop;
      if (!this.text && inputArea.selectionStart || inputArea.selectionStart === 0) {
        this.text = inputArea.value;
      }
    };

    // Sets the selected text in the input box after we've performed an
    // operation.
    this.setInputAreaSelection = function () {
      if (!util.isVisible(inputArea)) {
        return;
      }

      if (inputArea.selectionStart !== undefined && !uaSniffed.isOpera) {
        inputArea.focus();
        inputArea.selectionStart = stateObj.start;
        inputArea.selectionEnd = stateObj.end;
        inputArea.scrollTop = stateObj.scrollTop;
      }
      else if (doc.selection) {
        if (doc.activeElement && doc.activeElement !== inputArea) {
          return;
        }

        inputArea.focus();
        var range = inputArea.createTextRange();
        range.moveStart("character", -inputArea.value.length);
        range.moveEnd("character", -inputArea.value.length);
        range.moveEnd("character", stateObj.end);
        range.moveStart("character", stateObj.start);
        range.select();
      }
    };

    this.setInputAreaSelectionStartEnd = function () {
      if (!panels.ieCachedRange && (inputArea.selectionStart || inputArea.selectionStart === 0)) {
        stateObj.start = inputArea.selectionStart;
        stateObj.end = inputArea.selectionEnd;
      } else if (doc.selection) {
        stateObj.text = util.fixEolChars(inputArea.value);

        // IE loses the selection in the textarea when buttons are
        // clicked. On IE we cache the selection. Here, if something is cached,
        // we take it.
        var range = panels.ieCachedRange || doc.selection.createRange();

        var fixedRange = util.fixEolChars(range.text);
        var marker = "\x07";
        var markedRange = marker + fixedRange + marker;
        range.text = markedRange;
        var inputText = util.fixEolChars(inputArea.value);

        range.moveStart("character", -markedRange.length);
        range.text = fixedRange;

        stateObj.start = inputText.indexOf(marker);
        stateObj.end = inputText.lastIndexOf(marker) - marker.length;

        var len = stateObj.text.length - util.fixEolChars(inputArea.value).length;

        if (len) {
          range.moveStart("character", -fixedRange.length);
          while (len--) {
            fixedRange += "\n";
            stateObj.end += 1;
          }
          range.text = fixedRange;
        }

        if (panels.ieCachedRange) {
          // this is set alongside with ieCachedRange
          stateObj.scrollTop = panels.ieCachedScrollTop;
        }

        panels.ieCachedRange = null;

        this.setInputAreaSelection();
      }
    };

    // Restore this state into the input area.
    this.restore = function () {
      if (stateObj.text != null && stateObj.text !== inputArea.value) {
        inputArea.value = stateObj.text;
      }
      this.setInputAreaSelection();
      inputArea.scrollTop = stateObj.scrollTop;
    };

    // Gets a collection of HTML chunks from the inptut textarea.
    this.getChunks = function () {
      var chunk = new Chunks();
      chunk.before = util.fixEolChars(stateObj.text.substring(0, stateObj.start));
      chunk.startTag = "";
      chunk.selection = util.fixEolChars(stateObj.text.substring(stateObj.start,
        stateObj.end));
      chunk.endTag = "";
      chunk.after = util.fixEolChars(stateObj.text.substring(stateObj.end));
      chunk.scrollTop = stateObj.scrollTop;

      return chunk;
    };

    // Sets the TextareaState properties given a chunk of markdown.
    this.setChunks = function (chunk) {
      chunk.before = chunk.before + chunk.startTag;
      chunk.after = chunk.endTag + chunk.after;

      this.start = chunk.before.length;
      this.end = chunk.before.length + chunk.selection.length;
      this.text = chunk.before + chunk.selection + chunk.after;
      this.scrollTop = chunk.scrollTop;
    };

    this.init();
  }

  function UiManager(postfix, panels, previewManager, commandManager, options, getString,
      hooks) {
    var inputBox = panels.input;
    var buttons = {}; // buttons.undo, buttons.link, etc. The actual DOM elements.
    var undoManager = new UndoManager(this, previewManager, panels, hooks);
    this.setCommandMode = undoManager.setCommandMode;

    function bindCommand(method) {
      if (typeof method === "string") {
        method = commandManager[method];
      }
      return function () {
        method.apply(commandManager, arguments);
      };
    }

    // Perform the button's action.
    function doClick(button) {
      inputBox.focus();

      if (button.textOp) {
        undoManager.setCommandMode();

        var state = new TextareaState(panels);

        if (!state) {
          return;
        }

        var chunks = state.getChunks();

        // Some commands launch a "modal" prompt dialog. Javascript
        // can't really make a modal dialog box and the WMD code
        // will continue to execute while the dialog is displayed.
        // This prevents the dialog pattern I'm used to and means
        // I can't do something like this:
        //
        // var link = CreateLinkDialog();
        // makeMarkdownLink(link);
        //
        // Instead of this straightforward method of handling a
        // dialog I have to pass any code which would execute
        // after the dialog is dismissed (e.g. link creation)
        // in a function parameter.
        //
        // Yes this is awkward and I think it sucks, but there's
        // no real workaround. Only the image and link code
        // create dialogs and require the function pointers.
        var fixupInputArea = function () {

          inputBox.focus();

          if (chunks) {
            state.setChunks(chunks);
          }

          state.restore();
          previewManager.refresh();
        };

        var noCleanup = button.textOp(chunks, fixupInputArea);

        if (!noCleanup) {
          fixupInputArea();
        }
      }

      if (button.execute) {
        button.execute(undoManager);
      }
    }

    function setupButton(button, isEnabled) {
      if (isEnabled) {
        button.classList.add('enabled');

        if (!button.isHelp) {
          button.onclick = function () {
            if (this.onmouseout) {
              this.onmouseout();
            }
            doClick(this);
            return false;
          };
        }
      } else {
        button.onmouseover = button.onmouseout = button.onclick = function () {};
        button.classList.remove('enabled');
      }
    }

    function setUndoRedoButtonStates() {
      setupButton(buttons.undo, undoManager.canUndo());
      setupButton(buttons.redo, undoManager.canRedo());
    }

    function makeSpritedButtonRow() {
      var buttonBar = panels.buttonBar;
      var buttonRow = document.createElement("div");
      buttonRow.id = "wmd-button-row" + postfix;
      buttonRow.className = 'wmd-button-row';
      buttonRow.style.display = 'flex';
      buttonRow.style['align-items'] = 'center';
      buttonRow = buttonBar.appendChild(buttonRow);

      var makeButton = function (id, name, textOp, icon) {
        var button = document.createElement("span");
        button.className = "wmd-button icon-" + options.icons[icon || name];
        button.id = id + postfix;
        button.title = getString(name);
        if (textOp) {
          button.textOp = textOp;
        }
        setupButton(button, true);
        buttonRow.appendChild(button);
        return button;
      };

      var makeSpacer = function () {
        var spacer = document.createElement("span");
        spacer.className = "wmd-spacer";
        buttonRow.appendChild(spacer);
      };

      buttons.bold = makeButton("wmd-bold-button", "bold", bindCommand("doBold"));
      buttons.italic = makeButton("wmd-italic-button", "italic", bindCommand("doItalic"));
      makeSpacer(1);
      buttons.link = makeButton("wmd-link-button", "link", bindCommand(
        function (chunk, postProcessing) {
          return this.doLinkOrImage(chunk, postProcessing, false);
        }));
      buttons.quote = makeButton("wmd-quote-button", "quote", bindCommand("doBlockquote"));
      buttons.code = makeButton("wmd-code-button", "code", bindCommand("doCode"));
      buttons.image = makeButton("wmd-image-button", "image",
        bindCommand(function (chunk, postProcessing) {
          return this.doLinkOrImage(chunk, postProcessing, true);
        })
      );

      makeSpacer(2);
      buttons.olist = makeButton("wmd-olist-button", "olist",
        bindCommand(function (chunk, postProcessing) {
          this.doList(chunk, postProcessing, true);
        }));
      buttons.ulist = makeButton("wmd-ulist-button", "ulist",
        bindCommand(function (chunk, postProcessing) {
          this.doList(chunk, postProcessing, false);
        }));
      buttons.heading = makeButton("wmd-heading-button", "heading", bindCommand("doHeading"));
      buttons.hr = makeButton("wmd-hr-button", "hr", bindCommand("doHorizontalRule"));
      makeSpacer(3);
      buttons.undo = makeButton("wmd-undo-button", "undo", null);
      buttons.undo.execute = function (manager) {
        if (manager) {
          manager.undo();
        }
      };

      var redoTitle = /win/.test(nav.platform.toLowerCase()) ? "redo" : "redomac";

      buttons.redo = makeButton("wmd-redo-button", redoTitle, null, "redo");
      buttons.redo.execute = function (manager) {
        if (manager) {
          manager.redo();
        }
      };

      var helpOptions = options.helpButton;
      if (helpOptions != null) {
        var helpButton = makeButton('wmd-help-button', 'help');
        helpButton.style['margin-left'] = 'auto';
        helpButton.isHelp = true;
        helpButton.onclick = helpOptions.handler;
      }

      setUndoRedoButtonStates();
    }

    makeSpritedButtonRow();

    var keyEvent = "keydown";
    if (uaSniffed.isOpera) {
      keyEvent = "keypress";
    }

    util.addEvent(inputBox, keyEvent, function (key) {
      // Check to see if we have a button key and, if so execute the callback.
      if ((key.ctrlKey || key.metaKey) && !key.altKey && !key.shiftKey) {

        var keyCode = key.charCode || key.keyCode;
        var keyCodeStr = String.fromCharCode(keyCode).toLowerCase();

        switch (keyCodeStr) {
          case "b":
            doClick(buttons.bold);
            break;
          case "i":
            doClick(buttons.italic);
            break;
          case "l":
            doClick(buttons.link);
            break;
          case "q":
            doClick(buttons.quote);
            break;
          case "k":
            doClick(buttons.code);
            break;
          case "g":
            doClick(buttons.image);
            break;
          case "o":
            doClick(buttons.olist);
            break;
          case "u":
            doClick(buttons.ulist);
            break;
          case "h":
            doClick(buttons.heading);
            break;
          case "r":
            doClick(buttons.hr);
            break;
          case "y":
            doClick(buttons.redo);
            break;
          case "z":
            if (key.shiftKey) {
              doClick(buttons.redo);
            }
            else {
              doClick(buttons.undo);
            }
            break;
          default:
            return;
        }

        if (key.preventDefault) {
          key.preventDefault();
        }

        if (window.event) {
          window.event.returnValue = false;
        }
      }
    });

    // Auto-indent on shift-enter
    util.addEvent(inputBox, "keyup", function (key) {
      if (key.shiftKey && !key.ctrlKey && !key.metaKey) {
        var keyCode = key.charCode || key.keyCode;
        // Character 13 is Enter
        if (keyCode === 13) {
          var fakeButton = {};
          fakeButton.textOp = bindCommand("doAutoindent");
          doClick(fakeButton);
        }
      }
    });

    // special handler because IE clears the context of the textbox on ESC
    if (uaSniffed.isIe) {
      util.addEvent(inputBox, "keydown", function (key) {
        var code = key.keyCode;
        if (code === 27) {
          return false;
        }
      });
    }

    this.setUndoRedoButtonStates = setUndoRedoButtonStates;
    this.setUndoRedoButtonStates();
  }

  // Handles pushing and popping TextareaStates for undo/redo commands.
  // I should rename the stack variables to list.
  function UndoManager(uiManager, previewManager, panels, hooks) {
    var undoObj = this;
    var undoStack = []; // A stack of undo states
    var stackPtr = 0; // The index of the current state
    var mode = "none";
    var lastState; // The last state
    var timer; // The setTimeout handle for cancelling the timer
    var inputStateObj;

    function refreshPreview(initial) {
      previewManager.refresh();
      if (!initial) {
        uiManager.setUndoRedoButtonStates();
        hooks.onChange();
      }
    }

    // Push the input area state to the stack.
    function saveState(initial) {
      var currState = inputStateObj || new TextareaState(panels);
      if (!currState) {
        return false;
      }

      if (mode === "moving") {
        if (lastState == null) {
          lastState = currState;
        }
        return false;
      }
      if (lastState != null) {
        if (undoStack[stackPtr - 1].text !== lastState.text) {
          undoStack[stackPtr++] = lastState;
        }
        lastState = null;
      }
      undoStack[stackPtr++] = currState;
      undoStack[stackPtr + 1] = null;
      refreshPreview(initial);
    }

    function refreshState(isInitialState) {
      inputStateObj = new TextareaState(panels, isInitialState);
      timer = undefined;
    }

    // Set the mode for later logic steps.
    function setMode(newMode, noSave) {
      if (mode !== newMode) {
        mode = newMode;
        if (!noSave) {
          saveState();
        }
      }

      if (!uaSniffed.isIe || mode !== "moving") {
        timer = setTimeout(refreshState, 1);
      }
      else {
        inputStateObj = null;
      }
    }

    this.setCommandMode = function () {
      mode = "command";
      saveState();
      timer = setTimeout(refreshState, 0);
    };

    this.canUndo = function () {
      return stackPtr > 1;
    };

    this.canRedo = function () {
      if (undoStack[stackPtr + 1]) {
        return true;
      }
      return false;
    };

    // Removes the last state and restores it.
    this.undo = function () {
      if (undoObj.canUndo()) {
        if (lastState) {
          // What about setting state -1 to null or checking for undefined?
          lastState.restore();
          lastState = null;
        }
        else {
          undoStack[stackPtr] = new TextareaState(panels);
          undoStack[--stackPtr].restore();
          refreshPreview();
        }
      }

      mode = "none";
      panels.input.focus();
      refreshState();
    };

    // Redo an action.
    this.redo = function () {
      if (undoObj.canRedo()) {
        undoStack[++stackPtr].restore();
        refreshPreview();
      }

      mode = "none";
      panels.input.focus();
      refreshState();
    };

    var handleCtrlYZ = function (event) {
      var handled = false;

      if ((event.ctrlKey || event.metaKey) && !event.altKey) {

        // IE and Opera do not support charCode.
        var keyCode = event.charCode || event.keyCode;
        var keyCodeChar = String.fromCharCode(keyCode);

        switch (keyCodeChar.toLowerCase()) {

          case "y":
          undoObj.redo();
          handled = true;
          break;

          case "z":
          if (!event.shiftKey) {
            undoObj.undo();
          }
          else {
            undoObj.redo();
          }
          handled = true;
          break;
        }
      }

      if (handled) {
        if (event.preventDefault) {
          event.preventDefault();
        }
        if (window.event) {
          window.event.returnValue = false;
        }
        return;
      }
    };

    // Set the mode depending on what is going on in the input area.
    var handleModeChange = function (event) {
      if (!event.ctrlKey && !event.metaKey) {
        var keyCode = event.keyCode;
        if ((keyCode >= 33 && keyCode <= 40) || (keyCode >= 63232 && keyCode <= 63235)) {
          // 33 - 40: page up/dn and arrow keys
          // 63232 - 63235: page up/dn and arrow keys on safari
          setMode("moving");
        } else if (keyCode === 8 || keyCode === 46 || keyCode === 127) {
          // 8: backspace
          // 46: delete
          // 127: delete
          setMode("deleting");
        } else if (keyCode === 13) {
          // 13: Enter
          setMode("newlines");
        } else if (keyCode === 27) {
          // 27: escape
          setMode("escape");
        } else if ((keyCode < 16 || keyCode > 20) && keyCode !== 91) {
          // 16-20 are shift, etc.
          // 91: left window key
          // I think this might be a little messed up since there are
          // a lot of nonprinting keys above 20.
          setMode("typing");
        }
      }
    };

    function setEventHandlers() {
      util.addEvent(panels.input, "keypress", function (event) {
        // keyCode 89: y
        // keyCode 90: z
        if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.keyCode === 89 ||
            event.keyCode === 90)) {
          event.preventDefault();
        }
      });

      function handlePaste() {
        // Use a timeout to make sure that element has been updated with pasted text
        setTimeout(function () {
          if (uaSniffed.isIe || (inputStateObj && inputStateObj.text !== panels.input.value) &&
              timer == null) {
            mode = "paste";
            saveState();
            refreshState();
          }
        }, 0);
      };

      util.addEvent(panels.input, "keydown", handleCtrlYZ);
      util.addEvent(panels.input, "keydown", handleModeChange);
      util.addEvent(panels.input, "mousedown", function () {
        setMode("moving");
      });

      panels.input.onpaste = handlePaste;
      panels.input.ondrop = handlePaste;
    }

    setEventHandlers();
    refreshState(true);
    saveState(true);
  }

  // end of UndoManager

  // options, if given, can have the following properties:
  //   options.helpButton = { handler: yourEventHandler }
  //   options.strings = { italicexample: "slanted text" }
  // `yourEventHandler` is the click handler for the help button.
  // If `options.helpButton` isn't given, not help button is created.
  // `options.strings` can have any or all of the same properties as
  // `defaultStrings` above, so you can just override some string displayed
  // to the user on a case-by-case basis, or translate all strings to
  // a different language.
  //
  // For backwards compatibility reasons, the `options` argument can also
  // be just the `helpButton` object, and `strings.help` can also be set via
  // `helpButton.title`. This should be considered legacy.
  //
  // The constructed editor object has the methods:
  // - getConverter() returns the markdown converter object that was passed to the constructor
  // - run() actually starts the editor; should be called after all necessary plugins are
  // registered. Calling this more than once is a no-op.
  // - refreshPreview() forces the preview to be updated. This method is only available after
  // run() was called.
  output.Editor = function (markdownConverter, idPostfix, options) {
    options = options || {};

    if (typeof options.handler === "function") { //backwards compatible behavior
      options = { helpButton: options, };
    }
    options.strings = options.strings || {};
    if (options.helpButton) {
      options.strings.help = options.strings.help || options.helpButton.title;
    }
    function getString(identifier) {
      return options.strings[identifier] || defaultsStrings[identifier];
    };

    idPostfix = idPostfix || "";

    var hooks = this.hooks = new HookCollection();
    // Called with no arguments after state has changed
    hooks.addNoop("onChange");
    // called with no arguments after the preview has been refreshed
    hooks.addNoop("onPreviewRefresh");
    // called with the user's selection *after* the blockquote was created; should return the
    // actual to-be-inserted text
    hooks.addNoop("postBlockquoteCreation");
    /* called with one parameter: a callback to be called with the URL of the image.
    * If the application creates * its own image insertion dialog, this hook should return
    * true, and the callback should be called with the chosen image url (or null if the
    * user cancelled). If this hook returns false, the default dialog will be used.
    */
    hooks.addFalse("insertImageDialog");

    this.getConverter = function () { return markdownConverter; };

    var that = this, panels;

    this.getText = function () {
      return panels.input.value;
    };

    this.render = function (text) {
      panels = new PanelCollection(idPostfix, text);
      var commandManager = new CommandManager(hooks, getString, markdownConverter);
      var previewManager = new PreviewManager(markdownConverter, panels, hooks);
      var uiManager = new UiManager(idPostfix, panels, previewManager, commandManager,
        options, getString, hooks);

      this.textOperation = function (f) {
        uiManager.setCommandMode();
        f();
        that.refreshPreview();
      };

      that.refreshPreview = function () {
        previewManager.refresh(true);
      };
      that.refreshPreview();
    };
  };

  // Returns true if the DOM element is visible, false if it's hidden.
  // Checks if display is anything other than none.
  util.isVisible = function (elem) {
    if (window.getComputedStyle) {
      // Most browsers
      return window.getComputedStyle(elem, null).getPropertyValue("display") !== "none";
    } else if (elem.currentStyle) {
      // IE
      return elem.currentStyle.display !== "none";
    }
  };

  // Adds a listener callback to a DOM element which is fired on a specified
  // event.
  util.addEvent = function (elem, event, listener) {
    if (elem.attachEvent) {
      // IE only. The "on" is mandatory.
      elem.attachEvent("on" + event, listener);
    }
    else {
      // Other browsers.
      elem.addEventListener(event, listener, false);
    }
  };

  // Removes a listener callback from a DOM element which is fired on a specified
  // event.
  util.removeEvent = function (elem, event, listener) {
    if (elem.detachEvent) {
      // IE only. The "on" is mandatory.
      elem.detachEvent("on" + event, listener);
    }
    else {
      // Other browsers.
      elem.removeEventListener(event, listener, false);
    }
  };

  // Converts \r\n and \r to \n.
  util.fixEolChars = function (text) {
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/\r/g, "\n");
    return text;
  };

  // Extends a regular expression. Returns a new RegExp
  // using pre + regex + post as the expression.
  // Used in a few functions where we have a base
  // expression and we want to pre- or append some
  // conditions to it (e.g. adding "$" to the end).
  // The flags are unchanged.
  //
  // regex is a RegExp, pre and post are strings.
  util.extendRegExp = function (regex, pre, post) {
    if (pre === null || pre === undefined) {
      pre = "";
    }
    if (post === null || post === undefined) {
      post = "";
    }

    var pattern = regex.toString();
    var flags;

    // Replace the flags with empty space and store them.
    pattern = pattern.replace(/\/([gim]*)$/, function (wholeMatch, flagsPart) {
      flags = flagsPart;
      return "";
    });

    // Remove the slash delimiters on the regular expression.
    pattern = pattern.replace(/(^\/|\/$)/g, "");
    pattern = pre + pattern + post;

    return new re(pattern, flags);
  };

  // UNFINISHED
  // The assignment in the while loop makes jslint cranky.
  // I'll change it to a better loop later.
  position.getTop = function (elem, isInner) {
    var result = elem.offsetTop;
    if (!isInner) {
      while ((elem = elem.offsetParent)) {
        result += elem.offsetTop;
      }
    }
    return result;
  };

  position.getHeight = function (elem) {
    return elem.offsetHeight || elem.scrollHeight;
  };

  position.getWidth = function (elem) {
    return elem.offsetWidth || elem.scrollWidth;
  };

  position.getPageSize = function () {
    var scrollWidth, scrollHeight;
    var innerWidth, innerHeight;

    // It's not very clear which blocks work with which browsers.
    if (self.innerHeight && self.scrollMaxY) {
      scrollWidth = doc.body.scrollWidth;
      scrollHeight = self.innerHeight + self.scrollMaxY;
    }
    else if (doc.body.scrollHeight > doc.body.offsetHeight) {
      scrollWidth = doc.body.scrollWidth;
      scrollHeight = doc.body.scrollHeight;
    }
    else {
      scrollWidth = doc.body.offsetWidth;
      scrollHeight = doc.body.offsetHeight;
    }

    if (self.innerHeight) {
      // Non-IE browser
      innerWidth = self.innerWidth;
      innerHeight = self.innerHeight;
    }
    else if (doc.documentElement && doc.documentElement.clientHeight) {
      // Some versions of IE (IE 6 w/ a DOCTYPE declaration)
      innerWidth = doc.documentElement.clientWidth;
      innerHeight = doc.documentElement.clientHeight;
    }
    else if (doc.body) {
      // Other versions of IE
      innerWidth = doc.body.clientWidth;
      innerHeight = doc.body.clientHeight;
    }

    var maxWidth = Math.max(scrollWidth, innerWidth);
    var maxHeight = Math.max(scrollHeight, innerHeight);
    return [maxWidth, maxHeight, innerWidth, innerHeight, ];
  };

  // Creates the background behind the hyperlink text entry box.
  // And download dialog
  // Most of this has been moved to CSS but the div creation and
  // browser-specific hacks remain here.
  ui.createBackground = function () {
    var background = doc.createElement("div"),
    style = background.style;

    background.className = "wmd-prompt-background";

    style.position = "absolute";
    style.top = "0";

    style.zIndex = "1000";

    if (uaSniffed.isIe) {
      style.filter = "alpha(opacity=50)";
    }
    else {
      style.opacity = "0.5";
    }

    var pageSize = position.getPageSize();
    style.height = pageSize[1] + "px";

    if (uaSniffed.isIe) {
      style.left = doc.documentElement.scrollLeft;
      style.width = doc.documentElement.clientWidth;
    }
    else {
      style.left = "0";
      style.width = "100%";
    }

    doc.body.appendChild(background);
    return background;
  };

  // This simulates a modal dialog box and asks for the URL when you
  // click the hyperlink or image buttons.
  //
  // text: The html for the input box.
  // defaultInputText: The default value that appears in the input box.
  // callback: The function which is executed when the prompt is dismissed,
  // either via OK or Cancel. It receives a single argument; either the
  // entered text (if OK was chosen) or null (if Cancel was chosen).
  ui.prompt = function (text, defaultInputText, callback) {
    // These variables need to be declared at this level since they are used
    // in multiple functions.
    var dialog;         // The dialog box.
    var input;         // The text box where you enter the hyperlink.
    var close;

    // Used as a keydown event handler. Esc dismisses the prompt.
    // Key code 27 is ESC.
    var checkEscape = function (key) {
      var code = (key.charCode || key.keyCode);
      if (code === 27) {
        if (key.stopPropagation) {
          key.stopPropagation();
        }
        close(true);
        return false;
      }
    };

    // Dismisses the hyperlink input box.
    // isCancel is true if we don't care about the input text.
    // isCancel is false if we are going to keep the text.
    close = function (isCancel) {
      util.removeEvent(doc.body, "keyup", checkEscape);
      var inputText = input.value;

      if (isCancel) {
        inputText = null;
      }
      else {
        // Fixes common pasting errors.
        inputText = inputText.replace(/^http:\/\/(https?|ftp):\/\//, '$1://');
        if (!/^(?:https?|ftp):\/\//.test(inputText)) {
          inputText = 'http://' + inputText;
        }
      }

      dialog.parentNode.removeChild(dialog);

      callback(inputText);
      return false;
    };

    if (defaultInputText === undefined) {
      defaultInputText = "";
    }

    // Create the text input box form/window.
    var createDialog = function () {
      // The main dialog box.
      dialog = doc.createElement("div");
      dialog.className = "wmd-prompt-dialog";
      dialog.style.padding = "10px;";
      dialog.style.position = "fixed";
      dialog.style.width = "400px";
      dialog.style.zIndex = "1001";

      // The dialog text.
      var question = doc.createElement("div");
      question.innerHTML = text;
      question.style.padding = "5px";
      dialog.appendChild(question);

      // The web form container for the text box and buttons.
      var form = doc.createElement("form"),
      style = form.style;
      form.onsubmit = function () { return close(false); };
      style.padding = "0";
      style.margin = "0";
      style.cssFloat = "left";
      style.width = "100%";
      style.textAlign = "center";
      style.position = "relative";
      dialog.appendChild(form);

      // The input text box
      input = doc.createElement("input");
      input.type = "text";
      input.value = defaultInputText;
      style = input.style;
      style.display = "block";
      style.width = "80%";
      style.marginLeft = style.marginRight = "auto";
      form.appendChild(input);

      // The ok button
      var okButton = doc.createElement("button");
      okButton.onclick = function () { return close(false); };
      okButton.className = 'pure-button pure-button-primary';
      okButton.innerHTML = "OK";
      style = okButton.style;
      style.margin = "10px";
      style.width = "7em";

      // The cancel button
      var cancelButton = doc.createElement("button");
      cancelButton.onclick = function () { return close(true); };
      cancelButton.className = 'pure-button';
      cancelButton.innerHTML = "Cancel";
      style = cancelButton.style;
      style.margin = "10px";
      style.width = "7em";

      form.appendChild(okButton);
      form.appendChild(cancelButton);

      util.addEvent(doc.body, "keyup", checkEscape);
      dialog.style.top = "50%";
      dialog.style.left = "50%";
      dialog.style.display = "block";
      if (uaSniffed.isIe5or6) {
        dialog.style.position = "absolute";
        dialog.style.top = doc.documentElement.scrollTop + 200 + "px";
        dialog.style.left = "50%";
      }
      doc.body.appendChild(dialog);

      // This has to be done AFTER adding the dialog to the form if you
      // want it to be centered.
      dialog.style.marginTop = -(position.getHeight(dialog) / 2) + "px";
      dialog.style.marginLeft = -(position.getWidth(dialog) / 2) + "px";
    };

    // Why is this in a zero-length timeout?
    // Is it working around a browser bug?
    setTimeout(function () {
      createDialog();

      var defTextLen = defaultInputText.length;
      if (input.selectionStart !== undefined) {
        input.selectionStart = 0;
        input.selectionEnd = defTextLen;
      }
      else if (input.createTextRange) {
        var range = input.createTextRange();
        range.collapse(false);
        range.moveStart("character", -defTextLen);
        range.moveEnd("character", defTextLen);
        range.select();
      }

      input.focus();
    }, 0);
  };

  var commandProto = CommandManager.prototype;

  // The markdown symbols - 4 spaces = code, > = blockquote, etc.
  commandProto.prefixes = "(?:\\s{4,}|\\s*>|\\s*-\\s+|\\s*\\d+\\.|=|\\+|-|_|\\*|#|\\s*" +
    "\\[[^\n]]+\\]:)";

  // Remove markdown symbols from the chunk selection.
  commandProto.unwrap = function (chunk) {
    var txt = new re("([^\\n])\\n(?!(\\n|" + this.prefixes + "))", "g");
    chunk.selection = chunk.selection.replace(txt, "$1 $2");
  };

  commandProto.wrap = function (chunk, len) {
    this.unwrap(chunk);
    var regex = new re("(.{1," + len + "})( +|$\\n?)", "gm"),
    that = this;

    chunk.selection = chunk.selection.replace(regex, function (line, marked) {
      if (new re("^" + that.prefixes, "").test(line)) {
        return line;
      }
      return marked + "\n";
    });

    chunk.selection = chunk.selection.replace(/\s+$/, "");
  };

  commandProto.doBold = function (chunk, postProcessing) {
    return this.doBorI(chunk, postProcessing, 2, this.getString("boldexample"));
  };

  commandProto.doItalic = function (chunk, postProcessing) {
    return this.doBorI(chunk, postProcessing, 1, this.getString("italicexample"));
  };

  // chunk: The selected region that will be enclosed with */**
  // nStars: 1 for italics, 2 for bold
  // insertText: If you just click the button without highlighting text,
  // this gets inserted
  commandProto.doBorI = function (chunk, postProcessing, nStars, insertText) {
    // Get rid of whitespace and fixup newlines.
    chunk.trimWhitespace();
    chunk.selection = chunk.selection.replace(/\n{2,}/g, "\n");

    // Look for stars before and after. Is the chunk already marked up?
    // note that these regex matches cannot fail
    var starsBefore = /(\**$)/.exec(chunk.before)[0];
    var starsAfter = /(^\**)/.exec(chunk.after)[0];

    var prevStars = Math.min(starsBefore.length, starsAfter.length);

    // Remove stars if we have to since the button acts as a toggle.
    if ((prevStars >= nStars) && (prevStars !== 2 || nStars !== 1)) {
      chunk.before = chunk.before.replace(re("[*]{" + nStars + "}$", ""), "");
      chunk.after = chunk.after.replace(re("^[*]{" + nStars + "}", ""), "");
    }
    else if (!chunk.selection && starsAfter) {
      // It's not really clear why this code is necessary. It just moves
      // some arbitrary stuff around.
      chunk.after = chunk.after.replace(/^([*_]*)/, "");
      chunk.before = chunk.before.replace(/(\s?)$/, "");
      var whitespace = re.$1;
      chunk.before = chunk.before + starsAfter + whitespace;
    }
    else {

      // In most cases, if you don't have any selected text and click the button
      // you'll get a selected, marked up region with the default text inserted.
      if (!chunk.selection && !starsAfter) {
        chunk.selection = insertText;
      }

      // Add the true markup.
      var markup = nStars <= 1 ? "*" : "**"; // shouldn't the test be = ?
      chunk.before = chunk.before + markup;
      chunk.after = markup + chunk.after;
    }

    return;
  };

  commandProto.stripLinkDefs = function (text, defsToAdd) {
    text = text.replace(
      /^[ ]{0,3}\[(\d+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|$)/gm,
      function (totalMatch, id, link, newlines, title) {
        defsToAdd[id] = totalMatch.replace(/\s*$/, "");
        if (newlines) {
          // Strip the title and return that separately.
          defsToAdd[id] = totalMatch.replace(/["(](.+?)[")]$/, "");
          return newlines + title;
        }
        return "";
      });

    return text;
  };

  commandProto.addLinkDef = function (chunk, linkDef) {
    var refNumber = 0; // The current reference number
    var defsToAdd = {}; //
    // Start with a clean slate by removing all previous link definitions.
    chunk.before = this.stripLinkDefs(chunk.before, defsToAdd);
    chunk.selection = this.stripLinkDefs(chunk.selection, defsToAdd);
    chunk.after = this.stripLinkDefs(chunk.after, defsToAdd);

    var defs = "";
    var regex = /(\[)((?:\[[^\]]*\]|[^\[\]])*)(\][ ]?(?:\n[ ]*)?\[)(\d+)(\])/g;

    // The above regex, used to update [foo][13] references after renumbering,
    // is much too liberal; it can catch things that are not actually parsed
    // as references (notably: code). It's impossible to know which matches are
    // real references without performing a markdown conversion, so that's what
    // we do. All matches are replaced with a unique reference number, which is
    // given a unique link. The uniquifier in both cases is the character offset
    // of the match inside the source string. The modified version is then sent
    // through the Markdown renderer. Because link reference are stripped during
    // rendering, the unique link is present in the rendered version if and only
    // if the match at its offset was in fact rendered as a link or image.
    var complete = chunk.before + chunk.selection + chunk.after;
    var rendered = this.converter.makeHtml(complete);
    var testlink = "http://this-is-a-real-link.biz/";

    // If our fake link appears in the rendered version *before* we have added it,
    // this probably means you're a Meta Stack Exchange user who is deliberately
    // trying to break this feature. You can still break this workaround if you
    // attach a plugin to the converter that sometimes (!) inserts this link. In
    // that case, consider yourself unsupported.
    while (rendered.indexOf(testlink) !== -1) {
      testlink += "nicetry/";
    }

    var fakedefs = "\n\n";

    // the regex is tested on the (up to) three chunks separately, and on substrings,
    // so in order to have the correct offsets to check against okayToModify(), we
    // have to keep track of how many characters are in the original source before
    // the substring that we're looking at. Note that doLinkOrImage aligns the
    // selection on potential brackets, so there should be no major breakage
    // from the chunk separation.
    var skippedChars = 0;

    var uniquified = complete.replace(regex, function uniquify(wholeMatch, before, inner,
        afterInner, id, end, offset) {
      skippedChars += offset;
      fakedefs += " [" + skippedChars + "]: " + testlink + skippedChars +
      "/unicorn\n";
      skippedChars += before.length;
      inner = inner.replace(regex, uniquify);
      skippedChars -= before.length;
      var result = before + inner + afterInner + skippedChars + end;
      skippedChars -= offset;
      return result;
    });

    rendered = this.converter.makeHtml(uniquified + fakedefs);

    var okayToModify = function(offset) {
      return rendered.indexOf(testlink + offset + "/unicorn") !== -1;
    };

    var addDefNumber = function (def) {
      refNumber++;
      def = def.replace(/^[ ]{0,3}\[(\d+)\]:/, "  [" + refNumber + "]:");
      defs += "\n" + def;
    };

    // note that
    // a) the recursive call to getLink cannot go infinite, because by
    // definition of regex, inner is always a proper substring of wholeMatch,
    // and b) more than one level of nesting is neither supported by the regex
    // nor making a lot of sense (the only use case for nesting is a linked
    // image)
    var getLink = function (wholeMatch, before, inner, afterInner, id, end, offset) {
      if (!okayToModify(skippedChars + offset)) {
        return wholeMatch;
      }
      skippedChars += offset + before.length;
      inner = inner.replace(regex, getLink);
      skippedChars -= offset + before.length;
      if (defsToAdd[id]) {
        addDefNumber(defsToAdd[id]);
        return before + inner + afterInner + refNumber + end;
      }
      return wholeMatch;
    };

    var len = chunk.before.length;
    chunk.before = chunk.before.replace(regex, getLink);
    skippedChars += len;

    len = chunk.selection.length;
    if (linkDef) {
      addDefNumber(linkDef);
    } else {
      chunk.selection = chunk.selection.replace(regex, getLink);
    }
    skippedChars += len;

    var refOut = refNumber;

    chunk.after = chunk.after.replace(regex, getLink);

    if (chunk.after) {
      chunk.after = chunk.after.replace(/\n*$/, "");
    }
    if (!chunk.after) {
      chunk.selection = chunk.selection.replace(/\n*$/, "");
    }

    chunk.after += "\n\n" + defs;

    return refOut;
  };

  // takes the line as entered into the add link/as image dialog and makes
  // sure the URL and the optinal title are "nice".
  function properlyEncoded(linkdef) {
    return linkdef.replace(/^\s*(.*?)(?:\s+"(.+)")?\s*$/, function (wholematch, link, title) {
      var inQueryString = false;

      // Having `[^\w\d-./]` in there is just a shortcut that lets us skip
      // the most common characters in URLs. Replacing that it with `.`
      // would not change the result, because encodeURI returns those
      // characters unchanged, but it would mean lots of unnecessary
      // replacement calls. Having `[` and `]` in that section as well
      // means we do *not* enocde square brackets. These characters are
      // a strange beast in URLs, but if anything, this causes URLs to be
      // more readable, and we leave it to the browser to make sure that
      // these links are handled without problems.
      link = link.replace(/%(?:[\da-fA-F]{2})|\?|\+|[^\w\d-./[\]]/g, function (match) {
        // Valid percent encoding. Could just return it as is, but we follow RFC3986
        // Section 2.1 which says "For consistency, URI producers and normalizers
        // should use uppercase hexadecimal digits for all percent-encodings."
        // Note that we also handle (illegal) stand-alone percent characters by
        // replacing them with "%25"
        if (match.length === 3 && match.charAt(0) === "%") {
          return match.toUpperCase();
        }
        switch (match) {
          case "?":
            inQueryString = true;
            return "?";
          // In the query string, a plus and a space are identical --
          // normalize.
          // Not strictly necessary, but identical behavior to the previous
          // version of this function.
          case "+":
            if (inQueryString) {
              return "%20";
            }
            break;
        }
        return encodeURI(match);
      });

      if (title) {
        title = title.trim ? title.trim() : title.replace(/^\s*/, "")
          .replace(/\s*$/, "");
        title = title.replace(/"/g, "quot;").replace(/\(/g, "&#40;")
          .replace(/\)/g, "&#41;")
          .replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      return title ? link + ' "' + title + '"' : link;
    });
  }

  commandProto.doLinkOrImage = function (chunk, postProcessing, isImage) {
    chunk.trimWhitespace();
    chunk.findTags(/\s*!?\[/, /\][ ]?(?:\n[ ]*)?(\[.*?\])?/);
    var background;

    if (chunk.endTag.length > 1 && chunk.startTag.length > 0) {
      chunk.startTag = chunk.startTag.replace(/!?\[/, "");
      chunk.endTag = "";
      this.addLinkDef(chunk, null);
    } else {
      // We're moving start and end tag back into the selection, since
      // (as we're in the else block) we're not *removing* a link, but
      // *adding* one, so whatever findTags() found is now back to being
      // part of the link text. linkEnteredCallback takes care of escaping
      // any brackets.
      chunk.selection = chunk.startTag + chunk.selection + chunk.endTag;
      chunk.startTag = chunk.endTag = "";

      if (/\n\n/.test(chunk.selection)) {
        this.addLinkDef(chunk, null);
        return false;
      }
      var that = this;
      // The function to be executed when you enter a link and press OK or
      // Cancel.
      // Marks up the link and adds the ref.
      var linkEnteredCallback = function (link) {
        background.parentNode.removeChild(background);

        if (link != null) {
          // (                          $1
          //     [^\\]                  anything that's not a backslash
          //     (?:\\\\)*              an even number (this includes zero)
          // of backslashes
          // )
          // (?=                        followed by
          //     [[\]]                  an opening or closing bracket
          // )
          //
          // In other words, a non-escaped bracket. These have to be escaped now to make sure they
          // don't count as the end of the link or similar.
          // Note that the actual bracket has to be a lookahead, because (in case of two
          // subsequent brackets), the bracket in one match may be the "not a backslash"
          // character in the next match, so it/ should not be consumed by the first match.
          // The "prepend a space and finally remove it" steps makes sure there is a
          // "not a backslash" at the start of the string, so this also works if the selection
          // begins with a bracket. We cannot solve this by anchoring with ^, because in the case
          // that the selection starts with two brackets, this would mean a zero-width match at
          // the start. Since zero-width matches advance the string position, the first
          // bracket could then not act as the "not a backslash" for the second.
          chunk.selection = (" " + chunk.selection).replace(/([^\\](?:\\\\)*)(?=[[\]])/g, "$1\\")
            .substr(1);

          var linkDef = " [999]: " + properlyEncoded(link);

          var num = that.addLinkDef(chunk, linkDef);
          chunk.startTag = isImage ? "![" : "[";
          chunk.endTag = "][" + num + "]";

          if (!chunk.selection) {
            if (isImage) {
              chunk.selection = that.getString("imagedescription");
            }
            else {
              chunk.selection = that.getString("linkdescription");
            }
          }
        }
        postProcessing();
      };

      background = ui.createBackground();

      if (isImage) {
        if (!this.hooks.insertImageDialog(linkEnteredCallback)) {
          ui.prompt(this.getString("imagedialog"), imageDefaultText,
          linkEnteredCallback);
        }
      } else {
        ui.prompt(this.getString("linkdialog"), linkDefaultText,
        linkEnteredCallback);
      }
      return true;
    }
  };

// When making a list, hitting shift-enter will put your cursor on the
// next line at the current indent level.
commandProto.doAutoindent = function (chunk) {
var commandMgr = this,
fakeSelection = false;

chunk.before = chunk.before.replace(
  /(\n|^)[ ]{0,3}([*+-]|\d+[.])[ \t]*\n$/, "\n\n");
  chunk.before = chunk.before.replace(
    /(\n|^)[ ]{0,3}>[ \t]*\n$/, "\n\n");
    chunk.before = chunk.before.replace(/(\n|^)[ \t]+\n$/, "\n\n");

    // There's no selection, end the cursor wasn't at the end of the line:
    // The user wants to split the current list item / code line / blockquote
    // line (for the latter it doesn't really matter) in two. Temporarily
    // select the (rest of the) line to achieve this.
    if (!chunk.selection && !/^[ \t]*(?:\n|$)/.test(chunk.after)) {
      chunk.after = chunk.after.replace(/^[^\n]*/, function (wholeMatch) {
        chunk.selection = wholeMatch;
        return "";
      });
      fakeSelection = true;
    }

    if (/(\n|^)[ ]{0,3}([*+-]|\d+[.])[ \t]+.*\n$/.test(chunk.before)) {
      if (commandMgr.doList) {
        commandMgr.doList(chunk);
      }
    }
    if (/(\n|^)[ ]{0,3}>[ \t]+.*\n$/.test(chunk.before)) {
      if (commandMgr.doBlockquote) {
        commandMgr.doBlockquote(chunk);
      }
    }
    if (/(\n|^)(\t|[ ]{4,}).*\n$/.test(chunk.before)) {
      if (commandMgr.doCode) {
        commandMgr.doCode(chunk);
      }
    }

    if (fakeSelection) {
      chunk.after = chunk.selection + chunk.after;
      chunk.selection = "";
    }
  };

        commandProto.doBlockquote = function (chunk) {
          chunk.selection = chunk.selection.replace(/^(\n*)([^\r]+?)(\n*)$/,
          function (totalMatch, newlinesBefore, text, newlinesAfter) {
            chunk.before += newlinesBefore;
            chunk.after = newlinesAfter + chunk.after;
            return text;
          });

          chunk.before = chunk.before.replace(/(>[ \t]*)$/,
          function (totalMatch, blankLine) {
            chunk.selection = blankLine + chunk.selection;
            return "";
          });

          chunk.selection = chunk.selection.replace(/^(\s|>)+$/, "");
          chunk.selection = chunk.selection || this.getString("quoteexample");

          // The original code uses a regular expression to find out how much of the
          // text *directly before* the selection already was a blockquote:

          /*
          if (chunk.before) {
          chunk.before = chunk.before.replace(/\n?$/, "\n");
        }
        chunk.before = chunk.before.replace(/(((\n|^)(\n[ \t]*)*>(.+\n)*.*)+(\n[ \t]*)*$)/,
        function (totalMatch) {
        chunk.startTag = totalMatch;
        return "";
      });
      */

      // This comes down to:
      // Go backwards as many lines a possible, such that each line
      //  a) starts with ">", or
      //  b) is almost empty, except for whitespace, or
      //  c) is preceeded by an unbroken chain of non-empty lines
      //     leading up to a line that starts with ">" and at least one more character
      // and in addition
      //  d) at least one line fulfills a)
      //
      // Since this is essentially a backwards-moving regex, it's susceptible to
      // catstrophic backtracking and can cause the browser to hang;
      // see e.g. http://meta.stackexchange.com/questions/9807.
      //
      // Hence we replaced this by a simple state machine that just goes through the
      // lines and checks for a), b), and c).

      var match = "",
      leftOver = "",
      line;
      if (chunk.before) {
        var lines = chunk.before.replace(/\n$/, "").split("\n");
        var inChain = false;
        for (var i = 0; i < lines.length; i++) {
          var good = false;
          line = lines[i];
          inChain = inChain && line.length > 0; // c) any non-empty line continues the chain
          if (/^>/.test(line)) {                // a)
            good = true;
            if (!inChain && line.length > 1) {
              // c) any line that starts with ">" and has at least one more character
              // starts the chain
              inChain = true;
            }
          } else if (/^[ \t]*$/.test(line)) {   // b)
            good = true;
          } else {
            // c) the line is not empty and does not start with ">", so it matches if and
            // only if we're in the chain
            good = inChain;
          }
          if (good) {
            match += line + "\n";
          } else {
            leftOver += match + line;
            match = "\n";
          }
        }
        if (!/(^|\n)>/.test(match)) {             // d)
          leftOver += match;
          match = "";
        }
      }

      chunk.startTag = match;
      chunk.before = leftOver;

      // end of change

      if (chunk.after) {
        chunk.after = chunk.after.replace(/^\n?/, "\n");
      }

      chunk.after = chunk.after.replace(/^(((\n|^)(\n[ \t]*)*>(.+\n)*.*)+(\n[ \t]*)*)/,
      function (totalMatch) {
        chunk.endTag = totalMatch;
        return "";
      }
    );

    var replaceBlanksInTags = function (useBracket) {

      var replacement = useBracket ? "> " : "";

      if (chunk.startTag) {
        chunk.startTag = chunk.startTag.replace(/\n((>|\s)*)\n$/,
        function (totalMatch, markdown) {
          return "\n" + markdown.replace(/^[ ]{0,3}>?[ \t]*$/gm, replacement) + "\n";
        });
      }
      if (chunk.endTag) {
        chunk.endTag = chunk.endTag.replace(/^\n((>|\s)*)\n/,
        function (totalMatch, markdown) {
          return "\n" + markdown.replace(/^[ ]{0,3}>?[ \t]*$/gm, replacement) + "\n";
        });
      }
    };

    if (/^(?![ ]{0,3}>)/m.test(chunk.selection)) {
      this.wrap(chunk, SETTINGS.lineLength - 2);
      chunk.selection = chunk.selection.replace(/^/gm, "> ");
      replaceBlanksInTags(true);
      chunk.skipLines();
    } else {
      chunk.selection = chunk.selection.replace(/^[ ]{0,3}> ?/gm, "");
      this.unwrap(chunk);
      replaceBlanksInTags(false);

      if (!/^(\n|^)[ ]{0,3}>/.test(chunk.selection) && chunk.startTag) {
        chunk.startTag = chunk.startTag.replace(/\n{0,2}$/, "\n\n");
      }

      if (!/(\n|^)[ ]{0,3}>.*$/.test(chunk.selection) && chunk.endTag) {
        chunk.endTag = chunk.endTag.replace(/^\n{0,2}/, "\n\n");
      }
    }

    chunk.selection = this.hooks.postBlockquoteCreation(chunk.selection);

    if (!/\n/.test(chunk.selection)) {
      chunk.selection = chunk.selection.replace(/^(> *)/,
      function (wholeMatch, blanks) {
        chunk.startTag += blanks;
        return "";
      });
    }
  };

  commandProto.doCode = function (chunk) {
    var hasTextBefore = /\S[ ]*$/.test(chunk.before);
    var hasTextAfter = /^[ ]*\S/.test(chunk.after);

    // Use 'four space' markdown if the selection is on its own
    // line or is multiline.
    if ((!hasTextAfter && !hasTextBefore) || /\n/.test(chunk.selection)) {
      chunk.before = chunk.before.replace(/[ ]{4}$/, function (totalMatch) {
        chunk.selection = totalMatch + chunk.selection;
        return "";
      });

      var nLinesBack = 1;
      var nLinesForward = 1;

      if (/(\n|^)(\t|[ ]{4,}).*\n$/.test(chunk.before)) {
        nLinesBack = 0;
      }
      if (/^\n(\t|[ ]{4,})/.test(chunk.after)) {
        nLinesForward = 0;
      }

      chunk.skipLines(nLinesBack, nLinesForward);

      if (!chunk.selection) {
        chunk.startTag = "    ";
        chunk.selection = this.getString("codeexample");
      }
      else {
        if (/^[ ]{0,3}\S/m.test(chunk.selection)) {
          if (/\n/.test(chunk.selection)) {
            chunk.selection = chunk.selection.replace(/^/gm, "    ");
          } else {
            // if it's not multiline, do not select the four added spaces; this is
            // more consistent with the doList behavior
            chunk.before += "    ";
          }
        }
        else {
          chunk.selection = chunk.selection.replace(/^(?:[ ]{4}|[ ]{0,3}\t)/gm, "");
        }
      }
    } else {
      // Use backticks (`) to delimit the code block.
      chunk.trimWhitespace();
      chunk.findTags(/`/, /`/);

      if (!chunk.startTag && !chunk.endTag) {
        chunk.startTag = chunk.endTag = "`";
        if (!chunk.selection) {
          chunk.selection = this.getString("codeexample");
        }
      }
      else if (chunk.endTag && !chunk.startTag) {
        chunk.before += chunk.endTag;
        chunk.endTag = "";
      }
      else {
        chunk.startTag = chunk.endTag = "";
      }
    }
  };

  commandProto.doList = function (chunk, postProcessing, isNumberedList) {
    // These are identical except at the very beginning and end.
    // Should probably use the regex extension function to make this clearer.
    var previousItemsRegex = /(\n|^)(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*$/;
    var nextItemsRegex = /^\n*(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*/;

    // The default bullet is a dash but others are possible.
    // This has nothing to do with the particular HTML bullet,
    // it's just a markdown bullet.
    var bullet = "-";

    // The number in a numbered list.
    var num = 1;

    // Get the item prefix - e.g. " 1. " for a numbered list, " - " for a bulleted list.
    var getItemPrefix = function () {
      var prefix;
      if (isNumberedList) {
        prefix = " " + num + ". ";
        num++;
      }
      else {
        prefix = " " + bullet + " ";
      }
      return prefix;
    };

    // Fixes the prefixes of the other list items.
    var getPrefixedItem = function (itemText) {

      // The numbering flag is unset when called by autoindent.
      if (isNumberedList === undefined) {
        isNumberedList = /^\s*\d/.test(itemText);
      }

      // Renumber/bullet the list element.
      itemText = itemText.replace(/^[ ]{0,3}([*+-]|\d+[.])\s/gm,
      function () {
        return getItemPrefix();
      });

      return itemText;
    };

    chunk.findTags(/(\n|^)*[ ]{0,3}([*+-]|\d+[.])\s+/, null);

    if (chunk.before && !/\n$/.test(chunk.before) && !/^\n/.test(chunk.startTag)) {
      chunk.before += chunk.startTag;
      chunk.startTag = "";
    }

    if (chunk.startTag) {

      var hasDigits = /\d+[.]/.test(chunk.startTag);
      chunk.startTag = "";
      chunk.selection = chunk.selection.replace(/\n[ ]{4}/g, "\n");
      this.unwrap(chunk);
      chunk.skipLines();

      if (hasDigits) {
        // Have to renumber the bullet points if this is a numbered list.
        chunk.after = chunk.after.replace(nextItemsRegex, getPrefixedItem);
      }
      if (isNumberedList === hasDigits) {
        return;
      }
    }

    var nLinesUp = 1;

    chunk.before = chunk.before.replace(previousItemsRegex,
      function (itemText) {
        if (/^\s*([*+-])/.test(itemText)) {
          bullet = re.$1;
        }
        nLinesUp = /[^\n]\n\n[^\n]/.test(itemText) ? 1 : 0;
        return getPrefixedItem(itemText);
      });

      if (!chunk.selection) {
        chunk.selection = this.getString("litem");
      }

      var prefix = getItemPrefix();

      var nLinesDown = 1;

      chunk.after = chunk.after.replace(nextItemsRegex, function (itemText) {
        nLinesDown = /[^\n]\n\n[^\n]/.test(itemText) ? 1 : 0;
        return getPrefixedItem(itemText);
      });

      chunk.trimWhitespace(true);
      chunk.skipLines(nLinesUp, nLinesDown, true);
      chunk.startTag = prefix;
      var spaces = prefix.replace(/./g, " ");
      this.wrap(chunk, SETTINGS.lineLength - spaces.length);
      chunk.selection = chunk.selection.replace(/\n/g, "\n" + spaces);
    };

  commandProto.doHeading = function (chunk) {
    // Remove leading/trailing whitespace and reduce internal spaces to
    //   single spaces.
    chunk.selection = chunk.selection.replace(/\s+/g, " ");
    chunk.selection = chunk.selection.replace(/(^\s+|\s+$)/g, "");

    // If we clicked the button with no selected text, we just
    // make a level 2 hash header around some default text.
    if (!chunk.selection) {
      chunk.startTag = "## ";
      chunk.selection = this.getString("headingexample");
      chunk.endTag = " ##";
      return;
    }

    var headerLevel = 0;     // The existing header level of the selected text.

    // Remove any existing hash heading markdown and save the header level.
    chunk.findTags(/#+[ ]*/, /[ ]*#+/);
    if (/#+/.test(chunk.startTag)) {
      headerLevel = re.lastMatch.length;
    }
    chunk.startTag = chunk.endTag = "";

    // Try to get the current header level by looking for - and = in the line
    // below the selection.
    chunk.findTags(null, /\s?(-+|=+)/);
    if (/=+/.test(chunk.endTag)) {
      headerLevel = 1;
    }
    if (/-+/.test(chunk.endTag)) {
      headerLevel = 2;
    }

    // Skip to the next line so we can create the header markdown.
    chunk.startTag = chunk.endTag = "";
    chunk.skipLines(1, 1);

    // We make a level 2 header if there is no current header.
    // If there is a header level, we substract one from the header level.
    // If it's already a level 1 header, it's removed.
    var headerLevelToCreate = headerLevel === 0 ? 2 : headerLevel - 1;

    if (headerLevelToCreate > 0) {
      // The button only creates level 1 and 2 underline headers.
      // Why not have it iterate over hash header levels?  Wouldn't that be
      // easier and cleaner?
      var headerChar = headerLevelToCreate >= 2 ? "-" : "=";
      var len = chunk.selection.length;
      if (len > SETTINGS.lineLength) {
        len = SETTINGS.lineLength;
      }
      chunk.endTag = "\n";
      while (len--) {
        chunk.endTag += headerChar;
      }
    }
  };

  commandProto.doHorizontalRule = function (chunk) {
    chunk.startTag = "----------\n";
    chunk.selection = "";
    chunk.skipLines(2, 1, true);
  };
})();
