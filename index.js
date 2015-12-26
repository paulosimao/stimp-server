/**
 * Created by paulo.simao on 23/12/2015.
 */

var net = require('net');
var stimpcommons = require('stimp-commons');
var mongo = require('mongodb').MongoClient;
var EventEmitter = require('events');
var ll = require('lillog');
/**
 *
 * module.exports.CMD_CONNECT = 'CONNECT';
 module.exports.CMD_CONNECTED = 'CONNECTED';
 module.exports.CMD_SEND = 'SEND';
 module.exports.CMD_SUBSCRIBE = 'SUBSCRIBE';
 module.exports.CMD_UNSUBSCRIBE = 'UNSUBSCRIBE';
 module.exports.CMD_ACK = 'ACK';
 module.exports.CMD_NACK = 'NACK';
 module.exports.CMD_BEGIN = 'BEGIN';
 module.exports.CMD_COMMIT = 'COMMIT';
 module.exports.CMD_ABORT = 'ABORT';
 module.exports.CMD_DISCONNECT = 'DISCONNECT';
 module.exports.CMD_MESSAGE = 'MESSAGE';
 module.exports.CMD_RECEIPT = 'RECEIPT';
 module.exports.CMD_ERROR = 'ERROR';
 */
module.exports = function () {
    var ret = {};
    var tcpserver = {};
    var subscriptions = new EventEmitter();
    ret.config = {
        serverport: 61613,
        mongourl: 'mongodb://localhost:27017/stimp'
    };


    ret.start = function () {
        mongo.connect(ret.config.mongourl, function (err, db) {
            if (err) {
                ll.error(err);
                process.exit(1);
            }
            tcpserver = net.createServer(function (sock) {
                sock.parser = stimpcommons.createparser(sock);
                sock.on('error', function (err) {
                    ll.error(err);
                });
                sock.uuid = stimpcommons.uuid();
                sock.delivertosubscription = function (msg) {
                    ll.log('Sending:' + JSON.stringify(msg) + ' to:' + sock);
                    sock.write(msg.torawmsg());
                };
                sock.parser.on('msg', function (msg) {
                    db.collection('msgs').insertOne(msg);
                    switch (msg.cmd) {
                        case stimpcommons.CMD_STOMP:
                        case stimpcommons.CMD_CONNECT:
                            var retmsg = stimpcommons.createmsg(stimpcommons.CMD_CONNECTED);
                            retmsg.addheader('version', '1.2');
                            retmsg.addheader('session', stimpcommons.uuid());
                            //In case msg was sent w receipt, we reply w it
                            if (msg.headers.receipt) {
                                retmsg.addheader('receipt-id', msg.headers.receipt);
                            }
                            sock.write(retmsg.torawmsg());
                            break;
                        case stimpcommons.CMD_CONNECTED:
                            throw new Error('Server should not get a ' + msg.cmd + ' Frame');
                            break;
                        case stimpcommons.CMD_SEND:
                            var fwdmsg = stimpcommons.createmsg(stimpcommons.CMD_MESSAGE);
                            fwdmsg.headers = msg.headers;
                            fwdmsg.headers.subscription = fwdmsg.headers.destination;
                            fwdmsg.headers['message-id'] = fwdmsg.headers.receipt;
                            //delete fwdmsg.headers.destination;
                            fwdmsg.body = msg.body;

                            subscriptions.emit(fwdmsg.headers.destination, fwdmsg);

                            var retmsg = stimpcommons.createmsg(stimpcommons.CMD_RECEIPT);
                            if (msg.headers.receipt) {
                                retmsg.addheader('receipt-id', msg.headers.receipt);
                            }

                            sock.write(retmsg.torawmsg());
                            break;
                        case stimpcommons.CMD_SUBSCRIBE:
                            subscriptions.on(msg.headers.destination, sock.delivertosubscription);
                            var retmsg = stimpcommons.createmsg(stimpcommons.CMD_RECEIPT);
                            if (msg.headers.receipt) {
                                retmsg.addheader('receipt-id', msg.headers.receipt);
                            }
                            sock.write(retmsg.torawmsg());
                            break;
                        case stimpcommons.CMD_UNSUBSCRIBE:
                            subscriptions.removeListener(msg.headers.destination, sock.delivertosubscription);
                            var retmsg = stimpcommons.createmsg(stimpcommons.CMD_RECEIPT);
                            if (msg.headers.receipt) {
                                retmsg.addheader('receipt-id', msg.headers.receipt);
                            }
                            sock.write(retmsg.torawmsg());
                            break;
                        case stimpcommons.CMD_ACK:
                            ll.debug(JSON.stringify(msg));
                            break;
                        case stimpcommons.CMD_NACK:
                            ll.debug(JSON.stringify(msg));
                            break;
                        case stimpcommons.CMD_BEGIN:
                            ll.debug(JSON.stringify(msg));
                            break;
                        case stimpcommons.CMD_COMMIT:
                            ll.debug(JSON.stringify(msg));
                            break;
                        case stimpcommons.CMD_ABORT:
                            ll.debug(JSON.stringify(msg));
                            break;
                        case stimpcommons.CMD_DISCONNECT:
                            var retmsg = stimpcommons.createmsg(stimpcommons.CMD_RECEIPT);
                            //In case msg was sent w receipt, we reply w it
                            if (msg.headers.receipt) {
                                retmsg.addheader('receipt-id', msg.headers.receipt);
                            }
                            sock.write(retmsg.torawmsg());
                            //TODO ADD CLEANUP CODE HERE
                            //sock.destroy();
                            break;
                        case stimpcommons.CMD_MESSAGE:
                            throw new Error('Server should not get a ' + msg.cmd + ' Frame');
                            break;
                        case stimpcommons.CMD_RECEIPT:
                            throw new Error('Server should not get a ' + msg.cmd + ' Frame');
                            break;
                        case stimpcommons.CMD_ERROR:
                            throw new Error('Server should not get a ' + msg.cmd + ' Frame');
                            break;
                        default:
                            break;

                    }
                });

            });
            tcpserver.listen(ret.config.serverport, '127.0.0.1');
        });
    };
    ret.stop = function () {
        tcpserver.close();
    };
    return ret;
};
