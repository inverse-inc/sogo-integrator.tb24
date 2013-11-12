function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("mails-labels.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-integrator/content/sogo-config.js"]);

let SIMailsLabels = {
    synchronizeToServer: function SIML_synchronizeToServer() {

        let prefService = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefBranch);
        
        let prefBranch = prefService.getBranch("mailnews.tags.");
        let prefs = prefBranch.getChildList("", {});
        
        var labelsColors = {};

        for each (let pref in prefs) {

            let name;
            let label;
            let color;

            if (pref.endsWith(".tag")) {
                name = pref.substring(0, pref.length-4);
                label = prefBranch.getCharPref(pref);

                if (!labelsColors[name]) {
                    labelsColors[name] = [];
                }
                labelsColors[name].splice(0, 0, label);
            }
            else {
                name = pref.substring(0, pref.length-6);
                color = prefBranch.getCharPref(pref);
                
                if (!labelsColors[name]) {
                    labelsColors[name] = [];
                }
                labelsColors[name].push(color);
            }
        }

        let collectionURL = sogoBaseURL() + "Mail/";
        let proppatch = new sogoWebDAV(collectionURL, null, null, true);
        
        let labelsxml = "<i:mails-labels>";
        
        for each (let name in Object.keys(labelsColors)) {
            labelsxml += "<i:" + name + ">" + xmlEscape(labelsColors[name][0]) +  "</i:" + name + ">";
            labelsxml += "<i:" + name + ">" + xmlEscape(labelsColors[name][1]) +  "</i:" + name + ">";
        }
        
        labelsxml += "</i:mails-labels>";
        
        let proppatchxml = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
	                    + "<propertyupdate xmlns=\"DAV:\""
                            + " xmlns:i=\"urn:inverse:params:xml:ns:inverse-dav\">"
	 		    + "<set>"
	 		    + "<prop>" + labelsxml + "</prop>"
                            + "</set></propertyupdate>");
	proppatch.proppatch(proppatchxml);
    },

    synchronizeFromServer: function SIML_synchronizeFromServer() {
        let mailsLabelsListener = {
            onDAVQueryComplete: function onDAVQueryComplete(status, response, headers) {
                if (status == 207) {
                    let jsonResponse = response["multistatus"][0]["response"][0];
                    let propstats = jsonResponse["propstat"];
                    
                    let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);

                    prefService.deleteBranch("mailnews.tags");

                    for (let i = 0; i < propstats.length; i++) {
                        let propstat = propstats[i];
                        if (propstat["status"][0].indexOf("200") > 0
                            && propstat["prop"][0]
                            && propstat["prop"][0]["mails-labels"][0]) {
                            //
                            // We'll get something like that:
                            //
                            // {"label1":["Important","#f00"],"label2":["Work","#ff9a00"],"label3":["Personal","#009a00"],"label4":["To Do","#3130ff"],"label5":["Later","#0000FF"]}
                            //
                            let labels = propstat["prop"][0]["mails-labels"][0]

                            for (let name in labels) {
                                prefService.setCharPref("mailnews.tags." + name + ".tag", labels[name][0]);
                                prefService.setCharPref("mailnews.tags." + name + ".color", labels[name][1].toUpperCase());
                            }
                        }
                    }
                }
            }
        };

        let properties = ["urn:inverse:params:xml:ns:inverse-dav mails-labels"];
        let propfind = new sogoWebDAV(sogoBaseURL() + "Mail", mailsLabelsListener);
        propfind.propfind(properties, false);
    }
};
