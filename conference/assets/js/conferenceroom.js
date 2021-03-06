var localVideo;
var sessionId;
var screensessionId;
var participants         = {};
var reloadforscreenshare = 0;
var globalconstraints    = 0;
var stopSession          = 0;
var updttimecalled       = 0;
var elapsedTime          = 0;
var connctionLost        = 0;
var pingsend             = 0;
var socket = io.connect(node_url);
var alreadyConnected     = 0;
var published            = 0;

 /*
 *   Socket connection success callback for kurento client
 */
socket.on("connect", function (id) {
    $('#live-lab').html('LIVE');
    $('#live-lab').removeClass('off');
    $('#indication').removeClass('offline');
    //alert('connected == '+alreadyConnected+'//'+published);
    if(alreadyConnected == 1 && published == 1){
       leaveRoom();
    }
    register(role);    
});
/*
 *   Socket connection disconnect callback for room server
 */
socket.on('disconnect', function () {

    $('#live-lab').html('OFFLINE');
    $('#live-lab').addClass('off');
    $('#indication').addClass('offline');  
    if(stopSession == 0){
        setTimeout(function(){
            swal("Message!", "Connection with server lost!!!");
        },2000);
        
    }
});
/*
 *   Ping from the server for checking whether any user missing
 */
function onExistingUserForConnectionCheck(data){
    //checking any user missing
    var existingIdDictionary = {};
    data  = data.data
    data = data.toString()
    console.log('Existing Ids : '+data);
    var x = new Array();
    x = data.split(',');
    var loastedId = 0;
    for(var i = 0; i<x.length; i++){
        var str = x[i];
        var res = str.split("*_*");
        var rm  = res[1];
        if(rm == room){
                var len = $('#video-'+res[0]).length;
                existingIdDictionary[res[0]] = 'true';
                if(len == 0){
                   connctionLost = 1;
                   loastedId = res[0];
                }
        }
        
    }   
    if(data == '0'){
        connctionLost = 1;
    }
    if(connctionLost ==1){
        if(pingsend == 0){
            pingsend = 1;
            pingUsers(loastedId);
        }
    }
    // checking for extra video
    var vid = $("video");
    if(vid!=null){
        $.map( vid, function( n, i ) {
          var currentId = n.getAttribute('data-myid');
          //console.log('current '+currentId+ ' existing : '+existingIdDictionary.hasOwnProperty(currentId));
          if(!existingIdDictionary.hasOwnProperty(currentId)){
              $('#video-'+currentId).remove();
               $('#'+currentId).remove();
              
          }
          if(n.paused){
            var removedId = n.getAttribute('data-myid');
            $('#'+currentId).remove();
          }
          
        });
    }
}

window.onbeforeunload = function () {
    socket.disconnect();
    
};
/**
 * Register to a romm
 * 
 */
function register(roleval) {
    var data = {
        id: "register",
        userName: userName,
        role: roleval,
        mode: mode,
        room: room
    };
    sendMessage(data);
}
/**
 * callback from nodejs server for getting socket id
 */
socket.on("id", function (id) {
    sessionId       = id;
    screensessionId = id+'_screen';
    socketId        = id;
});
/**
 * Send message to server
 * @param data
 */
function sendMessage(data) {

    socket.emit("message", data);
}
/**
 * Invoke from nodejs server on each event triggers
 * @param message
 */
