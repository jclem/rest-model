'use strict';

module.exports = Ember.Mixin.create({
  filters: function() {
    return [];
  }.property(),

  replace: function(idx, amt, objects) {
    var filters = this.get('filters');

    filters.forEach(function applyFilter(filter) {
      objects = objects.filter(filter);
    });

    return this._super(idx, amt, objects);
  },

  runFilters: function() {
    return this.replace(0, this.length, this);
  }.observes('filters.[]')
});
