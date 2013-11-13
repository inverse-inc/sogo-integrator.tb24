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

            let color = labelsColors[name][1];
            if (typeof(color) == "undefined") {
                color = "#000000";
            }
            
            labelsxml += "<i:label id=\"" + name + "\" color=\"" + color + "\">" + xmlEscape(labelsColors[name][0]) +  "</i:label>";
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
                    let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);
                    
                    prefService.deleteBranch("mailnews.tags");
                    
  
                    // We'll get something like that:
                    //
                    //  <n1:label color="#f00" id="$label1">Important</n1:label>
                    //  <n1:label color="#ff9a00" id="$label2">Work</n1:label>
                    //  <n1:label color="#009a00" id="$label3">Personal</n1:label>
                    //  <n1:label color="#3130ff" id="$label4">To Do</n1:label>
                    //  <n1:label color="#9c309c" id="$label5">Later</n1:label>
                    //
                    let multistatus = response.documentElement;
                    let labels = multistatus.getElementsByTagName("n1:label");

                     for (let i = 0; i < labels.length; i++) {
                         let label = labels.item(i);
                        
                         let id = label.getAttribute("id");
                         let color = label.getAttribute("color");
                         let name = label.innerHTML;

                         prefService.setCharPref("mailnews.tags." + id + ".tag", name);
                         prefService.setCharPref("mailnews.tags." + id + ".color", color.toUpperCase());
                     }
                }
            }
        }

        let properties = ["urn:inverse:params:xml:ns:inverse-dav mails-labels"];
        let propfind = new sogoWebDAV(sogoBaseURL() + "Mail", mailsLabelsListener, undefined, undefined, false);
        propfind.propfind(properties, false);
    }
};
