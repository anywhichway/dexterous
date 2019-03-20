(function() {
	class DexterousWorker {
		constructor(path) {
			this.path = path;
			this.resolvers = new Map();
		}
		close() {
			!this.server || this.server.close();
		}
		listen(path,options) {
			path || (path = this.path);
			this.server = new Worker(path);
			this.server.onmessage = ({data:{id,message}}) => {
				const resolver = this.resolvers.get(id);
				if(resolver) {
					this.resolvers.delete(id);
					resolver(message);
				}
			};
			return this.server;
		}
		handle(message,callback) {
			if(!this.server) this.listen();
			let resolver;
			const id = this.resolvers.size,
				promise = new Promise(resolve => resolver = resolve);
			if(callback) {
				promise.then(result => callback(result));
			}
			this.resolvers.set(id,resolver);
			this.server.postMessage({id,message});
			return promise;
		}
		
	}
	
	if(typeof(module)!=="undefined") module.exports = DexterousWorker;
	if(typeof(window)!=="undefined") window.DexterousWorker = DexterousWorker;
}).call(this);