socket.on("message", function (message) {
    switch (message.id) {
        case "registered":
             joinRoom(room,message.role);
             $('#share_cam').removeAttr('disabled');
             alreadyConnected = 1;
        break;
        case "existingParticipants":
            if(message.role == 'screen')
            {
               onExistingParticipants(message,screensessionId,screensessionId,'screen');
            }
            else
            {
                onExistingParticipants(message,sessionId,socketId,role);
            }
        break;
        case "receiveVideoAnswer":
            onReceiveVideoAnswer(message);
        break;
        case "newParticipantArrived":
            onNewParticipant(message);
        break;
        case "participantLeft":
             onParticipantLeft(message);
        break;
        case "onExistingUserForConnectionCheck":
             onExistingUserForConnectionCheck(message);
        break;
        case "iceCandidate":
            var participant = participants[message.sessionId];
            if (participant != null) {
                participant.rtcPeer.addIceCandidate(message.candidate, function (error) {
                    if (error) {
                        if (message.sessionId === sessionId) {
                            console.error("Error adding candidate to self : " + error);
                        } else {
                            console.error("Error adding candidate : " + error);
                        }
                    }
                });
            } else {
                console.error('still does not establish rtc peer for : ' + message.sessionId);
            }
        break;
        case 'onReceiveSendToOne':
              onReceiveSendToOne(message);
        break;
        case 'onReceiveSendToAll':  
              onReceiveSendToAll(message);
        break;
        case 'onInitialTime':  
            if(updttimecalled == 0){
                elapsedTime = parseInt(message.time);
                updateTime(); 
                updttimecalled = 1;
            }
        break;
        case 'onGetTime':
            elapsedTime = parseInt(message.time);
        break; 
        case 'room_expired':
            $('body').html('<h2>Room Expired</h2>');
            swal("Message!", "This room expired ! ");
        break; 
        case 'recordingStarted':
            //alert('record started');
        break;
        case "playstarted":
            var strmId = message.streamId;
            $('#'+strmId).show();
        break;  
        case "userDisconnected":
            var strmId = message.streamId;
            if(strmId == socketId){
                //alert('me disconnect');
                leaveRoom();
              if(stopSession == 0){
                swal("Message!", "Connection with server lost!!!");
                setTimeout(function(){
                  register(role); 
                },2000);
               }
            }else{
                //alert('other disconnect');
                $('#'+strmId).remove();
                $('#user-'+strmId).remove();
            }
            
        break;
        default:
             console.log("Unrecognized message: "+message.id);
    }
});
$('document').ready(function(){
    $('#share_cam').click(function(){
         $("#share_cam").attr("disabled","disabled");
         setTimeout(function(){
           publishMyCam(socketId,socketId,role);
         },2000);
         $('#stop_cam').removeAttr('disabled');
         published = 1;
    });
     $('#stop_cam').click(function(){
         
         if(participants)
            {
                 if(participants.hasOwnProperty(sessionId))
                  {  
                        participants[sessionId].rtcPeer.dispose();                    
                  }   
            } 
         published = 0;
         $('#share_cam').removeAttr('disabled');
         leaveForScreenShare();
         reloadforscreenshare = 1;
         setTimeout(register,500,role); 

    });
});
/**
 * Tell room you're leaving and remove all video elements
 */
function leaveForScreenShare(){

    if(participants)
    {
         if(participants.hasOwnProperty(socketId))
          {
            var message = {
                id: "leaveMyPublishOnly"
            };
            //participants[sessionId].rtcPeer.dispose();
            sendMessage(message);
            //participants = {};
            $('#'+socketId).remove();
            $('#user-'+socketId).remove();
         }
    }
    
}
function getTimeRequest(){
    var message = {
        id : 'getTime',
        room : room
    };

    sendMessage(message);
}
/*
 *   Call back of send to all function
 */
function onReceiveSendToAll(parsedMessage)
{
   
    if(parsedMessage.room == room)
    {
        var jsonstring = parsedMessage.contentJson;
        var parsedMessage = JSON.parse(jsonstring);
        var parsedValues;
        
        
            switch (parsedMessage.method) {
                case 'participant_cam_on_off':
                    if(parsedMessage.status == "on"){ vidLockarray[parsedMessage.element] = true; } else { vidLockarray[parsedMessage.element] = false; }
                      participantCamOnOff(parsedMessage.element, false, parsedMessage.status);
                    break;
                case 'participant_mic_on_off':
                    if(parsedMessage.status == "on"){ micLockarray[parsedMessage.element] = true; } else { micLockarray[parsedMessage.element] = false; }
                      participantMicOnOff(parsedMessage.element, false, parsedMessage.status);
                    break;
                case 'onkick':
                    kickUserRecived(parsedMessage.user_id);
                break;
                default:
                    console.error('Unrecognized message', parsedMessage);
            }
    }
}
/**
 * Check if roomName exists, use DOM roomName otherwise, then join room
 * @param roomName and roleval
 */
function joinRoom(roomName,roleval) {

    if(typeof roomName == 'undefined'){
        roomName = room;
    }
    var data = {
        id: "joinRoom",
        roomName: roomName,
        userName: userName,
        role: roleval,
        mode: mode,
        webinar: webinar,
        recording: record
    };
    sendMessage(data);
}
/**
 * Request video from all existing participants
 * @param message
 */

