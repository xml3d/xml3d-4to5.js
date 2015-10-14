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

            removeArtefacts(window.$);

            shader2material(window.$);

            newlightmodel(window.$);

            perspective2Projection(window.$);

            textureSamplingParameters(window.$);

            visibleAttribute2cssProperty(window.$);

            newViewLogic(window.$);
            newViewLogic(window.$);

            falloffAngleToCutoffAngle(window.$);

            meshTransformToTransform(window.$);

            transparencyToOpacity(window.$);

            window.$(".jsdom").remove();
            save(window.document, filename);

        }
    })
}

function transparencyToOpacity($) {
    $("xml3d float[name=transparency]").each(function() {
        var el = $(this);
        el.attr("name", "opacity");
        var val = +el.text();
        val = 1.0 - val;
        if (isNaN(val)) {
            console.warn("Encountered NaN while converting from 'transparency' to 'opacity' in material #"+el.parent().attr('id'));
        } else {
            el.text(val);
        }
    });
}

function meshTransformToTransform($) {
    $("xml3d float4x4[name=meshTransform]").each(function() {
        var el = $(this);
        var parentName = el.parent().prop("tagName");
        if (parentName === "ASSETMESH" || parentName === "MESH") {
            var am = el.parent();
            var matString = el.text();
            matString = matString.split(/\s+/).join(", ");
            var styleString = am.attr("style") || "";
            styleString = "transform: matrix3d("+matString+"); " + styleString;
            am.attr("style", styleString);
            el.remove();
        } else {
            console.warn("Could not automatically convert the 'meshTransform' with values "+el.text());
        }
    });
}

function removeArtefacts($) {
    $("xml3d").each(function () {
        // We are in HTML, no namespace required anymore
        var xmlns = $(this).attr("xmlns");
        if (xmlns == "http://www.xml3d.org/2009/xml3d") {
            $(this).removeAttr("xmlns");
        }
    });
}

function falloffAngleToCutoffAngle($) {
    $("xml3d float[name=falloffAngle]").each(function() {
        $(this).attr("name", "cutoffAngle");
    });
}

function newViewLogic($) {
    $("xml3d view").each(function () {
        var position = $(this).attr("position");
        var css = [];
        if (position) {
            var split = position.split(" ");
            position = [+split[0], +split[1], +split[2]]
            css.push("translate3d(" + position.join("px, ") + "px)");
            $(this).removeAttr("position");
        }

        var orientation = $(this).attr("orientation");
        if (orientation) {
            split = orientation.split(" ");
            orientation = [+split[0], +split[1], +split[2], (+split[3] * 180 / Math.PI).toFixed(1)];
            css.push("rotate3d(" + orientation.join(", ") + "deg)");
            $(this).removeAttr("orientation");
        }

        if (css.length) {
            $(this).attr("style", "transform: " + css.join(" "));
        }

        var fovv = $(this).attr("fieldofview");
        if(fovv) {
            $(this).removeAttr("fieldofview");
            $(this).append($("<float name='fovVertical'>" + fovv + "</float>"))
        }

        var projection = $(this).attr("projection");
        if(projection) {
            $(this).attr("src", projection);
            $(this).attr("model", "urn:xml3d:view:projective");
            $(this).removeAttr("projection");
        }

    });
     $("xml3d").each(function () {
         var activeView = $(this).attr("activeview");
         if(activeView != undefined) {
             $(this).attr("view", activeView);
         }
         $(this).removeAttr("activeview");
     });
}

function visibleAttribute2cssProperty($) {
    $("xml3d group,model,mesh,light").each(function() {
        var visible = $(this).attr("visible");
        if (visible != undefined) {
            if(visible == "false") {
               $(this).hide();
            }
            $(this).removeAttr("visible");
        }
    });
}

function textureSamplingParameters($) {
    $("xml3d texture").each(function() {
        var wrapAttribute, filterAttribute;
        var texture = $(this);

        if (texture.attr("wrap") || texture.attr("filter")) {
            return;
        }


        var wrapS = texture.attr("wrapS") || "clamp";
        var wrapT = texture.attr("wrapT") || "clamp";
        if(wrapS == wrapT) {
            wrapAttribute = wrapS;
        } else {
            wrapAttribute = wrapS + " " + wrapT;
        }

        var filterMin = texture.attr("filterMin") || "linear-mipmap-linear";
        var filterMag = texture.attr("filterMag") || "linear";

        if(filterMag == filterMin) {
            filterAttribute = filterMin;
        } else {
            filterAttribute = filterMin + " " + filterMag;
        }

        ["wraps", "wrapt", "filtermin", "filtermag"].forEach(function(attr) {
            texture.removeAttr(attr);
        });

        if (wrapAttribute != "clamp") { // default
            texture.attr("wrap", wrapAttribute);
        }
        if (filterAttribute != "linear-mipmap-linear linear") { // default
            texture.attr("filter", filterAttribute);
        }
    });
}

function perspective2Projection($) {
    $("xml3d view").each(function() {
        var perspective = $(this).attr("perspective");
        if (perspective) {
            $(this).removeAttr("perspective").attr("projection", perspective);
            console.log("")
        }
    });
    $("xml3d data, xml3d dataflow").each(function() {
        var compute = $(this).attr("compute");
        if (compute) {
            compute = compute.replace("perspective=", "projection=");
            compute = compute.replace("perspective =", "projection =");
            $(this).attr("compute", compute);
        }
    });
}


function newlightmodel($) {
    $("xml3d light").each(function() {
        var shaderRef = $(this).attr("shader");
        if (shaderRef) {
            $(this).removeAttr("shader");
        } else {
            var styleValue = $(this).attr("style");
            if (styleValue) {
                var pattern = /shader\s*:\s*url\s*\(\s*(\S+)\s*\)/i;
                var result = pattern.exec(styleValue);
                if (result) {
                    shaderRef = result[1];
                    styleValue = styleValue.replace(/shader\s*:\s*url\s*\(\s*(\S+)\s*\)/, '');
                    $(this).attr("style", styleValue);
                }
            }
        }
        if(!shaderRef) {
            return;
        }
        var lightshader = $(shaderRef);
        if(!lightshader.length) {
            return;
        }

        // Set the model of the <light> instead of script of <lightshader>
        $(this).attr("model", lightshader.attr("script").replace("lightshader", "light"));
        // $(this).append($("<data src='" + shaderRef +"'></data>"));
        $(this).append(lightshader.children());
        if (lightshader.attr("compute")) {
            $(this).attr("compute", lightshader.attr("compute"))
        }

        if ($(this).attr("intensity")) {
            var i = +$(this).attr("intensity");

            var intensity = $(this).children("float3[name=intensity]").text();
            if(intensity) {
                var values = [];
                intensity.trim().split(/\s+/).forEach(function(v) {
                    values.push((+v)*i);
                });
                $(this).children("float3[name=intensity]").text(values.join(" "));
            }

            //$(this).append('<!--  TODO: Adapt intensity by ' + $(this).attr("intensity") + '-->');
            $(this).removeAttr("intensity");
        }
    });

    $("xml3d lightshader").remove();
    /*$("xml3d lightshader").each(function() {
        $(this).removeAttr("script");
        rename_node($, this, "data");
    })*/
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

    $("xml3d material").each(function(index) {
        var script = $(this).attr("script");
        if(script != undefined) {
            $(this).attr("model", script);
            $(this).removeAttr("script");
        }

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
    console.log("Usage: iojs xml3d-4to5.js <html-file-to-convert>");
    process.exit(1);
} else {
    convert(argv._[0]);
}
