BasicAuth = function(Nucleus) {
  this.Nucleus = Nucleus;
};

BasicAuth.prototype.addAuth = function(Nucleus) {
  var user = Nucleus.config.user,
      password = Nucleus.config.password;

  if (user && password) {
    var basicAuth = new HttpBasicAuth(user, password);
    basicAuth.protect();

    Nucleus.Terminal.configure({user: user, password: password});
  } else {
    console.warn("Make sure you have set user/password for first line of fire protection");
    console.warn("Nucleus.configure({user: 'username', password: 'password'})");
  }
};

BasicAuth.prototype.exec = function(Nucleus) {
  Nucleus.BasicAuth = this;
};
