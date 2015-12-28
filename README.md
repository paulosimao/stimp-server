# Stimp Server
Simple STOMP Server intended to support STOMP 1.2

Important - please refer to Stimp Client - this client counterpart. (https://github.com/paulosimao/stimp-client)

Initially targets to interoperate with Stimp Client.

###### PLEASE KEEP IN MIND - THIS IS STILL WIP, THOUGH I TARGET HAVING A TOP  NOTCH MESSAGE INFRA, THIS IS IN EARLY STAGE OF DEVELOPMENT. HELP W IDEAS, FEATURES AND TESTING IS HIGHLY APPRECIATED.

Long history short (Or, get it done in 54 chars... ):

    var Server = new require('../index')();
    Server.start();

You can optionally set config options before calling start:

     server.config = {
        serverport: 61613,
        mongourl: 'mongodb://localhost:27017/stimp'
     };

- serverport: IP Port assigned to listen to clients
- mongourl: The messaging backend  is based on mongodb (maybe we will get some plugins later for other backends). Set DB url here.

##### TODO:
- ~~Send pending messages to clients connected after message submission~~
- ~~Create proper behavior to queues and topics (at the moment everything behave like topics)~~
- Improve error handling
- Improve message parsing (stimp-commons)
- Implement in box clustering
- Implement failover, multibox clustering
- Implement server to server broker architecture
- Improve standard message protocol with some spices (system/control queues)
- Implement pattern based subscription
- Create a client/GUI to manage the solution
- Create docker deployment model
- Create in memory message bus for colocated landscapes.


