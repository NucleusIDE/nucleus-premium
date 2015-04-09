WebRTCCall = function(NucleusClient) {};

WebRTCCall.prototype._setVideoHandlingAutorun = function() {
  //Autorun for starting/recieving/stopping a call.
  //It initializes the SimpleWebrtc and create/join/stop a video call
  //depending on Session.get('webrtc-chat-active')
  Tracker.autorun(function() {
    var chatActive = Session.get('webrtc-chat-active');

    if (chatActive) {
      var rtcInterval = Meteor.setInterval(function() {
        if (typeof SimpleWebRTC === 'undefined') {
          return;
        }

        Meteor.clearInterval(rtcInterval);

        window.nucleucWebrtc = new SimpleWebRTC({
          debug: false,
          url: 'http://localhost:8080',
          localVideoEl: 'local-nucleus-video',
          remoteVideosEl: 'remote-nucleus-videos',
          autoRequestMedia: true
        });

        window.nucleucWebrtc.on('readyToCall', function () {
          window.nucleucWebrtc.joinRoom('nucleus_room');

          //broadcast message only if it is not recieving a call.
          //Session.get('incoming_call_recieved') is set to false when an incoming
          //call has arrived. Otherwise it is true or undefined
          if (Session.get('incoming_call_recieved') !== false) {
            MeteorWebrtc.broadcast('newVideoCall', {sender: NucleusUser.me().nick});
          }

          Session.set('incoming_call_recieved', true);
        });
      }, 100);
    } else {
      if (!window.nucleucWebrtc) {
        return;
      }

      window.nucleucWebrtc.leaveRoom('nucleus_room');
      window.nucleucWebrtc.stopLocalVideo();
    }
  });
};

WebRTCCall.prototype._setNotificationAutorun = function() {
  //Autorun for dismissing/showing incoming call notification
  //depending on Session.get('incoming_call_recieved')
  Tracker.autorun(function() {
    var callRecieved = Session.get('incoming_call_recieved');

    if (typeof callRecieved === 'undefined')
      return;

    if (callRecieved == false) {
      $('#start-video-chat').addClass('incoming-call');
    }
    if (callRecieved == true) {
      $('#start-video-chat').removeClass('incoming-call');
    }
  });
};

WebRTCCall.prototype.setAutoruns = function() {
  this._setVideoHandlingAutorun();
  this._setNotificationAutorun();
};

WebRTCCall.prototype.startListeningForIncomingCalls = function() {
  MeteorWebrtc.on('newVideoCall', function(message) {
    console.log(message);
    if (message.sender === NucleusUser.me().nick) {
      return;
    }

    Session.set('incoming_call_recieved', false);
  });
};

WebRTCCall.prototype.exec = function(NucleusClient) {
  NucleusClient.WebRTCCall = this;
  this.setAutoruns();
};
