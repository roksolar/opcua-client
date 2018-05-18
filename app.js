
var ip = process.argv[2];
var express = require("express");
var port = 3700;

var opcua = require("node-opcua");
var async = require("async");
var color = require("colors");
var MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;
var SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;
var crypto_utils = require("node-opcua-crypto").crypto_utils;
var AttributeIds = opcua.AttributeIds;

var client = new opcua.OPCUAClient({
    //securityMode: MessageSecurityMode.SIGNANDENCRYPT,
    //securityPolicy: SecurityPolicy.Basic128Rsa15,
    //requestedSessionTimeout: 10000,
    //serverCertificate: crypto_utils.readCertificate("./pki/trusted/ab4a9f208187e481576b4f963be883e88de79e04.pem"),
    //serverCertificate: crypto_utils.readCertificate("./certificates/server_cert_2048.pem"),
    //certificateFile : "./certificates/client_selfsigned_cert_2048.pem",
    //privateKeyFile: "./certificates/client_key_2048.pem",
    endpoint_must_exist: false,
    keepSessionAlive: true,

});
var resolveNodeId = opcua.resolveNodeId;
var hostname = require("os").hostname();
hostname = hostname.toLowerCase();
var endpointUrl = "opc.tcp://"+ip+":4870";

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
                //crypto_utils.readCertificate(client.serverCertificate);
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
            requestedPublishingInterval: 10,
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
           // console.log("keepalive");

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
        socket.on('recepti', function (data) {
            console.log("test");
            var nodesToWrite = [{
                    nodeId: data.nodeId,
                    attributeId: opcua.AttributeIds.Value,
                    value: { 
                        value: { 
                            dataType: opcua.DataType.Double,
                            value: data.value
                        }
                }
            }];
            console.log("test");
            console.log(data);
        the_session.write(nodesToWrite, function(err,statusCode,diagnosticInfo) {
                if (!err) {
                    console.log(" write ok" );
                }
            });  
        });
    });

    
      

    function make_callback(_nodeId) {

        var nodeId = _nodeId;
        return  function(dataValue) {
            console.log(nodeId.toString() , "\t value : ",dataValue.value.value.toString());
            io.sockets.emit("rezimDelovanja", {
                value: dataValue.value.value,
                timestamp: dataValue.serverTimestamp,
                nodeId: nodeId.toString(),
            });
       };
    }
    
    var ids = [
        "Kljuc",
        "Bat_A_naprej" ,
        "Alarmi",
        "Bat_B_naprej",
        "Foto_vhod",
        "Miza_premik",
        "Podatki_DB_lokacija1_zasedenost",
        "Podatki_DB_lokacija3_zasedenost",
        "Podatki_DB_lokacija4_zasedenost",
        "Podatki_DB_lokacija5_zasedenost",
        "Podatki_DB_lokacija6_zasedenost",
        "Recept2",
        "Stiskalnica_pritisk",
        "Trak_premik",
        "error_batA_pokvarjen",
        "error_batB_pokvarjen"
    ];
    ids.forEach(function(id){
        var nodeId = "ns=4;s="+id;
        var monitoredItem = the_subscription.monitor(
            {nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value},
            {samplingInterval: 100, discardOldest: true, queueSize: 100});
        monitoredItem.on("changed",make_callback(nodeId));
    });

    
}