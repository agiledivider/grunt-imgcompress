module.exports = function(grunt) {
  var childProcess, filesize, fs, jpgPath, path, pngPath;
  path = require('path');
  fs = require('fs');
  childProcess = require('child_process');
  filesize = require('filesize');
  pngPath = require('optipng-bin').path;
  jpgPath = require('jpegtran-bin').path;
  grunt.registerMultiTask('imgcompress', 'Batch Minify PNG and JPEG images', function() {
    var childs, files, ignores, jpgArgs, optimize, options, pngArgs, pushFile, recurse;
    options = this.options();
    recurse = typeof options.recurse === "undefined" ? true : !!options.recurse;
    childs = typeof options.childs === 'number' && options.childs > 0 ? parseInt(options.childs, 10) : 30;
    pngArgs = ['-strip', 'all'];
    jpgArgs = ['-copy', 'none', '-optimize'];
    if (typeof options.optimizationLevel === 'number' && options.optimizationLevel >= 0 && options.optimizationLevel <= 7) {
      pngArgs.push('-o', options.optimizationLevel);
    }
    if (options.progressive === true) {
      jpgArgs.push('-progressive');
    }
    grunt.verbose.writeflags(options, 'Options');
    ignores = grunt.util.kindOf(options.ignores) === 'array' && options.ignores.length > 0 ? options.ignores : false;
    files = [];
    pushFile = function(src, dest) {
      var ext, flag;
      ext = path.extname(src);
      if (['.png', '.jpg', '.jpeg'].indexOf(ext) < 0 || ignores && grunt.file.isMatch({
        matchBase: true
      }, ignores, src)) {
        return null;
      }
      dest = dest.replace(new RegExp('\\\\', 'g'), '/');
      flag = true;
      files.forEach(function(file, i) {
        if (file['dest'] === dest && flag) {
          if (file['src'] !== src) {
            if (options.duplication === 'error') {
              grunt.log.error('dest path(' + dest.red + ') duplication');
            } else {
              grunt.log.warn('src: ' + files[i]['src'].red + ', dest: ' + dest.red + ' is override by src: ' + src.red);
              files[i]['src'] = src;
              files[i]['dest'] = dest;
            }
          }
          return flag = false;
        }
      });
      if (flag) {
        return files.push({
          src: src,
          dest: dest
        });
      }
    };
    this.files.forEach(function(file) {
      var dest, destDir, isDestDir, src;
      src = file.src[0];
      dest = file.dest;
      if (!grunt.file.exists(src)) {
        grunt.log.error('src path(' + src.red + ') not exists');
      }
      destDir = path.dirname(dest);
      if (!grunt.file.exists(destDir)) {
        grunt.file.mkdir(destDir);
      }
      isDestDir = grunt.file.isDir(dest) || path.basename(dest).indexOf('.') === -1;
      if (isDestDir && !grunt.file.isDir(dest)) {
        grunt.file.mkdir(dest);
      }
      if (grunt.file.isDir(src) && isDestDir) {
        return grunt.file.recurse(src, function(abspath, rootdir, subdir, filename) {
          if (recurse || !subdir) {
            return pushFile(abspath, path.join(dest, subdir, filename));
          }
        });
      } else if (grunt.file.isFile(src)) {
        if (isDestDir) {
          dest = path.join(dest, path.basename(src));
        }
        return pushFile(src, dest);
      }
    });
    optimize = function(src, dest, next) {
      var ch, childProcessResult, ext, originalSize;
      ext = path.extname(src);
      originalSize = fs.statSync(src).size;
      if (!grunt.file.exists(path.dirname(dest))) {
        grunt.file.mkdir(path.dirname(dest));
      }
      childProcessResult = function(err, result, code) {
        var saved, savedMsg;
        if (err) {
          grunt.log.writeln(err);
        }
        saved = originalSize - fs.statSync(dest).size;
        savedMsg = result.stderr.indexOf('already optimized') !== -1 || saved < 10 ? 'already optimized' : 'saved ' + filesize(saved);
        grunt.log.writeln('✔ '.green + src + (' (' + savedMsg + ')').grey);
        return next();
      };
      if (src !== dest && grunt.file.exists(dest)) {
        grunt.file["delete"](dest);
      }
      if (ext === '.png') {
        ch = grunt.util.spawn({
          cmd: pngPath,
          args: pngArgs.concat(['-out', dest, src])
        }, childProcessResult);
      } else if (ext === '.jpg' || ext === '.jpeg') {
        ch = grunt.util.spawn({
          cmd: jpgPath,
          args: jpgArgs.concat(['-outfile', dest, src])
        }, childProcessResult);
      } else {
        next();
      }
      if (ch && grunt.option('verbose')) {
        ch.stdout.pipe(process.stdout);
        return ch.stderr.pipe(process.stderr);
      }
    };
    grunt.util.async.forEachLimit(files, childs, function(file, next) {
      grunt.verbose.writeflags(file, 'Transform');
      return optimize(file.src, file.dest, next);
    }, this.async());
  });
};
