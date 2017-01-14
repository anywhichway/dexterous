# dexterous

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/1daac1a5b69c44f68b4dc36713a4acc7)](https://www.codacy.com/app/syblackwell/dexterous?utm_source=github.com&utm_medium=referral&utm_content=anywhichway/dexterous&utm_campaign=badger)

A light weight isomorphic JavaScript middleware server for browser, WebWorkers, and NodeJS.

# Introduction

Dextrous is an application middleware server similar to Koa.js or Node Express; however, is was designed from the start to be smaller (less than 6K core minimized and 2K gzipped) and run in either a browser or NodeJS server environment. In addition, Dexterous will route requests made using the `ws:` protocol just as well as requests made using the `http:` protocol. Finally, Dextrous comes with a remote object proxy and handler.

# Installation

npm install dexterous

The core files `dexterous.js` and `remote.js` can be used directly in a browser or in NodeJS applications. Files in the `browser` directory can be used direclty in a web browser. Files in the `nodejs` directory can be used in NodeJS applications.

There are a number of utility handlers in the `handler` directory, most of which can be used just as well in a browser as in a NodeJS application. Although, there are a few, e.g. `static.js` that only make sense on the recieving end of `http` requests.

The sole dependency for Dexterous is the `ws` package.

# Basic Use

## Servers

Developers familiar with Koa or Node Express will be able to make use of basic Dexterous capability with little or no instructions. The simplest Dexterous NodeJS application is a server for delivering files from the directory tree in which the app is launched and looks as follows:

```
const Dexterous = require("dexterous.js"),
	server = new Dexterous.Server();
server.use(require("handlers/static.js")());
server.listen(3000,"127.0.0.1");
```

Handlers have either of the following signatures:

```
function *(request,response,next) { ... [yield next ...] } // [ ] indicate optional code
function (request,response,next) { ... [return next]; }
```
If a generator function is used then the portion before the `yield` is called on the way down the handler stack and the portion after the `yield` is called as the handler stack unwinds. The handler `RequestResponseLogger` uses this approach to log inbound requests as they come in and outbound responses immediately after they are sent, even though it is the first handler below:

```
const Dexterous = require("dexterous"),
	server = new Dexterous.Server();
server.use(require("handlers/RequestResponseLogger"));
server.use(require("handlers/static")());
server.listen(3000,"127.0.0.1");
```

## Clients

Clients are created in a manner similar to servers. Once connected to a server, the server can send requests to the client as though it were a peer server and they will be processed using any handlers installed on the client, e.g:

```
const Dexterous = require("dexterous.js");
const client = new Dexterous.Client();
client.use(require("handlers/RequestResponseLogger"));
client.listen(3000,"127.0.0.1");
```

Similar client creation code can be used in a browser without the need for Browserify:

```
<script type="text/javascript" src="/dexterous/dexterous.js"></script>
<script type="text/javascript" src="/dexterous/handlers/RequestResponseLogger.js"></script>
<script>
const client = new Dexterous.Client();
client.use(RequestResponseLogger));
client.listen(3000,"127.0.0.1");
</script>
```

If the following were invoked on a server,then the `client` would log the request and response, although no response would be sent back to the server because the client is only configured to log requests.

```
const response = server.createResponse();
response.writeHeader(200); // the content type will default to either text/plain or application/json depending on what is written
response.end("hello client!");
```

## Response Object

`Response` objects will either be the response instance created by the http server around which a Dexterous application is wrapped or a special response instance that provides the same calling interface. As a result, responses to requests over the `ws:` protocol can be treated in a manner similar to those over `http:`.

The `.end` method on a socket response has an extra argument indicating if the response represents a message that expects a return value. When set to true, the reponse header method gets set to `GET` and the method will return a Promise.

When a server is recieving a request, a response object is automatically created. If a client wish to send information to a server or a server wished to sned information to a client unsolicitied, then a response object needs to be created using `<clientOrServer>.createResponse()`. See the handler examples below.

## Handlers

All built-in handlers are provided in files of the same name as the handler in the directory `handlers`.

### JavaScriptRunner

`JavaScriptRunner` is a function factory that returns a handler. Its signature is `(scope={},returnsError)`. Requests recieved with a `Content-Type` header of `application/javascript` or `text/javascript` will have their body evaluated in the scope provided. Providing a `null` scope, will cause evaluation in the global scope ... which could be very useful but also very risky. Providing no scope, i.e. `undefined` will default to `{}` which will provide access to the console and little else. The below code will log the number 100 to the console, assuming the server to which the client is attached is using a JavaScriptRunner. See the examples directory.

```
let message = client.createResponse();
	message.writeHead(200,{"Content-Type":"application/javascript"});
	message.end("return 10 * 10",true).then((result) => {
		browserConsole.log(result);
	});
```

`JSONParser` will parse and replace `request.body` as JSON when the `request.header["Content-Type"]==="application/json"`. If the existing body can't be parsed, then it is not changed. `JSONParser` should always be used on the receiving end of services using `JavaScriptRunner` so that the responses can be parsed,i.e. if the server uses `JavaScriptRunner` then the client should use `JSONParser` and if the client uses `JavaScriptRunner` then the service should use `JSONParser`.

The below will first print "string" and then print "object".

```
const Dexterous = require("dexterous.js");
const server = new Dexterous.Server();
server.listen(3000,"127.0.0.1").then(() => {
	let message = server.createResponse();
		message.writeHead(200,{"Content-Type":"application/JSON"});
		message.end({message:"Hello!",serverTime:Date.now()}); // this will be stringified for transit
});
const client = new Dexterous.Client();
client.use(function *(request,response,next) { console.log(typeof(request.body)); yield next; console.log(typeof(request.body)); });
client.use(require("handlers/JSONParser"));
client.listen(3000,"127.0.0.1");
```

`RemoteCall` if a function factory that returns a handler which responds to remote call requests with non-null content type of "application/javascript" and method GET. The signature is `(scope,returnsError)`. The `scope` should be the default execution scope for requests. This may be overridden by providing a `thisArg` property values as described below.

The handler expects a request with a body that may be a JSON object or a string parseable as a JSON object. The handler `JSONParser` is not required, and in fact would do nothing since the content type is not "application/json". The response content type will always be "application/json".

The body object must have some combination of these properties:

1. `thisId` (optional) - If provided it can be used by a pre-handler which would set a `thisArg` property on `request.body` higher in the handler stack. The pre-handler would be responsible for parsing the request body if necessary.
2. `thisArg` (optional) - Used as the context for get and set requests or function calls.
3. `key` - The name of the key referring to a property value or function to use.
4. `argumentsList` - An Array that is expected if the `key` refers to a function.
5. `value` (optional) - if provided and the `key` refers to a property, the property is set to the value, othwerwise it is ignored. If no `value` is provided, the handler returns the current value of the property to the client.

There is a convenience class that can be loaded from `/dexterous/remote.js`. This will enhance Dexterous so that it provides a constructor `Dexterous.Remote`. This class takes a client as a constructor argument and provides the methods `get`,`set`,`call`, and `apply` which it marshalls into the appropriate form for dispatch by the client. `Dexterous.Remote` does not currently support a schema argument to ensure all requests to be made of the server are correct. See the example `examples/RemoteCall`.

`RequestResponseLogger` - Simply logs the request body on the way down the handler stack and the response on the way back up. Usually placed as the first handler.

`static` - A function factory that returns a handler configured to load files out of the directory tree provided as the argument. If a requested URL is not found, `static` will yield to the next handler. Dexterous has a build in handler that will return 404 - Not Found if http requests remain unhandled by the time the handler stack has been fully processed.

`URLContentType` - A function factory that return handler that sets the `Content-Type` header of the response object to a content type based on the extension of the requested resource. The default handler only processes `.js`, `.htm`, and `.html` extensions. Additonal extensions can be provided via a map argument to the factory. The map should take the form `{".<extension>":"<content type>"[,...]}`. If the map argument is provided, it takes precedence for conflicting extension keys and will over-ride the built-ins.

`virtual` - A function factory that returns a handler configured to map a URI prefix to a static directory. Dexterous uses this interally to map the root URI `/dextrous` to either the root directory of the `/node_modules/dexteorus` directory.

# Advanced Use

## Web Workers

Dexterous supports the creation of WebWorker and SharedWorker(Chrome Only) clients:

```
const worker = new Dexterous.Worker();
worker.listen(3000,"127.0.0.1",<path to worker code>)
```

```
const worker = new Dexterous.SharedWorker();
worker.listen(3000,"127.0.0.1",<path to worker code>)
```

The worker code file will generally take the form:

```
importScripts("/dexterous/dexterous.js",
		"/dexterous/browser/server.js",
		[<handler file>,...]);
const server = new Dexterous.Server();
server.use(<handler>);
server.use(function *(request,response,next) => { ... yield next ... });
// more use statements
server.listen(this);
```

See the `examples` directory.

# Debugging

If your Dexteorus server does not seem to be responding but is up, there is probably a handler which is failing to return next when it needs to after discovering it does not apply to a request that has been routed to it.

# API

To be written

# Updates (reverse chronological order)

2017-01-15 v0.0.4 - Documentation.

2017-01-13 v0.0.3 - Made more modular. Added DexterousRemote.

2017-01-13 v0.0.2 - Externalized handlers. Added examples.

2017-01-13 v0.0.1 - Early beta
