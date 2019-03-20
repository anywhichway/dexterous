# dexterous v1.0.5

`Dexterous` is a light weight isomorphic JavaScript middleware server for browser pages, Workers, ServiceWorkers, NodeJS and Cloudflare.

v1.0.x is a complete re-write of v0.2.x to simplify usage and optimize performance. As a result, some functionality available in the v0.2.x version is not yet available.

# Introduction

`Dexterous` is similar to `Koa.js` or `Node Express`; however, it was designed from the start to be isomoprhic and run in any of a web page, a Worker, a SharedWorker, a ServiceWorker or NodeJS server environment and be smaller. 

The original version was rather complex to use. It has now been made smaller and simpler and tested on the [Cloudflare CDN](https://www.cloudflare.com). That's right, you can actually run a `Dexterous` app server on the CDN edge! In fact, `Dexterous` normalizes the calling interface across all the environments it supports.

The core is less than 200 lines of code and just 1k gzipped with no dependencies.  

Note, small does not mean less powerful. In fact, we have even included an app server, `DexterousExpress`, that uses nothing but `Dexterous` itself to emulate substantial portions of Express!

# Installation

`npm install dexterous`

# Basic Use

## Examples

You are encouraged to review the examples in `/examples/<exampleName>` by changing to the directory where Dexterous is installed, typically `./_node_modules/dexterous` and running `npm run <exampleName>` and then loading `http://localhost:8080/index.html` in a browser. If you have a port conflict, you can add `-- <port>` as a final argument.

## Writing A Server

A server is simply a listener that dispatches incoming events to a series of middleware. Writing a server is done in a manner similar to `Express`. Basic `Dexterous` servers make no assumptions about the types of events passed in. For familiarity, we will start by using a sub-class called `DexterousHttpServer`, which is very similar to `Express` and assumes an event consists of a `request` and a `response`. Below is a server that always returns `Hello`.

```javascript
const DexterousHttpServer = require("dexterous-http-server"),
	app = new DexterousHttpServer();
app.use(
	value => {
		const {response} = value;
		response.end("Hello");
	}
)
app.listen(8080);
```

There are several things to note:

1) Unlike `Express`, the middleware takes a single argument that is destructured to get at the `response`.

2) There is no required test condition for the middleware, although the first callback can be used as a test if desired.

3) There is no `next` function.

You can see the section Design Decisions for detailed rationale. Here we will just explain what is going on.


`app.use` takes an arbitrary number of arguments the same as it does with `Express`. If the first argument is a `string`, it is treated as a path filter just like `Express`, otherwise all arguments are callback functions that take the form:

```javascript
value => {
	// destructuring assignment
	
	// processing
	
	// optional return value
}
```

You can also name your functions:

```javascript
function sayHellow(value) {
	// destructuring assignment
	
	// processing
	
	// optional return value
}
```

This is useful if you ever need to debug your app with tracing. `Dexterous` will print these names to a log stream as it runs.


`Dexterous` middleware are effectively pipes using an enhanced version of the `Iterable` return value protocol. The pipe steps either return `undefined` or an object with one or both of two properties `value` and `done`:

```javascript
{
	value: boolean|number|string|object,
	done: boolean
}
```

If `{value:<some value>}` is returned, that value is used as input to the next middleware function.

If `{done:true}` is returned, the rest of the current middleware is skipped and all processing is considered complete. All other middleware is skipped because `value` is undefined.

If `{value:<some value>, done:true}` is returned, the rest of a middleware is skipped and the next middleware is processed using the provided value as input. If the function is the last step in a middleware, `done:true` is assumed.

If `undefined` or a value that does not contain the properties `done` or `value` is returned, it is assumed all processing is complete. All other middleware is skipped.


We can enhance our initial server to only process `GET` requests:


```javascript
const app = new DexterousHttpServer();
app.use(
	function checkMethod(value) {
		const {request} = value;
		if(request.method==="GET") {
			return {value}; // pass value to next step
		}
		return {done:true,value:true}; // we are done with this middleware
	},
	function sayHello(value) {
		const {response} = value;
		response.end("Hello");
		return; // we are done with processing
	}
)
```

`DexterousHttpServer` has a built in `404 Not Found` handler that will respond to anything that is not a `GET` above.

What if we want to respond to two different routes, `/hello` and `/goodbye`? `Dexterous` can handle that in a manner similar to `Express`:

```javascript
const app = new DexterousHttpServer();
app.use(
	function checkPath(value) {
		const {request} = value;
		if(request.location.pathname==="/hello") {
			return {value}; // pass value to next step
		}
		return {done:true,value}; // we are done with this middleware
	},
	function sayHello(value) {
		const {response} = value;
		response.end("Hello");
		return; // we are done with processing
	}
);
app.route("/goodbye").use(
	function sayGoodbye(value) {
			const {response} = value;
			response.end("Goodbye");
			return; // we are done with processing
		}
	);
```


Things to note:

1) We used two different approaches above, just as you could in Express.

2) We referenced a `request.location` rather than `request.url`. See Design Decisions for more detail.

We leave it as an exercise for you to add a `GET` filter to the above. See the source of `examples/HttpServer` for the solution.

# Worker and ServiceWorker Servers

Worker servers can be created with `Dexterous`, `DexterousHttpServer`, or `DexterousExpress`. The code will be identical to a regular server, except that the first argument to `listen` with be the special worker variable `self` rather than a port number and `options` should have the following shapes:

## Workers and Shared Workers

```javascript
{
	events: ["message"]
}
```

## ServiceWorkers


```javascript
{
	events: ["fetch"]
}
```

For example:

