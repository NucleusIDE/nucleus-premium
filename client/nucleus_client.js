/**
 * # NucleusClient
 *
 */

var NucleusClientFactory = function () {
  /**
   * It should be the centralized access point for most of the operations on Nucleus on the client side.
   */

  var fileTree,
      currentFile,
      currentFileContents,
      nucleusClientDep = new Deps.Dependency;

  this.config = {
    nucleusUrl: window.location.origin + '/nucleus',
    windowName: 'Nucleus',
    clientDir: 'client',
    serverDir: 'server',
    suckCSSFromPackages: []
  };

  this.configure = function (config) {
    _.extend(this.config, config);
  };

  this.popup = function() {
    //url where nucleus template is expected
    var url = this.config.nucleusUrl,
        //name of Nucleus window. Not significant
        windowName = this.config.windowName;
    //nucleus window which has nucleus editor.
    this.nucleusWindow = window.open(url, windowName, 'height=550,width=900');
    if (window.focus) {
      this.nucleusWindow.focus();
    }

    return this.nucleusWindow;
  };

  this.initialize = function (config, nucleusWindow) {
    this.configure(config);

    //Configure flash messages. We are using `mrt:flash-messages` package for flash messages
    FlashMessages.configure({
      autoHide: true,
      hideDelay: 3000,
      autoScroll: true
    });

    this.nucleusWindow = nucleusWindow;

    //let's override nucleusWindow's LiveUpdate.refresh so it won't re-render the editor page
    var nucOverrideInterval = Meteor.setInterval(function () {
      if (nucleusWindow.Meteor && nucleusWindow.LiveUpdate) {
        this.origLiveUpdateRefreshFile = this.getWindow('app').LiveUpdate.refreshFile;
        nucleusWindow.LiveUpdate.refreshFile = function () {
          return false;
        };
        Meteor.clearInterval(nucOverrideInterval);
      }
    }.bind(this), 500);

    //Configure LiveUpdate to be used as a library so it won't re-render the templates itself
    LiveUpdate.useAsLib(true);

    this.Editor = NucleusEditor;

    /**
     * Add Plugin manager to Nucleus and put 'registerPlugin' on this for convinience
     */
    this.PluginManager = new NucleusPluginManager(this);
    this.registerPlugin = this.PluginManager.registerPlugin.bind(this.PluginManager);

    /**
     * Let's keep the current user on NucleusClient, and use NucleusUser as just a way of handling users. Not as an interface
     */
    this.currentUser = new ReactiveVar(null);

    this.Deploy = new DeployManager();

    return false;
  };

  /**
   * Get name of the the *scratch* doc. This is the document which is opened in ace when user has just logged in and haven't yet opened any document.
   */
  this.getScratchDoc = function () {
    return 'scratch';
  };

  /**
   * Get the window for `app_name`. If `app_name` is not given, it returns window for `nucleus`
   *
   * *Attributes*:
   * * `app_name` *{String}* : Can be **app** or **nucleus**
   */
  this.getWindow = function (app_name) {
    var nucleus_window = this.nucleusWindow ? this.nucleusWindow : window.name === "Nucleus" ? window : window;

    if (app_name === "app") return nucleus_window.opener ? nucleus_window.opener : nucleus_window;

    return nucleus_window;
  };

  /**
   * Get `app` window
   */
  this.getAppWindow = function () {
    return window.name === "Nucleus" ? window.opener : window;
  };

  /**
   * Check if `filepath` is a client file. Client files are supposed to be evaled live on client side. Although this functionality has not been implemented yet.
   */
  this.isClientFile = function (filepath) {
    var clientRegex = new RegExp("\/" + this.config.clientDir + "\/");
    return clientRegex.test(filepath);
  };
  /**
   * Check if `filepath` is a server file.
   */
  this.isServerFile = function (filepath) {
    var serverRegex = new RegExp("\/" + this.config.serverDir + "\/");
    return serverRegex.test(filepath);
  };
  /**
   * Check if `filepath` is a CSS file.
   */
  this.isCSSFile = function (filepath) {
    var splitArr = filepath.split(".");
    return splitArr[splitArr.length - 1] === 'css';
  };

  this.getFileType = function (filepath) {
    var splitArr = filepath.split(".");
    return splitArr[splitArr.length - 1];
  };

  /**
   * Mark `nucDoc` for eval on client side.
   *
   * *Arguments:*
   * * `nucDoc` *{Mongo Document}* : Document from `NucleusDocuments` which would have `filepath` property. This document will be attempted to be evaled on client side.
   */
  this.markDocForEval = function (nucDoc, oldDocContent) {
    var filepath = nucDoc.filepath,
        isClientFile = this.isClientFile(filepath);

    var shouldEvalInNucleus = /\/packages\//.test(filepath.toLowerCase());

    if (isClientFile || !this.isServerFile(filepath)) {
      NucleusDocuments.update({_id: nucDoc._id}, {$set: {shouldEval: true, last_snapshot: oldDocContent, shouldEvalInNucleus: shouldEvalInNucleus}});
    }
  };

  /**
   * Unmark `nucDoc` from eval on client side. See `NucleusClient.markDocForEval` above
   *
   * *Arguments:*
   * * `nucDoc` *{Mongo Document}* : Document from `NucleusDocuments` which would have `filepath` property.
   */
  this.unmarkDocForEval = function (nucDoc) {
    NucleusDocuments.update({_id: nucDoc._id}, {$set: {shouldEval: false, shouldEvalInNucleus: false}});
  };

  /**
   * Eval the `nucDoc` on client side. As of now, this function can only act on `CSS` files. Js/HTML files are not supported for now.
   * We will use `channikhabra:live-update` package for evaling js/html on client, when it's implemented.
   *
   * *Arguments:*
   * * `nucDoc` *{Mongo Document}* : Document from `NucleusDocuments` which would have `filepath` property.
   */
  this.evalNucleusDoc = function (docId, shouldEvalInNucleus) {
    var nucDoc = NucleusDocuments.findOne(docId);
    if (!nucDoc) {
      console.log('Cant find doc with id', docId);
      return;
    }
    var filepath = nucDoc.filepath,
        doc = ShareJsDocs.findOne(nucDoc.doc_id),
        newFileContent = doc.data.snapshot,
        oldDocContent = nucDoc.last_snapshot;

    var refreshFunc = shouldEvalInNucleus ? this.origLiveUpdateRefreshFile : LiveUpdate.refreshFile;

    refreshFunc.call(LiveUpdate, {
      newContent: newFileContent,
      fileType: this.getFileType(filepath),
      oldContent: oldDocContent,
      filepath: filepath
    });

  };

  /**
   * Reactively get the `filetree`. It'd first attempt to refresh/set `filetree` and reactively return it.
   */
  this.getFileTree = function () {
    this.setFileTree();
    nucleusClientDep.depend();
    return fileTree;
  };
  /**
   * Reactively set `filetree`
   */
  this.setFileTree = function () {
    Meteor.call("nucleusGetFileList", function (err, res) {
      //so that this.getFileTree() won't run infinitely for reactive computations
      if (!_.isEqual(res, fileTree)) {
        nucleusClientDep.changed();
        fileTree = res;
      }
    });
  };

  /**
   * jstree isn't working when used with JSON from within a meteor package. So, let's create HTML (ul>li) instead.
   * I tried creating my own simple tree, but it's turning out to be more work
   */
  this.getJstreeHTML = function () {

    var tree = this.getFileTree();
    nucleusClientDep.depend();

    if (!tree) return false;
    var template = "\
      <ul> \
      <% _.each(tree.children, function(child) { %>  \
      <li class='nucleus_tree_node' id='<%= child.path %>' data-type='<%= child.type %>'><%= child.name %> \
      <%= childFn({tree: child, childFn: childFn}) %> \
    </li> \
      <% }) %> \
    </ul>";
    var templateFn = _.template(template);

    var html = templateFn({tree: tree, childFn: templateFn});
    return html;
  };

  /**
   * This function is obsolete. We use `NucleusClient.getJstreeHTML()` for setting filetree in Nucleus sidebar.
   */
  this.getJstreeJSON = function () {
    //jstree uses a different JSON formatting then produced by Nucleus.getFileList. Here we do the conversion
    var rawtree = this.getFileTree();
    if (!rawtree) return false;
    var setJstreeJSON = function (obj) {
      _.each(obj.children, function (child) {
        if (child.name.indexOf(".") === 0) return; //ignore hidden files/folders
        jstree.push({"id": child.path, "parent": child.parent, "text": child.name});
        if (obj.type === 'folder') setJstreeJSON(child);
      });
    };
    var jstree = [
      {"id": rawtree.path, "parent": "#", "text": rawtree.name}
    ];
    setJstreeJSON(rawtree);
    return jstree;
  };

  /**
   * Edit `filepath` in ace editor.
   *
   * *Arguments:*
   * * `filepath` *{string}*: Path of file to be edited. Can be obtained from the filetree nodes in Nucleus sidebar.
   * * `forceRefresh` *{boolean}*: Discard the changes which are not yet saved to the filesystem and force load `filepath` from filesystem
   */
  this.editFile = function (filepath, forceRefresh) {
    Meteor.call('nucleusSetupFileForEditting', filepath, forceRefresh, function (err, res) {
      if (err) {
        console.log(err);
        return;
      }
      Session.set("nucleus_selected_doc_id", res);
      Session.set("nucleus_selected_file", filepath);

      var user = NucleusUser.me();
      if (!user) return; // this is to avoid a message in console which shows up when user is not yet logged in
      user.setCwd(res);
      user.setCurrentFilepath(filepath);
    });
  };

  /**
   * Save the selected file to Filesystem. This method is called when user press `Cmd-S` or click `Save` button in Nucleus editor.
   *
   * Selected file is `NucleusUser.cwd`.
   */
  this.saveSelectedFileToDisk = function () {
    var selectedDocId = Session.get("nucleus_selected_doc_id"),
        nucDoc = NucleusDocuments.findOne({doc_id: selectedDocId}),
        client = this;
    Meteor.call("nucleusSaveDocToDisk", selectedDocId, function (err, res) {
      if (err) {
        console.log('Error in NucleusClient.saveSelectedFileToDisk', err);
        return;
      }
      if (res.status === 0) FlashMessages.sendWarning("No Changes to Save");
      if (res.status === 1) {
        client.markDocForEval(nucDoc, res.oldDocContent);
        FlashMessages.sendSuccess("File Saved Successfully");
      }
      if (res.status === 2) FlashMessages.sendError("Something went Wrong when Saving File");
    });
  };

  /**
   * Get all online users. All users in `NucleusUsers` collection are online users since we remove any user who leaves the nucleus as soon as they leave it.
   */
  this.getOnlineUsers = function () {
    return NucleusUsers.find({status: 3});
  };

  /**
   * Creates new `filepath` and execute `cb` callback after completion.
   *
   * *Arguments:*
   * * `filepath`: Path of the file to be created
   * * `cb`: Callback function to be executed after completion.
   */
  this.createNewFile = function (filepath, cb) {
    Meteor.call("nucleusCreateNewFile", filepath, function (err, res) {
      if (err) {
        cb(err);
        return;
      }
      cb(null, res);
    });
  };

  /**
   * Creates new `filepath` and execute `cb` callback after completion.
   *
   * *Arguments:*
   * * `filepath`: Path of the file to be created
   * * `cb`: Callback function to be executed after completion.
   */
  this.createNewFolder = function (filepath, cb) {
    Meteor.call("nucleusCreateNewFolder", filepath, function (err, res) {
      if (err) {
        cb(err);
        return;
      }
      cb(null, res);
    });
  };

  /**
   * Delete `filepath` (file or directory) and execute `cb` callback after completion.
   *
   * *Arguments:*
   * * `filepath`: Path of the file to be created
   * * `cb`: Callback function to be executed after completion.
   */
  this.deleteFile = function (filepath, cb) {
    Meteor.call("nucleusDeleteFile", filepath, function (err, res) {
      if (err) {
        cb(err);
        return;
      }
      cb(null, res);
    });
  };

  /**
   * Rename `oldpath` to `newpath` and execute `cb` callback after completion.
   *
   * *Arguments:*
   * * `oldpath`: Old path of the file/directory to be renamed
   * * `newpath`: New path of the file/directory to be renamed
   * * `cb`: Callback function to be executed after completion.
   */
  this.renameFile = function (oldpath, newpath, cb) {
    Meteor.call("nucleusRenameFile", oldpath, newpath, function (err, res) {
      if (err) {
        cb(err);
        return;
      }
      cb(null, res);
    });
  };

  return this;
};

