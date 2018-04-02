var gulp = require("gulp");
var fs = require("fs");
var cp = require("child_process");
var foreach = require("gulp-foreach");
var getPixels = require("get-pixels");
gulp.task("default", function() {
    cp.execFile("uglify.cmd");
    cp.execFile("uglify-min.cmd");
});
gulp.task("watch", function() {
    gulp.watch("./js/**/*.*", ["default"]);
});
gulp.task("buildcollisions", function() {
    fs.writeFile("js/collisions.js", "const collisions = \r\n");
    return gulp.src("./extbuild/map.png").pipe(foreach(function(stream, file) {
        var pathArr = file.path.split("\\");
        var len = pathArr.length;
        var path = pathArr[len - 2] + "/" + pathArr[len - 1];
        var name = pathArr[len - 1].replace(".png", "");
        getPixels(path, function(e, p) {
            var width = p.shape[0], height = p.shape[1];
            var res = [];
            for(var y = 0; y < height; y++) {
                var row = [];
                for(var x = 0; x < width; x++) {
                    var idx = 4 * (y * width + x);
                    var r = p.data[idx], g = p.data[idx + 1], b = p.data[idx + 2];
                    if(r === 255) {
                        if(g === 255) {
                            if(b === 255) {
                                row.push(4); // snow
                            } else {
                                row.push(3); // desert
                            }
                        } else {
                            row.push(0); // ocean
                        }
                    } else if(g === 255) {
                        row.push(2); // grass
                    } else if(b === 255) {
                        row.push(5); // water
                    } else {
                        row.push(1); // beach
                    }
                }
                res.push(row);
            }
            var str = JSON.stringify(res);
            str = str.replace(/(?:[^\,]*\,){500}/g, "$&\n");
            fs.appendFile("js/collisions.js", str + ";");
        });
        return stream;
    }));
});