const Dexterous = require("dist/dexterous"),
	dx = new Dexterous({trace:1,log:console});
dx.route("/hello").use(
    value => {  
      value.response = new Response("at your service",{status:200,statusText:"ok"});
	}
);
dx.use(
	value => {
		const {request} = value;
		value.response = fetch(request.location.href);
	}
);
dx.listen(self,{events:["fetch"]});

## Building and Using A Worker

The easiest way to finalize your a worker for deployment is to use `webpack`:


```
webpack <appPath> <destinationFile>
```

Assuming you have moved a copy of `dexterous-worker` or `dexterous-services-worker` to your app directory, you then load the client using the `destinationFile` as follows:

```html
<html>
<body>
</body>
<script src="dexterous-worker.js"></script>
<script>
const app = new DexterousWorker("<destinationFile>");
app.listen();
</script>
</html>
```

or

```html
<html>
<body>
</body>
<script src="dexterous-service-worker.js"></script>
<script>
const app = new DexterousServiceWorker("<destinationFile>");
app.listen();
</script>
</html>
```

Note: For routing to work properly, `destinationFile`, should be just that, a file in your root directory not a path to a file in a subdirectory.


## Deploying a ServiceWorker to Cloudflare


If you are using your `ServiceWorker` in the Cloudflare CDN, you will need to deploy it using something like `curl`, e.g.

```
curl -X PUT "https://api.cloudflare.com/client/v4/zones/:zone_id/workers/script" -H
"X-Auth-Email:YOUR_CLOUDFLARE_EMAIL" -H "X-Auth-Key:ACCOUNT_AUTH_KEY" -H
"Content-Type:application/javascript" --data-binary "@PATH_TO_YOUR_WORKER_SCRIPT"
```

Note: You must put the `@` sign before your worker script file name.

# Debugging

Naturally, you can use normal JavaScript debugging capability with `Dexterous` apps. They will run un-transpiled in the most recent versions on Chrome, Firefox, Edge, and Node.

`Dexterous` also has a start-up option `trace`. 

```
new Dexterous({trace:true})
```

If trace is `truthy` each step will be logged:

```javascript
[<middleware index>,<callback index>],<callback name>,<most recent return value>
```

Indexes are zero based. Each time a middleware is added to an app it gets an index one more than the last. This includes incrementing indexes associated with built-in routes. For example, `Dexterous` itself has one built in route so the first route you add will have an index of 1. `DexterousHttpServer` also has a built-in route and inherits from `Dexterous`, so if you add your own its index will be 2. `DexterousExpress` has two built-ins and inherits from `DexterousHttpServer`, so if you add a route it will have an index of 5.

The location of logging can be changed with the start-up option `log`, which defaults to `console`.

# Handling Errors

With Dexterous, errors are just like any other return value and you can write routes to handle them. The route below, if made the last one in your app could handle any number of errors:

```
dx.route(value => 
  (value && typeof(value)==="object" && value instanceof Error 
    ? {value} 
    : {done:true, value})
  ).use(error => ...)
```

Alternatively, you could adopt a convention that the last step in any handler is for addressing errors:


```
dx.use(
 ...,
 ...,
 value => {
 	if(value && typeof(value)==="object" && value instanceof Error) {
 		... <do something> ...
 		return {value:<corrected value>};
 	}
 	return {value}
 }
)
```


# API

## Dexterous - dexterous.js

## DexterousHttpServer extends Dexterous - dexterous-http-server.js

## DexterousExpress extends DexterousHttpServer - dexterous-express.js

## DexterousServiceWorker - dexterous-service-worker.js

# Design Decisions

## Use Standards Based Idioms

Whenever possible, use design idioms that reflect the approaches used in ECMAScript standards.

## Minimize dependencies

Enough said.

## Simple Install 

Installation processes that involve building by definition add dependencies and complexities, so avoid post istall build requirements.

## No Transpilation

Since most developers run a transpiling build process and target enviorment transpilation needs vary, the code is not provided in transpiled form. In some chases this means an archaic coding style may be used. For example, at the time of v1.0.1a deployment, the most recent Node version does not support ECMAScrimpt `import` and `export`; hence, the older `require` syntax is used.

## Single Value Middleware Functions With Destructuring

By having middleware functions take a single argument, a high level of flexibility is maintained with minimal code overhead.

## No Middleware Gateway Tests

`Dexterous` is based on a pipeline metaphor in which each step of middleware can be either a test or a transformation; hence, no leading test only function is required as a gateway filter. However, for convenience a `string` can be passed as a path. Internally, `Dexterous` converts these to functions.

## No `next` Function

Not using a `next` function like `Express` allowed the implementation of some very simple internals while also following the standards based `Iterable` return value metaphor.

## `request.location` vs `request.url`

This is a standards based idiom. When `Express` was launched, the ECMA standards around the `Location` object and `URL` class did not exist. Also the use of `url` as a property is not standardized across JavaScript objects. Sometimes it is a used for full URLs and at other times, e.g. the Node `Request` object, it is just a portion of a full URL. The property `url` is still present when using `DexterousExpress`, but its use should be avoided in new code.

# Updates (reverse chronological order)

2019-03-20 v1.0.5b - Fixed edge case where Iterable protocol was not routing properly. Added Cloudflare example code.

2018-12-03 v1.0.5a - Changed engine to >=10.0.0.

2018-06-07 v1.0.4a - Remove un-necessary files.

2018-06-07 v1.0.3a - Improved logging. Moved default mime types down to DexterousHtppServer.

2018-06-06 v1.0.2a - Simplify middleware return value protocol.

2018-06-04 v1.0.1a - Complete re-write to simplify.

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
