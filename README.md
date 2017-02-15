# dexterous

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/1daac1a5b69c44f68b4dc36713a4acc7)](https://www.codacy.com/app/syblackwell/dexterous?utm_source=github.com&utm_medium=referral&utm_content=anywhichway/dexterous&utm_campaign=badger)

A light weight isomorphic JavaScript middleware server for browser, WebWorkers, and NodeJS.

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/1daac1a5b69c44f68b4dc36713a4acc7)](https://www.codacy.com/app/syblackwell/dexterous?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=anywhichway/dexterous&amp;utm_campaign=Badge_Grade)

# Introduction

Dexterous is an application middleware server similar to Koa.js or Node Express; however, it was designed from the start to run in either a browser or NodeJS server environment and be smaller. The client core is less than 400 lines of code, 6K minimized or 2K gzipped. The server has minimal dependencies, i.e. `ws` and `watch` and their dependencies. 

Dexterous will route requests made using the `ws:` protocol just as well as requests made using the `http:` protocol. Dexterous also comes with:

1) A bi-directional object proxy and handler so clients can offload computation to servers or servers can offload computation to clients.

2) A more declarative approach to URL routing of REST requests.

3) Simple REST enablement for CURL requests.

4) A watch handler similar to Meteor and Ember so that any file changes on the server will force clients to reload pages when a page or resources it references change.

# Installation

npm install dexterous

The core files `dexterous.js` and `remote.js` can be used directly in a browser or in NodeJS applications. Files in the `browser` directory can be used direclty in a web browser. Files in the `nodejs` directory can be used in NodeJS applications.

There are a number of utility handlers in the `handler` directory, most of which can be used just as well in a browser as in a NodeJS application. Although, there are a few, e.g. `static.js` that only make sense on the recieving end of `http` requests.

The dependencies for Dexterous are `ws`, `ultron`, `minimist`, `watch`, `options`, `merge`, and `exec-sh`.

# Basic Use

## Examples

It is encouraged to review the examples in `/examples` by running `node exampleServer` and then loading `http://127.0.0.1:3000/` in a browser.

## Servers

The call signature to create a server is `new Dexterous.Server(server,options={})`.

`server` - Either a node http/https server or `null`, in which case an http server will be created.

`options` can have two properties:

1) `last` - A final handler to generate a response if no handler has created a `response.body`. The default sends a `404` for http/https or a `501` for ws requests.

2) `timeout` - The timeout is milliseconds to wait for some handler to call end so a response can be sent. The default is 10000ms. A `503 Service Unavailable` is sent after the timeout.


Developers familiar with Koa or Node Express will be able to make use of basic Dexterous capability with very little effort. The simplest Dexterous NodeJS application is a server for delivering files from the directory tree in which the app is launched and looks as follows:

```
const Dexterous = require("dexterous/dexterous"),
	server = new Dexterous.Server();
server.use(require("dexterous/handlers/static")());
server.listen(3000,"127.0.0.1");
```

Handlers have either of the following signatures:

```
function *(request,response,next) { ... [yield next ...] } // [ ] indicates optional code
function (request,response,next) { ... [return next]; }
```
If a generator function is used, then the portion before the `yield` is called on the way down the handler stack and the portion after the `yield` is called as the handler stack unwinds. The handler `RequestResponseLogger` uses this approach to log inbound requests as they come in and outbound responses immediately after they are sent, even though it is the first handler below:

```
const Dexterous = require("dexterous/dexterous"),
	server = new Dexterous.Server();
server.use(require("dexterous/handlers/RequestResponseLogger"));
server.use(require("dexterous/handlers/static")());
server.listen(3000,"127.0.0.1");
```

Handlers are free to modify the `response` and `request` objects. The property `response._headerSent` will be true if a `response` has already been sent. Trying to send more data will result in an error.

Handlers must do one of the following:

1) return `next`

2) call `response.end`

3) call `response.end` and return `next`

If one of the above does not occur within the timeout period set in the server or client creation options (default 10000ms), then a `503 Service Unavailable` error will be sent.

If the handler stack is completely processed and there is no `response.body` then either a `404 Not Found` or `501 Not Implemented` error will be returned by default. To override this, provide a hander as a value for `options.last`.

In general the specification order of handlers should be:

1) Request and response modifiers

2) Dynamic content

3) Static content

## Clients

Clients are created in a manner similar to servers. The call signature is `new Dexterous.Client(options={})`.

