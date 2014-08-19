'use strict';

var browserify = require('gulp-browserify');
var spawn      = require('child_process').spawn;
var gulp       = require('gulp');
var rename     = require('gulp-rename');
var uglifyjs   = require('gulp-uglifyjs');
var watch      = require('gulp-watch');

gulp.task('default', function() {
  gulp.src('index.js')
    .pipe(browserify({ standalone: 'RestModel' }))
    .pipe(rename('rest-model.js'))
    .pipe(gulp.dest('dist'))
    .pipe(uglifyjs())
    .pipe(rename('rest-model.min.js'))
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', function() {
  watch({ glob: ['lib/**/*.js', 'test/**/*.js'] }, function(files) {
    var test = spawn('npm', ['test']);
    test.stdout.on('data', process.stdout.write.bind(process.stdout));
    test.stderr.on('data', process.stderr.write.bind(process.stderr));
  });
});