function onExistingParticipants(message,ses_id,name_id,cur_role) {
    connctionLost = 0;
    if(reloadforscreenshare == 0)
    {
        for (var i in message.data) {
            var str = message.data[i];
            var res = str.split("*_*");
            var request             = {};
                request['userid']   = res[0];
                request['userName'] = res[1];
                request['role']     = res[2];
                request['mode']     = res[3];
                receiveVideoFrom(res[0],request);
       }
       if(published == 1){
          $("#share_cam").attr("disabled","disabled");
          setTimeout(function(){
            publishMyCam(ses_id,name_id,cur_role);
          },2000);
       }
    }
    
    reloadforscreenshare = 0;
}
function publishMyCam(ses_id,name_id,cur_role){
    $("#share_cam").attr("disabled","disabled");
    onParticipantLeft({sessionId:ses_id});
    if(globalconstraints==0)
    {
        if(webinar == '0' || mode == 'presenter')
        {
            var constraints = {
                audio: false,
                video: {
                frameRate: 15,
                    width: 640,
                    height: 480
                }
            };
        }
        else
        {
            var constraints = {
                audio: false,
                video: false
            };
        }
            
    }
    else
    {
        var constraints = globalconstraints;
    }
    var localParticipant = new Participant(ses_id,cur_role);
    participants[ses_id] = localParticipant;
    createVideoForuserList(userName,name_id,cur_role,mode);
    localVideo = document.getElementById("video-"+name_id);
    var video = localVideo;

    // bind function so that calling 'this' in that function will receive the current instance
    var options = {
        localVideo: video,
        mediaConstraints: constraints,
        onicecandidate: localParticipant.onIceCandidate.bind(localParticipant)
    };

    if(webinar == '0' || mode == 'presenter')
    {
        
        localParticipant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function (error) {
            if (error) {
                return console.error(error);
            }
            localVideo = document.getElementById("video-"+name_id);
            localVideo.src = localParticipant.rtcPeer.localVideo.src;
            localVideo.muted = true; 
            this.generateOffer(localParticipant.offerToReceiveVideo.bind(localParticipant));
            
        });
        var message = {
                id: "startRecording",
                room:room
            };
        sendMessage(message);
    }
}
/**
 * Receive video from new participant
 * @param message
 */
function onNewParticipant(message) {
    
    receiveVideoFrom(message.new_user_id,message);
}
/**
 * Add new participant locally and request video from new participant
 * @param sender
 */
function receiveVideoFrom(sender,message) {
    var res = sender.replace("_screen", "");
    if(res != socketId)
    {
        var participant = new Participant(sender,role);
        participants[sender] = participant;
        var video = createVideoForParticipant(sender,message);

        // bind function so that calling 'this' in that function will receive the current instance
        var options = {
            remoteVideo: video,
            onicecandidate: participant.onIceCandidate.bind(participant)
        };

        participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
            if (error) {
                alert('error');
                return console.error(error);
            }
            this.generateOffer(participant.offerToReceiveVideo.bind(participant));
        });
    }
}
/**
 * On receive video answer
 * @param message
 */
function onReceiveVideoAnswer(message) {
    var participant = participants[message.sessionId];
    participant.rtcPeer.processAnswer(message.sdpAnswer, function (error) {
        if (error) {
            console.error(error);
        } else {
            participant.isAnswer = true;
            while (participant.iceCandidateQueue.length) {
                var candidate = participant.iceCandidateQueue.shift();
                participant.rtcPeer.addIceCandidate(candidate);
            }
        }
    });
}
/**
 * Create video DOM element
 * @param participant
 * @returns {Element}
 */
function createVideoForParticipant(userid,message) {
    //pingUsers(userid);
    var videoId = "video-" + userid;
    createVideoForuserList(message.userName,userid,message.role,message.mode);
    return document.getElementById(videoId);
}
/*
* Turn ON/OFF video for each participant
*/
var vidLock      = false;
var micLock          = false;
var vidLockarray = {};
var micLockarray = {};