Clients can have handler attached jsut like servers and take the same options object! Once connected to a server, the server can send requests to the client as though it were a peer server and they will be processed using any handlers installed on the client, e.g:

```
const Dexterous = require("dexterous/dexterous");
const client = new Dexterous.Client();
client.use(require("dexterous/handlers/RequestResponseLogger"));
client.listen(3000,"127.0.0.1");
```

Similar client creation code can be used in a browser:

```
<script type="text/javascript" src="/dexterous/dexterous.js"></script>
<script type="text/javascript" src="/dexterous/handlers/RequestResponseLogger.js"></script>
<script>
const client = new Dexterous.Client();
client.use(RequestResponseLogger));
client.listen(3000,"127.0.0.1");
</script>
```

If the following were invoked on a server, then the `client` would log the request and response, although no response would be sent back to the server because the client is only configured to log requests.

```
const response = server.createResponse();
response.writeHeader(200); // the content type will default to either text/plain or application/json depending on what is written
response.end("hello client!");
```

## Response Object

`Response` objects will either be the response instance created by the http server around which a Dexterous application is wrapped or a special response instance that provides the same calling interface. As a result, responses to requests over the `ws:` protocol can be treated in a manner similar to those over `http:`.

The `.end` method on a socket response has an extra argument indicating if the response represents a message that expects a return value. When set to true, the reponse header method gets set to `GET` and the method will return a Promise.

When a server receives a request, a response object is automatically created and passed to the handlers. If a client wishes to send information to a server or a server wishes to send information to a client unsolicitied, then a response object needs to be created using `<clientOrServer>.createResponse()`. See the handler examples below.

## Handlers

All built-in handlers are provided in files of the same name as the handler in the directory `handlers`.

### DefaultFile

`DefaultFile` is a function factory that returns a handler configured to re-write the requested URL if a URL terminated with a `/` is requested. It will also re-write a `referer` in a header for socket client requests.

The function factory call signature is `(file)`.

### JavaScriptRunner

`JavaScriptRunner` is a function factory that returns a handler. Its signature is `(scope={},returnsError=false)`. Requests recieved with a `content-type` header of `application/javascript` or `text/javascript` will have their body evaluated in the scope provided. Providing a `null` scope, will cause evaluation in the global scope ... which could be very useful but also very risky. Providing no scope, i.e. `undefined` will default to `{}` which will provide access to the console and typical JavaScript built-ins like Math. The below code will log the number 100 to the console, assuming the server to which the client is attached is using a `JavaScriptRunner`.

Below is an example call:

```
let message = client.createResponse();
	message.writeHead(200,{"content-type":"application/javascript"});
	message.end("return 10 * 10",true).then((result) => {
		browserConsole.log(result);
	});
```

See the `examples\JavaScriptRunner` directory.

### JSONParser

`JSONParser` will parse and replace `request.body` as JSON when the `request.header["content-type"]==="application/json"`. If the existing body can't be parsed, then it is not changed. `JSONParser` should always be used on the receiving end of services using `JavaScriptRunner` so that the responses can be parsed, i.e. if the server uses `JavaScriptRunner` then the client should use `JSONParser` and if the client uses `JavaScriptRunner` then the server should use `JSONParser`.

The below will first print "string" and then print "object".

```
const Dexterous = require("dexterous/dexterous");
const server = new Dexterous.Server();
server.listen(3000,"127.0.0.1").then(() => {
	let message = server.createResponse();
		message.writeHead(200,{"content-type":"application/JSON"});
		message.end({message:"Hello!",serverTime:Date.now()}); // this will be stringified for transit
});
const client = new Dexterous.Client();
client.use(function *(request,response,next) { console.log(typeof(request.body)); yield next; console.log(typeof(request.body)); });
client.use(require("dexterous/handlers/JSONParser"));
client.listen(3000,"127.0.0.1");
```

### MethodQueryString

`MethodQueryString` if a function factory returning a handler that looks for a `method` query parameter and replaces the request.headers.method with the value. The value is upper cased during processing. `MethodQueryString` is useful when an entirely client based CURL usable REST API is needed without the complexities of JavaScript XHR or other request marshaling approaches. If the method is PUT or POST, a `body` parameter will also be sought and parsed as JSON to replace the `request.body`. The JSON in the query string MUST use normal double quotes, e.g. `{"name":"Joe"}` not `{'name':'Joe'}` or `{\"name\":\"Joe\"}`.

