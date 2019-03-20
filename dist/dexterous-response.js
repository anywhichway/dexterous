(function() {
	const Dexterous = require("dexterous");
	class DexterousResponse {
		constructor() {
			this.finished  = false;
			this.headersSent = false;
			Object.defineProperty(this,"headers",{enumerable:true,configurable:true,writable:true,value:new Headers({})});
			Object.defineProperty(this,"body",{enumerable:true,configurable:true,writable:true,value:new Body(this)});
			Object.defineProperty(this,"status",{enumerable:true,configurable:true,writable:true,value:200});
		}
		Response() {
			return new Response(this.body.data,{status:this.status,statusText:this.statusText,headers:this.headers});
		}
		appendHeader(key,value) {
			if(this.headersSent  || this.finished) {
				throw new Error("BrowserResponse headers already sent")
			}
			this.headers.append(key,value);
		}
		end(data) {
			if(data!==undefined) {
				this.body.write(data);
			}
			this.finished = true;
		}
		getHeader(key) {
			return this.headers.get(key);
		}
		async json() {
			return this.body.json();
		}
		removeHeader(key) {
			this.headers.delete(key);
		}
		setHeader(key,value) {
			if(this.headersSent  || this.finished) {
				throw new Error("BrowserResponse headers already sent")
			}
			this.headers.set(key,value);
		}
		async text() {
			return this.body.text();
		}
		write(data) {
			if(this.finished) {
				throw new Error("BrowserResponse body is closed")
			}
			this.headersSent = true;
			this.body.write(data);
		}
		writeHead(statusCode,statusMessage,headers={}) {
			if(statusMessage && typeof(statusMessage)==="object") {
				headers = statusMessage;
				statusMessage = null;
			}
			this.status = statusCode;
			for(const key in headers) {
				this.setHeader(key,headers[key]);
			}
		}
	}
	
	if(typeof(module)!=="undefined") module.exports = DexterousResponse;
	if(typeof(window)!=="undefined") window.DexterousResponse = DexterousResponse;
}).call(this);