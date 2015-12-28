/**
 * Created by paulo.simao on 23/12/2015.
 */

var net = require('net');
var stimpcommons = require('stimp-commons');
var mongo = require('mongodb').MongoClient;
var EventEmitter = require('events');
var ll = require('lillog');
/**
 module.exports.CMD_CONNECT = 'CONNECT';
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
    var server = {};
    var tcpserver = {};
    var subscriptions = new EventEmitter();
    server.config = {
        serverport: 61613,
        mongourl: 'mongodb://localhost:27017/stimp'
    };

    var socketwrapper = function (sock) {
        var ret = {
            sock: sock,
            uuid: stimpcommons.uuid(),
            parser: stimpcommons.createparser(sock),
            socksubscriptions: {},
            onstomp: function (msg) {
                var retmsg = stimpcommons.createmsg(stimpcommons.CMD_CONNECTED);
                retmsg.addheader('version', '1.2');
                retmsg.addheader('session', stimpcommons.uuid());
                //In case msg was sent w receipt, we reply w it
                if (msg.headers.receipt) {
                    retmsg.addheader('receipt-id', msg.headers.receipt);
                }
                this.sock.write(retmsg.torawmsg());
            },
            ondisconnect: function (msg) {

                for (dest in this.socksubscriptions) {
                    subscriptions.removeListener(dest, ret.dodelivertosubscription);
                }

                var retmsg = stimpcommons.createmsg(stimpcommons.CMD_RECEIPT);
                //In case msg was sent w receipt, we reply w it
                if (msg.headers.receipt) {
                    retmsg.addheader('receipt-id', msg.headers.receipt);
                }
                ret.sock.write(retmsg.torawmsg());
                //TODO ADD CLEANUP CODE HERE
                //sock.destroy();
            },
            onsend: function (msg) {
                //ll.debug(JSON.stringify(msg));
                var fwdmsg = stimpcommons.createmsg(stimpcommons.CMD_MESSAGE);
                fwdmsg.headers = msg.headers;
                fwdmsg.headers.subscription = fwdmsg.headers.destination;
                fwdmsg.headers['message-id'] = fwdmsg.headers.receipt;
                //delete fwdmsg.headers.destination;
                fwdmsg.body = msg.body;
                ret.dbsavemsgonsend(fwdmsg, function (err, data) {
                    if (err) {
                        //TODO SEND ERROR BACK TO CLIENT
                        return ll.error(err);
                    }
                    ret.dofwdmsg(fwdmsg);
                    var retmsg = stimpcommons.createmsg(stimpcommons.CMD_RECEIPT);
                    if (msg.headers.receipt) {
                        retmsg.addheader('receipt-id', msg.headers.receipt);
                    }

                    ret.sock.write(retmsg.torawmsg());
                });
            },
            onsubscribe: function (msg) {
                subscriptions.on(msg.headers.destination, ret.dodelivertosubscription);
                ret.socksubscriptions[msg.headers.destination] = true;
                ret.dbcheckpendingmsgs(msg.headers.destination);
                var retmsg = stimpcommons.createmsg(stimpcommons.CMD_RECEIPT);
                if (msg.headers.receipt) {
                    retmsg.addheader('receipt-id', msg.headers.receipt);
                }
                ret.sock.write(retmsg.torawmsg());
            },
            onunsubscribe: function (msg) {
                delete ret.socksubscriptions[msg.headers.destination];
                subscriptions.removeListener(msg.headers.destination, ret.dodelivertosubscription);

                var retmsg = stimpcommons.createmsg(stimpcommons.CMD_RECEIPT);
                if (msg.headers.receipt) {
                    retmsg.addheader('receipt-id', msg.headers.receipt);
                }
                ret.sock.write(retmsg.torawmsg());
            },
            onack: function (msg) {
                console.log(JSON.stringify(msg));
                ret.dbarchivemsg(msg.headers.id, false, function (err) {
                    if (err) {
                        //TODO SEND ERROR FRAME IN THIS CASE
                        ll.error(err);
                    }
                })

            },
            onnack: function (msg) {
                ret.dbarchivemsg(msg.headers.id, true, function (err) {
                    if (err) {
                        //TODO SEND ERROR FRAME IN THIS CASE
                        ll.error(err);
                    }
                })
            },
            dofwdmsg: function (msg) {
                try {
                    if (msg.headers.destination.startsWith('/queue')) {
                        var fwdmethod = subscriptions.listeners(msg.headers.destination)[0];
                        fwdmethod(msg);
                    } else {
                        subscriptions.emit(msg.headers.destination, msg);
                    }
                } catch (err) {
                    ll.debug(msg)
                    ll.error(err)
                }
            },
            dodelivertosubscription: function (msg) {
                //ll.log('Sending:' + JSON.stringify(msg) + ' to:' + sock);
                ret.sock.write(msg.torawmsg());
            },

            dbsavemsgonsend: function (msg, cb) {
                server.db.collection(msg.headers.destination).insertOne(msg);
                server.db.collection('msgindex').insertOne({
                    msgid: msg.headers.receipt,
                    destination: msg.headers.destination
                }, cb);
            },
            dbarchivemsg: function (id, deadletter, cb) {
                var finalcol = deadletter ? 'deadletter' : 'archive';
                server.db.collection('msgindex').findOne({msgid: id}, function (err, doc) {
                    var destcol = doc.destination;
                    if (err) {
                        return cb(err);
                    }
                    if (doc) {
                        server.db.collection(destcol).findOne({'headers.message-id': id}, function (err, doc) {

                            server.db.collection(finalcol + doc.headers.destination).insertOne(doc, function (err, data) {
                                if (err) {
                                    return cb(err);
                                }
                                server.db.collection(destcol).deleteOne({'headers.message-id': id}, function (err, data) {
                                    if (err) {
                                        ll.error(err);
                                    }
                                    server.db.collection('msgindex').deleteOne({msgid: id}, function (err, data) {
                                        if (err) {
                                            return cb(err);
                                        } else {
                                            cb(null);
                                        }
                                    });

                                });

                            });

                        });
                    }

                });

            },
            dbcheckpendingmsgs: function (destination) {
                server.db.collection(destination).find({}).forEach(function (doc) {
                    process.nextTick(function () {
                        var msg = stimpcommons.addmethodstomsg(doc);
                        ret.sock.write(msg.torawmsg());
                    });
                });
            },


            init: function () {
                ret.parser.on(stimpcommons.CMD_STOMP, ret.onstomp);
                ret.parser.on(stimpcommons.CMD_CONNECT, ret.onstomp);
                ret.parser.on(stimpcommons.CMD_DISCONNECT, ret.ondisconnect);
                ret.parser.on(stimpcommons.CMD_SEND, ret.onsend);
                ret.parser.on(stimpcommons.CMD_SUBSCRIBE, ret.onsubscribe);
                ret.parser.on(stimpcommons.CMD_UNSUBSCRIBE, ret.onunsubscribe);
                ret.parser.on(stimpcommons.CMD_ACK, ret.onack);
                ret.parser.on(stimpcommons.CMD_NACK, ret.onnack);
            }
        }
        ret.init();
        return ret;
    }


    server.start = function () {
        mongo.connect(server.config.mongourl, function (err, db) {
            if (err) {
                ll.error(err);
                process.exit(1);
            }
            server.db = db;
            tcpserver = net.createServer(function (sock) {
                sock.wrapper = new socketwrapper(sock);
                sock.on('error', function (err) {
                    ll.error(err);
                });
            });
            tcpserver.listen(server.config.serverport, '127.0.0.1');
        });
    };
    server.stop = function () {
        tcpserver.close();
    };
    return server;
};
