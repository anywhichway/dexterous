
(function() {
	class Dexterous {
		constructor(options) {
			this._options = Object.assign({},options);
			this._options.log || (this._options.log=console);
			this._options.mimeTypes || (this._options.mimeTypes={});
			this._middleware = [];
			Dexterous.prototype.use.call(this, // use may be overridden lower in the heirarchy
					function normalizeLocations(value) {
						for(const key in value) {
							const item = value[key];
	            if(item && item.url) {
								try {
									item.location = new URL(item.url);
								} catch(e) {
									;
								}
							}
						};
						return {value};
					}
			);
		}
		close() {
			!this.server || this.server.close();
		}
		get(key) {
			const parts = key.split(".");
			key = parts.pop().trim();
			let node = this._options,
				part;
			while((part=parts.shift())) {
				if(!node[part] || typeof(node[part])!=="object") return;
			}
			return node[key];
		}
	  final(value) {
	  	return value;
	  }
	  async handle(value,callback) {
	  	let next,
	  		callbacks = 0,
	  		i = 0,
	  		id,
	  		rejector,
	  		promise;
	  	if(!callback) {
	  		promise = new Promise((resolve,reject) => {
	  			callback = resolve;
	  			rejector = reject;
	  		})
	  	}
	  	if(typeof(MessageEvent)!=="undefined" && value instanceof MessageEvent) {
	  		id = value.data.id;
	  		value = value.data.message;
	  	}
			Object.defineProperty(value,"app",{enumerable:false,configurable:true,writable:true,value:this});
			for(i=0;i<this._middleware.length && value!==undefined;i++) {
	      const handler = this._middleware[i];
	      next = value;
				for(let j=0;j<handler.length && value!==undefined;j++) {
					callbacks++;
	        const step = handler[j];
				  let result;
	        try {
	          result = await step(next);
	        } catch(e) {
	          result = e;
	        }
	        if(this._options.trace && this._options.log) this._options.log.log([i,j],step.name||"anonymous",result)
	        if(result) {
						console.log(result,JSON.stringify(result.value));
	        	next = result.value!==undefined ? result.value : result;
	        	value = result.value;
	        	if(result.done || result.value==undefined) {
							value = undefined;
							break;
						}
	        } else {
	        	next = result;
	        	value = undefined;
	        }
				}
			}
			//console.log(next)
			if(next) {
				next = this.final(next);
				if(next && next.error) this._options.log.log(next.error)
			}
			if(typeof(postMessage)!=="undefined") postMessage({id,message:next})
			if(!next || !next.error) {
				if(promise) callback(next);
				else callback(null,next)
			} else {
				reject(next.error,next);
			}
			return promise;
		}
	  listen(scope,{events}) {
	  	async function respond(scope,event) {
			  const response = await scope.handle(event);
			  if(response!==undefined) return response;
			  return new Response("Not Found",{status:404,statusText:"Not Found"});
			}
	  	events.forEach(eventName => {
	  		scope.addEventListener(eventName,event => { 
	  			if(event.respondWith) event.respondWith(respond(this,event));
	  			else respond(this,event);
				})
	  	});
	  }
	  get mimeTypes() {
	  	return this._options.mimeTypes;
	  }
		pathMatch(path,url) {
			if(url && path && typeof(path)==="object" && path instanceof RegExp) return path.test(url);
			return url && url.indexOf(path)===0;
		}
	  route(test) {
	   const me = this,
	    use = this.use.bind(this,test);
	   return {
	     use,
	     route: (test) => me.route.call(this,test) 
	   }
	  }
		set(key,value) {
			const parts = key.split(".");
				key = parts.pop().trim();
			let node = this._options,
				part;
			while((part=parts.shift())) {
				node = node[part] && typeof(node[part])==="object" ? node[part] : (node[part]={});
			}
			node[key] = value;
		}
	  use(...pipeline) {
	  	if(typeof(pipeline[0])==="string") {
	  		const me = this,
	  			path = pipeline[0];
	  		pipeline[0] = function pathMatch(value) {
	  			const {request,location} = value;
	  			if(me.pathMatch(path,request ? request.location.pathname : location.pathname)) return {value};
	  			return {done:true,value};
	  		}
	  	}
			this._middleware.push(pipeline);
			return this;
		}
	}
	if(true) module.exports = Dexterous;
	if(typeof(window)!=="undefined") window.Dexterous = Dexterous;
}).call(this);