/*
* Turn ON/OFF camera for each participant
* @param ele   : camera ON/OFF div element
* @param send  : send signal to the viewer
* @param status: ON/OFF status at the user end
*/
var status = "on";
function participantCamOnOff(ele, send, status){
    status = status || "";
    var onHtml = '<i class="fa fa-video-camera cam-ic"></i>';
    var offHtml = '<i class="fa fa-video-camera cam-ic"></i><i class="fa fa-times cam-cls-chat"></i>';
    var v = $('#video-'+ele);
    if(status == "")
    {
        if($('#v-'+ele).html()==onHtml)
        {
            v.addClass('hide-vid');
            $('#v-'+ele).html(offHtml);
            status = "on";
        }
        else
        {
            v.removeClass('hide-vid');
            $('#v-'+ele).html(onHtml);
            status = "off";
        }
    } 
    else if(status == "on") 
    {
        v.addClass('hide-vid');
            $('#v-'+ele).html(offHtml);
            status = "on";
    }
    else
    {
       v.removeClass('hide-vid');
       $('#v-'+ele).html(onHtml);
       status = "off";
    }
    
   if(send){ 
   
        sendToAll(JSON.stringify({method: "participant_cam_on_off", element: ele, socketId: socketId, status: status})); 
        //saveParticipants({action:"camoffone",status:status,name: name});
    }
}
/*
* Turn ON/OFF sound for each participant
* @param ele   : mic ON/OFF div element
* @param send  : send signal to the viewer
* @param status: ON/OFF status at the user end
*/
function participantMicOnOff(ele, send, status){
    status = status || "";
    var onHtml = '<i class="fa fa-microphone microphone-icon"></i>';
    var offHtml = '<i class="fa fa-microphone-slash microphone-icon"></i>';
    var v = $('#video-'+ele);
    if(status == ""){
        if($('#m-'+ele).html()==onHtml)
        {
            if(ele != socketId)
            v.prop('muted',true);
            $('#m-'+ele).html(offHtml);
            status = "on";
        }
        else
        {
            if(ele != '#m-'+name)
            {
               if(ele != socketId)
               v.prop('muted',false);
               $('#m-'+ele).html(onHtml);
                
                status = "off";
            }
            $(ele).html(onHtml);
            
        }
    }
    else if(status == "on")
    {
         v.prop('muted',true);
         $('#m-'+ele).html(offHtml);
         status = "on";
    }
    else 
    {
         v.prop('muted',false);
         $('#m-'+ele).html(onHtml);
         status = "off";
    }
    if(send){ 
        sendToAll(JSON.stringify({method: "participant_mic_on_off", element: ele, socketId: socketId, status: status})); 
    }
}
function fullscreen(id){
  
        var elem = document.getElementById('video-'+id);
        if (elem.requestFullscreen) {
        elem.requestFullscreen();
        } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
        }
}
/**
 * Function for creating video elements
 * @param realName,name_id,userRole,userMode
 */
function createVideoForuserList(realName,name_id,userRole,userMode)
{
	 var name_html 		= "";
     //style="display:none;"
     var video_html      = '<div style="display:none;" id="'+name_id+'" class="vid-parent"><div class="control-back"><div id="vidctrl-'+name_id+'" class="video-contrl" >';
     video_html         += '<div class="userName">'+realName+'</div>';
     video_html         += '<div title="Video ON/OFF" class="cam-on-off chat-vid" id="v-'+name_id+'"><i class="fa fa-video-camera cam-ic"></i></div>';
     video_html         += '<div style="display:none;" title="Sound ON/OFF" class="mic-on-off chat-mic" id="m-'+name_id+'"><i class="fa fa-microphone microphone-icon"></i></div>';
     if(name_id != socketId){

        video_html         += '<div title="Kick User" class="kick-user chat-mic" id="k-'+name_id+'"><i class="fa fa-times microphone-icon"></i></div>';
        video_html         += '<div title="Full Screen" class="fullscrn chat-mic" id="f-'+name_id+'"><i class="fa fa-arrows-alt microphone-icon"></i></div>';
		name_html 		   += '<ul id="user-'+name_id+'" class="list-group customlist">';
		name_html 		   += '<li class="list-group-item customfields">'+realName+'</li>';
		name_html 		   += ' </ul>';
     }
     
     video_html         += '</div></div><video  poster="assets/images/user_image.png" data-myid="'+name_id+'" onplay="onPlayVideo(\''+name_id+'\')" width="222" height="167" id="video-'+name_id+'" autoplay="true"></video></div>';
     if(name_id == socketId){
        $('#layout').append(video_html);
        $('#vidctrl-'+name_id).addClass('video-contrl-my');
     }else{
        $('#layout').append(video_html);
		$('.list-div').append(name_html);
     }
    $("#v-"+name_id).click(function()
    {
        var id = this.id.replace('v-','');
        if(!vidLock){

            if(this.id == 'v-'+socketId){ 
                  participantCamOnOff(id, true, ""); 
            } else {
                if(!vidLockarray[id]){
                   participantCamOnOff(id, true, "");
                }
            }
        }
    });
    $("#m-"+name_id).click(function()
    {
        var id = this.id.replace('m-','');
        if(!micLock){
            if(this.id == 'm-'+socketId){ 
                  participantMicOnOff(id, true, ""); 
            } else {
                if(!micLockarray[id]){
                   participantMicOnOff(id, false, "");
                }
            }
        }
    });
    $(".vid-parent").on("click", '.fullscrn', function()
    {
        var id = this.id.replace('f-','');
        fullscreen(id);
    });
    $(".vid-parent").on("click", '.kick-user', function()
    {
        var id = this.id.replace('k-','');
        var kickdata             = {};
            kickdata['method']   = 'onkick';
            kickdata['user_id']   = id;
        var kickjson = JSON.stringify(kickdata);
        sendToAll(kickjson);
    });
    var vidN = document.getElementById("video-"+name_id);
    vidN.onloadstart = function() {
         
    };
    vidN.onwaiting = function() {
         
    };
/*vidN.onloadedmetadata = function() {
    alert("Meta data for video loaded");
};*/
    vidN.onplaying = function() {
        // alert('play');
         $('#'+name_id).show();
    };

}
/*
   function for sending data to all
*/
function sendToAll(contentJson)
{
    var message = {
        id : 'sendToAll',
        name : socketId,
        contentJson : contentJson,
        room : room
    };
   
    sendMessage(message);
}
/**
 * Function triggered when playing a video 
 * @param socketId
 */
