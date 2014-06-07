'use strict';

var browserify = require('gulp-browserify');
var gulp       = require('gulp');
var rename     = require('gulp-rename');
var uglifyjs   = require('gulp-uglifyjs');

gulp.task('default', function() {
  gulp.src('index.js')
    .pipe(browserify({ standalone: 'RestModel' }))
    .pipe(rename('rest-model.js'))
    .pipe(gulp.dest('dist'))
    .pipe(uglifyjs())
    .pipe(rename('rest-model.min.js'))
    .pipe(gulp.dest('dist'));
});
