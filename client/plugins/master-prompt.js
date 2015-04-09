/**
 * Plugin to allow access to nucleus-master-prompt to other plugins.
 * Plugins like fuzzy-find-file should be able to register with this plugin
 * to get called when user enter their keybinding. Input from the prompt is
 * given to registered plugin and it should return an array of output values
 */

MasterPrompt = function(NucleusClient) {
  this._registeredPlugins = [];
  this.promptIn = new ReactiveVar();
  this.promptOut = new ReactiveVar([]);
  this.showPrompt = new ReactiveVar();
  this.selectedPlugin = new ReactiveVar(null); //input is sent to selectedPlugin and output is shown in prompt
  this.selectedPromptItem = new ReactiveVar(0);  //item which user has selected

  this.selectedPromptItem.inc = function() {
    var curVal = this.get(),
        resLength = NucleusClient.MasterPrompt.promptOut.get().length;

    if (curVal >= resLength) {
      curVal = resLength;
    } else {
      curVal += 1;
    }

    this.set(curVal);
  };
  this.selectedPromptItem.dec = function() {
    var curVal = this.get();

    if (curVal <= 0) {
      curVal = 0;
    } else {
      curVal -= 1;
    }

    this.set(curVal);
  };
};

MasterPrompt.prototype.registerPlugin = function(plugin) {
  /**
   * Register `plugin` to use MasterPrompt.
   * `plugin` must be an object with these two properties:
   * - kbd  * string or array of strings representing the keybinding when prompt shall be called
   * - promptResults  * function accepting prompt input and returning array of outputs
   */
  var self = this;
  if (_.isArray(plugin.kbd))
    plugin.kbd.forEach(function(kbd) {
      NucleusClient.kbd.add(kbd, function() {
        self.togglePrompt(plugin);
      });
    });
  else
    NucleusClient.kbd.add(plugin.kbd, function() {
      this.togglePrompt(plugin);
    }.bind(this));

  this._registeredPlugins.push(plugin);
};

MasterPrompt.prototype.togglePrompt = function(plugin) {
  if (this.showPrompt.get() && this.selectedPlugin.get() == plugin) {
    this.hidePrompt();
    NucleusClient.Editor.editor.focus();
    return;
  }
  this.showPromptWith(plugin);
};

MasterPrompt.prototype.showPromptWith = function(plugin) {
  this.selectedPlugin.set(plugin);
  this.showPrompt.set(true);
};

MasterPrompt.prototype.hidePrompt = function() {
  this.selectedPlugin.set(null);
  this.showPrompt.set(false);
  this.selectedPromptItem.set(0);
};

MasterPrompt.prototype.itemSelected = function(val) {
  this.selectedPlugin.get().itemSelected(val);
};

MasterPrompt.prototype.exec = function(NucleusClient) {
  NucleusClient.MasterPrompt = this;
  var self = this;

  Tracker.autorun(function() {
    var selectedPlugin = self.selectedPlugin.get();

    if (! selectedPlugin)
      return;

    var input = self.promptIn.get(),
        output = selectedPlugin.promptResults(input);

    self.promptOut.set(output);
  });
};