The `MethodQueryString` function factory takes one boolean argument. If `true` body parsing errors are ignored. If `false` (the default) the response is populated with a 400 status code and a body that says "Bad Request"; however, handler processing continues in case a subsequent handler can address the request.

### RemoteCall

`RemoteCall` is a function factory that returns a handler which responds to remote call requests with non-null content type of "application/javascript" and method GET. The signature is `(scope,returnsError)`. The `scope` should be the default execution scope for requests. This may be overridden by providing a `thisArg` property values as described below.

The handler expects a request with a body that may be a JSON object or a string parseable as a JSON object. The handler `JSONParser` is not required, and in fact would do nothing since the content type is not "application/json". The response content type will always be "application/json".

The body object must have some combination of these properties:

1. `thisId` (optional) - If provided it can be used by a pre-handler which would set a `thisArg` property on `request.body` higher in the handler stack. The pre-handler would be responsible for parsing the request body if necessary.

2. `thisArg` (optional) - Used as the context for get and set requests or function calls.

3. `key` - The name of the key referring to a property value or function to use.

4. `argumentsList` - An Array that is expected if the `key` refers to a function.

5. `value` (optional) - if provided and the `key` refers to a property, the property is set to the value, othwerwise it is ignored. If no `value` is provided, the handler returns the current value of the property to the client.

There are two convenience methods that can be loaded from `/dexterous/remote.js`. This will enhance Dexterous so that all server and client instances provide:

1) `<server>.createRemote(schema,socket)` which returns and object with the methods `get`,`set`,`put`, `call` and `apply` which marshall calls into the appropriate form for dispatch by the client. `<server>.createRemote(schema,socket)` does not currently uses the `schema` argument to ensure all requests to be made of the server are valid. It is reserved for future use. See the example `examples/RemoteCall`.

