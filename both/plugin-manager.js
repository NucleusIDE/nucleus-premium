NucleusPluginManager = function(NucleusInstance) {
  this.NucleusInstance = NucleusInstance;

  if (Meteor.isClient) {
    this._corePlugins = [
      Keybindings,
      MasterPrompt,  //depends on Keybindings
      FuzzyFindFile, //depends on MasterPrompt
      NucleusTerminal,
      WebRTCCall,
    ];
  }

  if (Meteor.isServer) {
    this._corePlugins = [
      BasicAuth
    ];
  }

  this._registeredPlugins = [];
  this._registerCorePlugins();
};

NucleusPluginManager.prototype.registerPlugin = function(plugin) {
  var pluginObj = plugin;

  if (typeof plugin == 'undefined') {
    console.log('Ignoring register undefined plugin');
    return;
  }

  if (_.isFunction(plugin)) {
    pluginObj = new plugin(this.NucleusInstance);
  }

  if (! _.isObject(pluginObj)) {
    throw new Meteor.Error('plugin must be an object or function.');
  }

  if (!_.isFunction(pluginObj['exec'])) {
    throw new Meteor.Error('plugin must have `exec` function');
  }

  //Register a plugin only once.
  if (this._registeredPlugins.indexOf(plugin) < 0) {
    pluginObj.exec(this.NucleusInstance);
    this._registeredPlugins.push(plugin);
  }
};

NucleusPluginManager.prototype._registerCorePlugins = function() {
  var self = this;
  this._corePlugins.forEach(function(plugin) {
    self.registerPlugin(plugin);
  });
};
