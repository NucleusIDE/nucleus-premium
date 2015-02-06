var premium_condition = function() {
  return true;
};

Meteor.startup(function() {
  if (! premium_condition()) {
    throw new Meteor.Error("Premium version of Nucleus isn't supposed to be running from here.");
  }
});