2) `<server>.createRemoteProxy(functionOrObject,schema,socket)` which operates at a higher level than `createRemote` to create mixed mode objects that can operate both locally and with remote calls. See the tutorial [Dexterous: Mixed Local And Remote Objects In Less Than 10 Lines](http://anywhichway.ghost.io/2017/01/21/dexterous-mixed-local-and-remote-objects/).

### RequestResponseLogger

`RequestResponseLogger` simply logs the request body on the way down the handler stack and the response on the way back up. Usually placed as the first handler.

### REST

`REST` is a function factory that returns a REST handler. The approach is more decalaritive and concise than that taken by Express or Koa. All responders are clustered together as part of a single object. Additionally, a separate router object does not have to be created. 

The signature for the factory is `(path,{<method>:(id,request,response,next)[,...]})`. The useful values for `<method>` are `get`,`put`,`post`,`delete`. The `id` argument to the handler is parsed from the url of the request.

Not writing a response will cause the server to fall through to a default `404 Not Found` or `400 Bad Request` error.

The below exampe is drawn from code in `exampleServer.js`:

```
server.use(require("./handlers/REST")("/REST/test/",{
	get: (id,request,response,next) => {
		if(typeof(id)!=="undefined") {
			response.end("GET with id: " + id);
		}
	},
	post: (id,request,response,next) => {
		if(request.body) {
			if(id) {
				request.body.id = id;
				response.end("POST with id: " + id  + (request.body ? " and with body " + JSON.stringify(request.body) : ""));
			} else { 
				request.body.id = Math.round(Math.random()*1000);
				response.end("POST without id (server assigned)" + (request.body ? " and with body " + JSON.stringify(request.body) : ""));
			}
		}
	},
	put: (id,request,response,next) => {
		if(request.body && id) {
			response.end("PUT with id: " + id  + (request.body ? " and with body " + JSON.stringify(request.body) : ""));
		}
	},
	delete: (id,request,response,next) => {
		if(id) {
			response.end("DELETE with id: " + id);
		}
	}
}));
```

### static

`static` is a function factory that returns a handler configured to load files out of the directory tree provided as the argument. If a requested URL is not found, `static` will yield to the next handler. Dexterous has a built in handler that will return 404 - Not Found if http requests remain unhandled by the time the handler stack has been fully processed.

The call signature is `(root="/")`. The `root` should start with a `/` and is relative to the current working directory of the NodeJS process.

### URLContentType

`URLContentType` is a function factory that returns a handler that sets the `content-type` header of the response object to a content type based on the extension of the requested resource. There are a number of built-ins as shown below. Additonal extensions can be provided via a map argument to the factory. The map should take the form `{".<extension>":"<content type>"[,...]}`. If the map argument is provided, it takes precedence for conflicting extension keys and will over-ride the built-ins.

The call signature is `(moreTypes={})`.

The built-ins are:

```
".gzip": "application/gzip",
".gif": "image/gif",
".htm": "text/html",
".html": "text/html",
".ico": "image/x-icon",
".jpg": "image/jpeg",
".jpeg": "image/jpeg",
".js": "application/javascript",
".md": "text/markdown",
".mp4": "video/mp4",
".mp4v": "video/mp4",
".mpg4": "video/mp4",
".mpg": "video/mpeg",
".mpeg": "video/mpeg",
".pdf": "applicaion/pdf",
".png": "image/png",
".txt": "text/plain",
".wsdl": "application/wsdl+xml",
".xml": "application/xml",
".xsl": "application/xml"
```

### virtual

`virtual` is a function factory that returns a handler configured to map a URI prefix to a static directory. Dexterous uses this interally to map the root URI `/dextrous` to either the root directory or the `/node_modules/dexterous` directory.

The call signature is `(alias,root)`. Both arguments are strings and should start with `/`.

### watch

`watch` is a function factory that given a server instance and directory will return a handler to watch the directory tree and notify connected browser clients to reload themselves when any resources in the directory tree they reference change. Updates to files outside the directory tree but referenced by the client will not cause reloads. Make sure to watch a directory sufficiently high in the tree. `watch` can only be called once, subsequent calls are no-ops.

Watch should be placed after a `DefaultFile` handler on the server. 

The call signtaure is `watch(server,directory="/")`. The `directory` argument should start with a `/`, e.g.

```
server.use(require("dexterous/handlers/watch")(server,"/examples/Watch")); // should always go after DefaultFile handler
```

The clients must be regular browser clients, not web workers, and must use a `JavaScriptRunner` that exposes the document object, e.g.:

```
const client = new Dexterous.Client();
client.use(JavaScriptRunner({document}));
client.listen(3000,(window.location.hostname.length>0 ? window.location.hostname : "127.0.0.1"));
```

See `examples/Watch` and the source for `/exampleServer.js`.


# Advanced Use

## Web Workers

Dexterous supports the creation of WebWorker and SharedWorker(Chrome Only) clients:

```
const client = new Dexterous.WorkerClient();
client.listen(3000,"127.0.0.1",<path to worker code>)
```

```
const client = new Dexterous.SharedWorkerClient();
client.listen(3000,"127.0.0.1",<path to worker code>)
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

If your Dexteorus server does not seem to be responding but is up, there is probably a handler which is failing to return 'next' when it needs to after discovering it does not apply to a request that has been routed to it.

# API

To be written

# Updates (reverse chronological order)

2017-01-29 v0.2.7 - Added Content-length to headers via handlers.

2017-01-23 v0.2.6 - Added more intelligence to REST to automatically reject poolry formed REST requests. Added a generic Headers handler to add default headers.

2017-01-22 v0.2.5 - Watch service in `exampleServer.js` now restored.

2017-01-21 v0.2.4 - v0.2.3 broke parts of REST handling. Now fixed. `watch` capability now broken.

2017-01-21 v0.2.3 - Improved REST and URL handling.

2017-01-21 v0.2.2 - Documentation updates.

2017-01-21 v0.2.1 - Enhanced RemoteCall.

2017-01-18 v0.2.0 - Replaced `response.headers.sent` with `response._headerSent` to be consistent with NodeJS. Added response timeout capability. Ensured final default handler sends proper headers. Revised watch handler to be more efficient. Added more examples.

2017-01-16 v0.1.0 - Documentation and example updates. Added `watch` handler. Revised naming of Worker classes to be appended with "Client". Lowercased "content-type" to make consistent with NodJS approach to header processing.

2017-01-15 v0.0.5 - Documentation updates. Also added `DefaultFile`,`REST`, and `MethodQueryString` handlers.

2017-01-15 v0.0.4 - Documentation.

2017-01-13 v0.0.3 - Made more modular. Added DexterousRemote.

2017-01-13 v0.0.2 - Externalized handlers. Added examples.

2017-01-13 v0.0.1 - Early public release.
