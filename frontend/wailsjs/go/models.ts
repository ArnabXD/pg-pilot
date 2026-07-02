export namespace pg {
	
	export class InstalledVersion {
	    version: string;
	    bytes: number;
	    inUse: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InstalledVersion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.bytes = source["bytes"];
	        this.inUse = source["inUse"];
	    }
	}
	export class InstanceStatus {
	    name: string;
	    version: string;
	    port: number;
	    running: boolean;
	    dataDir: string;
	
	    static createFrom(source: any = {}) {
	        return new InstanceStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.port = source["port"];
	        this.running = source["running"];
	        this.dataDir = source["dataDir"];
	    }
	}

}

