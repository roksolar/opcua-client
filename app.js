var express = require("express");
var port = 3700;

var opcua = require("node-opcua");
var async = require("async");
var color = require("colors");

var client = new opcua.OPCUAClient({
    keepSessionAlive: true,
    endpoint_must_exist: false
});

var hostname = require("os").hostname();
hostname = hostname.toLowerCase();
var endpointUrl = "opc.tcp://192.168.81.132:4870";

var the_subscription,the_session;

var userIdentity  = null;
//xx var  userIdentity = { userName: "opcuauser", password: "opcuauser" };


async.series([
    // step 1 : connect to
    function(callback) {
        console.log(" connecting to ", endpointUrl.cyan.bold);
        //CONNECT
        client.connect(endpointUrl, function (err) {
            if(err) {
                console.log(" cannot connect to endpoint :" , endpointUrl );
            } else {
                console.log("connected !");
            }
            callback(err);
        });
    },
    // step 2 : createSession
    function(callback) {
        console.log("create session");
        //CREATE SESSION
        client.createSession( function(err, session) {
            if(!err) {
                the_session = session;
                console.log(" session created".yellow);
            }
            callback(err);
        });
    },
   /* function(callback) {
        client.createSession(userIdentity,function (err,session){
            if (!err) {
                the_session = session;
                console.log(" session created".yellow);
            }
            callback(err);
        });
    },*/
    // step 3 : subscribe
    function(callback) {
        the_subscription=new opcua.ClientSubscription(the_session,{
            requestedPublishingInterval: 2000,
            requestedMaxKeepAliveCount:  2000,
            requestedLifetimeCount:      6000,
            maxNotificationsPerPublish:  1000,
            publishingEnabled: true,
            priority: 10
        });
//xx the_subscription.monitor("i=155",DataType.Value,function onchanged(dataValue){
//xx    console.log(" temperature has changed " + dataValue.value.value);
//xx });
        the_subscription.on("started",function(){
            console.log("subscription started");
            callback();

        }).on("keepalive",function(){
            console.log("keepalive");

        }).on("terminated",function(){
            console.log(" TERMINATED ------------------------------>")
        });

    }
],function(err) {
    if (!err) {
        startHTTPServer();
    } else {
        // cannot connect to client
        console.log(err);
    }
});


var nodeIdToMonitor = "ns=4;s=Kljuc";

function startHTTPServer() {


    /*var app = express();
    app.get("/", function(req, res){
        res.send("It works!");
    });*/
    var app = express();
    app.set('view engine', 'html');
    app.use(express.static(__dirname + '/'));
    app.set('views', __dirname + '/');
    app.get("/", function(req, res){
        res.render('index.html');
    });

    app.use(express.static(__dirname + '/'));

    var io = require('socket.io').listen(app.listen(port));

    io.sockets.on('connection', function (socket) {
//        socket.on('send', function (data) {
//            io.sockets.emit('message', data);
//        });
    });

    var monitoredItem = the_subscription.monitor(
        {
            nodeId: nodeIdToMonitor,
            attributeId: 13
        },
        {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        },opcua.read_service.TimestampsToReturn.Both,function(err) {
            if (err) {
                console.log("Monitor  "+ nodeIdToMonitor.toString() +  " failed");
                console.loo("ERr = ",err.message);
            }

        });

    monitoredItem.on("changed", function(dataValue){

         console.log(" value has changed " +  dataValue.toString());

        io.sockets.emit('message', {
            value: dataValue.value.value,
            timestamp: dataValue.serverTimestamp,
            nodeId: nodeIdToMonitor.toString(),
            browseName: "Temperature"
        });
    });

}



console.log("Listening on port " + port);
