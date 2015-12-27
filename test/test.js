/**
 * Created by paulo.simao on 23/12/2015.
 */
//var e = require('events');
//var ee = new e();
//var util = require('util');
//ee.on('a', function () {
//    console.log('l1');
//})
//ee.on('a', function () {
//    console.log('l2');
//})
//ee.emit('a');
//ee.listeners('a')[0]();
//console.log(util.inspect(ee.listeners('a')));
//console.log()
var Server = new require('../index')();
Server.start();

//describe('Simple Server Test', function () {
//    it('Simple Server Test', function (done) {
//    });
//});
//server.stop();
//var s = 'a\nb\nc\n\n\def\0';
//console.log(s);
//var sm = s.split('\0');
//console.log(sm);
//var sm1 = sm[0];
//console.log(sm1.split('\n'));