function onPlayVideo(id)
{

}
/**
 * Destroy videostream/DOM element on participant leaving room
 * @param message
 */
function onParticipantLeft(message) {
    if(participants[message.sessionId]){
        var participant = participants[message.sessionId];
        participant.dispose();
        delete participants[message.sessionId];
    }
    $('#video-'+message.sessionId).remove();
    $('#'+message.sessionId).remove();
    $('#user-'+message.sessionId).remove();
    
}
/**
 * Send data to perticular user
 * @param contentJson,receiversocket
 */
function sendToOne(contentJson,receiversocket)
{
    var message = {
        id : 'sendToOne',
        receiversocket : receiversocket,
        sendersocket : socketId,
        contentJson : contentJson,
        room : room
    };

    sendMessage(message);
}  
/**
 * Trigger when someone send data to only me
 * @param parsedMessage
 */
function onReceiveSendToOne(parsedMessage)
{
    
        
        var jsonstring = parsedMessage.contentJson;
        var jsonobject = JSON.parse(jsonstring);
        var parsedValues;
        
                switch (jsonobject.method) 
                {
                    case 'pinguser':
                      pingreplysend(jsonobject,parsedMessage.sendersocket);
                    break;
                    case 'pingreply':
                      onReceivePingReply(jsonobject);
                    break;  
                    
                    default:
                        console.error('Unrecognized message', parsedMessage);
                }
   
}
/**
 * Destroy ping session for findout ghost user
 * @param message
 */

function onReceivePingReply(pingdata)
{ 
     
      var pingid = pingdata['pingid'];
      if(pingRegistry.hasOwnProperty(pingid))
        {
           var aliveuser = pingRegistry[pingid];
           delete pingRegistry[pingid];
           //console.log('User alive : '+aliveuser);
           
        }
}
function pingreplysend(pingdata,sendersocket)
{
        
        pingdata['method']              = 'pingreply';
        var jsonpingdata                = JSON.stringify(pingdata);
        sendToOne(jsonpingdata,sendersocket);
}
var pingRegistry = {};
function pingUsers(receiverSocket)
{
   
    var pingdata                        = {};
        pingdata['method']              = 'pinguser';
        pingdata['pingid']              = generateUUID();
        jsonpingdata                    = JSON.stringify(pingdata);
        sendToOne(jsonpingdata,receiverSocket);
        pingRegistry[pingdata['pingid']]    = receiverSocket;
        setTimeout(checkArrivalOfPingData,10000,pingdata['pingid'],receiverSocket);

}
function checkArrivalOfPingData(pingid,receiverSocket)
{
    if(pingRegistry)
    {
        if(pingRegistry.hasOwnProperty(pingid))
        {
           console.log('Ghost ditected');
           var ghostUser = pingRegistry[pingid];
           onParticipantLeft({sessionId:ghostUser});
         }
        else
        {
           // setTimeout(pingUsers,1000,receiverSocket);
           var len = $('#video-'+receiverSocket).length;
           if(len == 0){
                console.log('user missing########reconnecting########'+receiverSocket);
                leaveRoom();
                setTimeout(register,1000,role); 
           }else{
              connctionLost = 0;
           }
           
        }
    }
    pingsend = 0;
}
/**
 * Function called when admin kick user
 */
