(function() {
	class DexterousServiceWorker {
		constructor(path) {
			this.path = path;
		}
		close() {
			!this.server || this.server.unregister();
		}
		listen(options) {
			const path = this.path;
			navigator.serviceWorker.register(path,options)
		  .then(reg => {
		    this.server = reg;
		  }).catch(error => {
		    console.log(`Dexterous run ${path} failed with ${error}`);
		  });
		}
	}
	
	if(typeof(module)!=="undefined") module.exports = DexterousServiceWorker;
	if(typeof(window)!=="undefined") window.DexterousServiceWorker = DexterousServiceWorker;
}).call(this);