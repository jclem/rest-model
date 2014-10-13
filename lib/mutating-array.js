'use strict';

module.exports = Ember.Mixin.create({
  filters: function() {
    return [];
  }.property(),

  addFilter: function(filter) {
    this.get('filters').pushObject(filter);
    var filtered = this.filter(filter);
    var args = [0, this.length].concat(filtered);
    this.splice.apply(this, args);
    return this;
  },

  replace: function(idx, amt, objects) {
    var filters = this.get('filters');

    filters.forEach(function applyFilter(filter) {
      objects = objects.filter(filter);
    });

    return this._super(idx, amt, objects);
  }
});