function kickUserRecived(id)
{
   
    if(id==socketId)
    {
        stopSession = 1;
        leaveRoom();
        swal("Message!", "You have been kicked from this conference")
        socket.disconnect();
    }
    
}
/**
 * Tell room you're leaving and remove all video elements
 */
function leaveRoom(){
    $('.list-div').html('');
    if(participants)
    {
         if(participants.hasOwnProperty(sessionId))
          {
            var message = {
                id: "leaveRoom"
            };
            if(webinar == false)
            {
                participants[sessionId].rtcPeer.dispose();
            }
            
            sendMessage(message);
            participants = {};

            var myNode = document.getElementById("layout");
            while (myNode.firstChild) {
                myNode.removeChild(myNode.firstChild);
            }
                       
         }
         
    } 
}
var timeDisplay = 0;
function updateTime(){
     updttimecalled = 1;
     if(stopSession == 0)
     {
            elapsedTime++; 
            timeDisplay++;
            $("#elapsedtime").html(secondsToHms(timeDisplay));
            setTimeout(updateTime, 1000);
            if(elapsedTime % 10 == 0){
               getTimeRequest();
            }
    }
}

function secondsToHms(d) {
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);
    return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s); 
}
/* 
* Generate Unique id 
* @return: Unique id
*/
function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        var out = (c=='x' ? r : (r&0x3|0x8)).toString(16);
        var ret = out.substr(out.length - 3);
        return ret;
    });
    var ret = uuid.substr(uuid.length - 6);
    return ret;
}

/* 
* Function triggered when leaving the session
* 
*/
function leaveSession(){
  swal({   title: "Are you sure?",   text: "You will not be able to back to this session!",   type: "warning",   showCancelButton: true,   confirmButtonColor: "#DD6B55",   confirmButtonText: "Yes, leave session!",   closeOnConfirm: false }, function(){ 
        stopSession = 1;
        leaveRoom();  
        socket.disconnect();
        swal("Disconnected!", "Your session ended successfully", "success"); });
}
function inviteUser(){
    swal({
      title: "Copy Following link to invite others",
      text: window.location+'?room='+room,
      type: "success",
      confirmButtonClass: 'btn-success',
      confirmButtonText: 'Copy Link'
    });
    $('.lead').attr('id', 'link');            
}
var butcl = 0;
function showUserLIst(){
    butcl = 1;
    $('iframe').toggle();
}
$('body').click(function(){
   if(butcl == 0){
      $('iframe').hide();
   }
   butcl = 0; 
});
$(document).on("click",".confirm",function() {
        copyToClipboard(document.getElementById("link"));
});
function copyToClipboard(elem) {
      var targetId = "_hiddenCopyText_";
      var isInput = elem.tagName === "INPUT" || elem.tagName === "TEXTAREA";
      var origSelectionStart, origSelectionEnd;
      if (isInput) {
          target = elem;
          origSelectionStart = elem.selectionStart;
          origSelectionEnd = elem.selectionEnd;
      } else {
          target = document.getElementById(targetId);
          if (!target) {
              var target = document.createElement("textarea");
              target.style.position = "absolute";
              target.style.left = "-9999px";
              target.style.top = "0";
              target.id = targetId;
              document.body.appendChild(target);
          }
          target.textContent = elem.textContent;
      }
      var currentFocus = document.activeElement;
      target.focus();
      target.setSelectionRange(0, target.value.length);
      var succeed;
      try {
          succeed = document.execCommand("copy");
      } catch(e) {
          succeed = false;
      }
      if (currentFocus && typeof currentFocus.focus === "function") {
          currentFocus.focus();
      }
      
      if (isInput) {
          elem.setSelectionRange(origSelectionStart, origSelectionEnd);
      } else {
          target.textContent = "";
      }
      return succeed;
  }