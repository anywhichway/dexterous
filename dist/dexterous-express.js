(function() {
	let DexterousNodeServer = this.DexterousNodeServer,
		pathToRegexp = this.pathToRegexp;
	if(typeof(module)!=="undefined") {
		DexterousHttpServer = require("./dexterous-http-server.js"),
		pathToRegexp = require("path-to-regexp");
	}
	
	class DexterousExpress extends DexterousHttpServer {
		constructor(options) {
			super(options);
			const get = super.get.bind(this);
			super.use(value => {
				const {response} = value;
				if(!response) value.response = {};
				return {value};
			});
			super.use(value => {
				const {request} = value;
				request.app = this;
				if(request.location) {
					for(const key in request.location) {
						if(!request[key] && request.location[key]) {
							request[key] = request.location[key];
						}
					}
					if(request.pathname && !request.path) {
						request.path = request.pathname;
					}
				}
				return {value};
			});
		}
		all(path,callback) {
			super.use(
					args => {
						const {request} = args;
						if(typeof(request.method)==="string") {
							return {value:args}
						}
						return {done:true,value:args}
					},
					args => {
						const {request} = args;
						if(me.pathMatch(path,request.path)) {
							return {value:args}
						}
						return {done:true,value:args}
					},
					({request,response}) => {
						callback(request,response);
					}
			)
		}
		app() {
			return this;
		}
		disable(key,value) {
			this.set(key,false); 
		}
		delete(path,...callbacks) {
			this.handleMethod("DELETE",path,...callbacks);
		}
		enable(key,value) { 
			this.set(key,true); 
		}
		get(path,...callbacks) {
				this.handleMethod("GET",path,...callbacks);
		}
		async handleCallbacks(value,...callbacks) {
			let result,
				{request,response,error} = value;
			for(const callback of callbacks) {
				let resolver;
				const timeout = setTimeout(() => resolver(),this._options.timeout||5000),
					promise = new Promise((resolve) => resolver = resolve),
					next = (value=true) => {
						clearTimeout(timeout);
						resolver(value);
					}
				result = false;
				if(error) {
					if(callback.length===4) {
						delete value.error;
						callback(error,request,response,next);
						result = await promise;
					} else {
						result = true;
					}
				} else if(callback.length!==4) {
					callback(request,response,next);
					result = await promise;
				}
				if(!result) {
					break;
				}
				if(result==="route") {
					return {value};
				}
				if(result && typeof(result)==="object" && result instanceof Error) {
					error = value.error = result;
				}
			}
			if(result) return {value}
		}
		handleMethod(method,path,...callbacks) {
			if(arguments.length===1 && method==="GET") {
				return super.get(path);
			}
			super.use(
					value => {
						const {request} = value;
						if(request.method===method) {
							return {value}
						}
						return {done:true,value}
					},
					value => {
						const {request} = value;
						if(this.pathMatch(path,request.path)) {
							return {value}
						}
						return {done:true,value}
					},
					value => this.handleCallbacks(value,...callbacks)
			)
		}
		options(path,...callbacks) {
			this.handleMethod("OPTIONS",path,...callbacks);
		}
		patch(path,...callbacks) {
			this.handleMethod("PATCH",path,...callbacks);
		}
		pathMatch(path,url) {
			return pathToRegexp(path).test(url);
		}
		post(path,...callbacks) {
			this.handleMethod("POST",path,...callbacks);
		}
		put(path,...callbacks) {
			this.handleMethod("PUT",path,...callbacks);
		}
		use(test,...callbacks) {
			if(typeof(test)==="string" || test instanceof RegExp) {
				const path = test;
				test = (request,response,next) => {
					if(!this.pathMatch(path,request.path)) {
						next("route");
					}
					next();
				}
			}
			callbacks.unshift(test);
			super.use(
					async value => this.handleCallbacks(value,...callbacks)
			)
		}
	}
	
	if(typeof(module)!=="undefined") module.exports = DexterousExpress;
	if(typeof(window)!=="undefined") window.DexterousExpress = DexterousExpress;
}).call(this);