/**
 * EVAL AUTO RUN
 */
Deps.autorun(function () {
  Meteor.subscribe('nucleusPublisher');

  //below approach is required to eval the new changes for al connected clients and not for present client only
  NucleusDocuments.find({shouldEval: true}).forEach(function (doc) {
    NucleusClient.unmarkDocForEval(doc);
    NucleusClient.getWindow('app').eval('NucleusClient.evalNucleusDoc("' + doc._id + '")');

    if (doc.shouldEvalInNucleus) {
      //we can keep this here because all files no matter where they are located are evaled for app

      var oldCursorPosition = NucleusClient.Editor.editor.getCursorPosition(),
          oldScrollPosition = [NucleusClient.Editor.editor.session.getScrollTop(), NucleusClient.Editor.editor.session.getScrollLeft()];

      NucleusClient.evalNucleusDoc(doc._id, true);
      //Since we re-render the whole window in nucleus on file change, the window flickers a little
      //and the cursor position is lost. Let's get the cursor position and set it back after the window flicker
      Meteor.setTimeout(function() {
        NucleusClient.Editor.editor.moveCursorToPosition(oldCursorPosition);
        NucleusClient.Editor.editor.session.setScrollTop(oldScrollPosition[0]);
        NucleusClient.Editor.editor.session.setScrollLeft(oldScrollPosition[1]);
        NucleusClient.Editor.editor.focus();
      }, 400);
    }
  });
});


//Create NucleusClient Global
NucleusClient = new NucleusClientFactory();
