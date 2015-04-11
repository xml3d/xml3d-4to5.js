var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var jsdom = require("jsdom");

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function save(document, filename) {
    var serializeDocument = require("jsdom").serializeDocument;
    fs.writeFile(filename, serializeDocument(document), function (err) {
        if (err) {
            console.err(err, filename);
            process.exit(1);
        }

        console.log("File saved:", filename);
    });
}

function convert(filename) {
    var isXML = endsWith(filename, ".xml");
    if (isXML) {
        console.log("Converter does not work for XML files:", filename);
        process.exit(1);
    }
    jsdom.env({
        file: filename, parsingMode: isXML ? "xml" : "auto", scripts:  ["http://code.jquery.com/jquery.js"], done: function (errors, window) {
            if (errors) {
                errors.forEach(function(err) {
                    console.error(err.message, ":",  filename);
                });
                //process.exit(1);
            }

            shader2material(window.$);



            window.$(".jsdom").remove();
            save(window.document, filename);

        }
    })
}

function rename_node($, node, newName) {
    var mat = $("<"+newName+">" + $(node).html() + "</"+ newName +">");
    var attributes = node.attributes;
    for (var i = 0; i < attributes.length; i++) {
        var attr = attributes[i];
        mat.attr(attr.name, attr.value);
    }
    $(node).replaceWith(mat);
}

function shader2material($) {
    // Select all shaders elements that are sibling of a xml3d element
    $("xml3d shader").each(function(index) {
        // Rename "urn:xml3d:shader:*" to "urn:xml3d:material:*"
         $(this).attr("script", $(this).attr("script").replace("xml3d:shader:", "xml3d:material:"));
        // Rename <shader> to <material>
         rename_node($, this, "material");
    });

    // Renames material references (shader attributes)
    // Rename all references to shader, except for those in light elements
    $("xml3d :not(light)[shader]").each(function(index) {
        $(this).attr("material", $(this).attr("shader"));
        $(this).removeAttr("shader");
    });

    // Renames material references (shader properties in local styles)
    $("xml3d :not(light)[style*='shader:']").each(function(index) {
        $(this).attr("style", $(this).attr("style").replace("shader:", "material:"));
    });
}



if (!argv._.length) {
    console.print("Usage: iojs xml3d-4to5.js <html-file-to-convert>");
    process.exit(1);
} else {
    convert(argv._[0]);
}
