(function() {
	class Dexterous {
		constructor(options) {
			const mimeTypes = {
			   	 "css": "text/css",
			  	 "gzip": "application/gzip",
			  	 "gif": "image/gif",
			  	 "htm": "text/html",
			  	 "html": "text/html",
			  	 "ico": "image/x-icon",
			  	 "jpg": "image/jpeg",
			  	 "jpeg": "image/jpeg",
			  	 "js": "application/javascript",
			  	 "json": "application/json",
			  	 "mp4": "video/mp4",
			  	 "mpg": "video/mpeg",
			  	 "mpeg": "video/mpeg",
			  	 "pdf": "applicaion/pdf",
			  	 "png": "image/png",
			  	 "txt": "text/plain",
			  	 "wsdl": "application/wsdl+xml",
			  	 "xml": "application/xml",
			  	 "xsl": "application/xml"
				};
			this._options = Object.assign({},options);
			this._options.log || (this._options.log=console);
			this._options.mimeTypes || (this._options.mimeTypes={});
			Object.assign(this._options.mimeTypes,mimeTypes);
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
				if(!node[part] || typeof(node[part])!=="object") {
					return;
				}
			}
			return node[key];
		}
	  async handle(value,callback) {
	  	let next,
	  		callbacks = 0,
	  		i = 0,
	  		id;
	  	if(typeof(MessageEvent)!=="undefined" && value instanceof MessageEvent) {
	  		id = value.data.id;
	  		value = value.data.message;
	  	}
			const app = this;
			Object.defineProperty(value,"app",{enumerable:false,configurable:true,writable:true,value:app});
			for(i=0;i<this._middleware.length && value!==undefined;i++) {
	      const handler = this._middleware[i];
	      next = value;
				for(let j=0;j<handler.length;j++) {
					callbacks++;
	        const step = handler[j];
				  let result;
	        try {
	          result = await step(next);
	        } catch(e) {
	          result = e;
	        }
	        if(this._options.trace && this._options.log) {
	          this._options.log.log([i,j],step.name,result)
	        }
	        if(!result || result.value===undefined) {
	        	callbacks--;
	        	value = undefined;
	        } else {
	        	next = result.value;
	        }
	        if(!result || result.done || result.value===undefined) {
	        	break;
	        }
				}
			}
			if(next) {
				next = this.final(next);
				if(next && next.error) {
					 this._options.log.log(next.error)
				}
			}
			if(typeof(postMessage)!=="undefined") {
				postMessage({id,message:next})
			}
			if(callback) {
				callback(next);
			}
			return {value:next,middleware:i,callbacks};
		}
	  final(value) {
	  	return value;
	  }
	  get mimeTypes() {
	  	return this._options.mimeTypes;
	  }
	  listen(scope,{events}) {
	  	async function respond(scope,event) {
			  const result = await scope.handle(event);
			  if(result && result.value && result.value.response) {
			    return result.value.response;
			  }
			  return new Response("Not Found",{status:404,statusText:"Not Found"});
			}
	  	events.forEach(eventName => {
	  		scope.addEventListener(eventName,event => { 
	  			if(event.respondWith) {
	  				event.respondWith(respond(this,event));
	  			} else {
	  				respond(this,event);
	  			}
				})
	  	});
	  }
		pathMatch(path,url) {
			if(url && path && typeof(path)==="object" && path instanceof RegExp) {
				return path.test(url);
			}
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
			this._middleware.push(pipeline);
			return this;
		}
	}
	if(typeof(module)!=="undefined") {
		module.exports = Dexterous;
	}
	if(typeof(window)!=="undefined") {
		window.Dexterous = Dexterous;
	}
}).call(this);